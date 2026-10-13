import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { createPresentationDocument, createStableId, type ChartObject, type DiagramObject, type PresentationDocument, type PresentationSlide, type ShapeObject, type TableObject, type TextObject } from './presentationModel';

const EMU_PER_INCH = 914400;
const PX_TO_IN = 13.333333 / 1280;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, textNodeName: '#text', trimValues: false });

export type PptxImportResult = { document: PresentationDocument; limitations: string[] };

export function getPptxExportLimitations(document: PresentationDocument): string[] {
  const mediaCount = document.slides.reduce((count, slide) => count + slide.objects.filter((object) => object.type === 'audio' || object.type === 'video').length, 0);
  return mediaCount ? ['Audio and video remain available in MORIJA JSON/IndexedDB but are not embedded in this PPTX export.'] : [];
}
function inch(px: number) { return Math.max(0, px * PX_TO_IN); }
function safeArray<T>(value: T | T[] | undefined): T[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
function attr(value: unknown, name: string): string | undefined { return value && typeof value === 'object' ? String(((value as Record<string, unknown>)['@_' + name] ?? '')) || undefined : undefined; }
function childText(value: unknown): string { if (typeof value === 'string' || typeof value === 'number') return String(value); if (!value || typeof value !== 'object') return ''; const object = value as Record<string, unknown>; if (typeof object['#text'] === 'string') return object['#text']; return Object.values(object).map(childText).join(''); }
function textOfParagraphs(body: unknown) { return safeArray((body as any)?.p).map((paragraph: any) => safeArray(paragraph?.r).map((run: any) => childText(run?.t)).join('') || childText(paragraph?.fld?.t)).join('\n'); }
function emu(value: unknown, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function geometryFromXfrm(xfrm: any, defaults = { x: 64, y: 64, width: 400, height: 120 }) { return { x: emu(attr(xfrm, 'x'), defaults.x / PX_TO_IN * EMU_PER_INCH) / EMU_PER_INCH / PX_TO_IN, y: emu(attr(xfrm, 'y'), defaults.y / PX_TO_IN * EMU_PER_INCH) / EMU_PER_INCH / PX_TO_IN, width: emu(attr(xfrm, 'cx'), defaults.width / PX_TO_IN * EMU_PER_INCH) / EMU_PER_INCH / PX_TO_IN, height: emu(attr(xfrm, 'cy'), defaults.height / PX_TO_IN * EMU_PER_INCH) / EMU_PER_INCH / PX_TO_IN, rotation: 0, zIndex: 1 }; }
function colorFromFill(spPr: any) { return attr(spPr?.solidFill?.srgbClr, 'val') ? '#' + attr(spPr.solidFill.srgbClr, 'val') : undefined; }
function shapeKind(name: string | undefined): string { const map: Record<string, string> = { rect: 'rectangle', roundRect: 'rounded-rectangle', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', star5: 'star', chevron: 'chevron', line: 'line' }; return map[name || ''] || 'rectangle'; }

function addText(slide: any, object: TextObject) {
  const runs = object.runs?.length ? object.runs.map((run) => ({ text: run.text, options: { bold: run.bold, italic: run.italic, underline: run.underline ? { color: run.color } : undefined, color: run.color?.replace('#', ''), fontFace: run.fontFamily, fontSize: run.fontSize ? run.fontSize * 0.75 : undefined, hyperlink: run.link ? { url: run.link } : undefined } })) : object.text;
  slide.addText(runs as any, { x: inch(object.geometry.x), y: inch(object.geometry.y), w: inch(object.geometry.width), h: inch(object.geometry.height), fontFace: object.style.fontFamily, fontSize: (object.style.fontSize || 24) * 0.75, color: object.style.color?.replace('#', ''), bold: (object.style.fontWeight || 0) >= 600, italic: object.style.fontStyle === 'italic', margin: 0.08, fit: 'shrink', valign: object.verticalAlign === 'middle' ? 'mid' : object.verticalAlign === 'bottom' ? 'bottom' : 'top', align: object.style.textAlign || 'left' } as any);
}
function addShape(slide: any, object: ShapeObject, pptx: any) {
  const kind = shapeKind(object.style.shape);
  const type = kind === 'ellipse' ? pptx.ShapeType.ellipse : kind === 'triangle' ? pptx.ShapeType.triangle : kind === 'diamond' ? pptx.ShapeType.diamond : kind === 'line' || kind === 'arrow' ? pptx.ShapeType.line : kind === 'rounded-rectangle' ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
  const options: any = { x: inch(object.geometry.x), y: inch(object.geometry.y), w: inch(object.geometry.width), h: inch(object.geometry.height), rotate: object.geometry.rotation, fill: { color: object.style.backgroundColor && object.style.backgroundColor !== 'transparent' ? object.style.backgroundColor.replace('#', '') : 'FFFFFF', transparency: object.style.backgroundColor === 'transparent' ? 100 : 0 }, line: { color: (object.style.outlineColor || '#1e3a8a').replace('#', ''), width: object.style.outlineWidth ?? 1 } };
  if (kind === 'line' || kind === 'arrow') options.line = { ...options.line, endArrowType: kind === 'arrow' ? 'triangle' : 'none' };
  slide.addShape(type, options);
  if (object.text) slide.addText(object.text, { x: inch(object.geometry.x), y: inch(object.geometry.y), w: inch(object.geometry.width), h: inch(object.geometry.height), fontSize: (object.style.fontSize || 18) * 0.75, color: object.style.color?.replace('#', ''), align: 'center', valign: 'mid', margin: 0.05, fit: 'shrink' } as any);
}
function addTable(slide: any, object: TableObject) {
  slide.addTable(object.cells.slice(0, object.rows).map((row) => row.slice(0, object.columns).map((cell) => ({ text: cell.text, options: { bold: cell.style?.bold, color: cell.style?.color?.replace('#', ''), fill: cell.style?.backgroundColor?.replace('#', ''), align: cell.style?.align } }))), { x: inch(object.geometry.x), y: inch(object.geometry.y), w: inch(object.geometry.width), h: inch(object.geometry.height), border: { type: 'solid', color: (object.borderColor || '#64748b').replace('#', ''), pt: object.borderWidth || 1 }, margin: 0.05, fontSize: 11, autoFit: false } as any);
}
function addChart(slide: any, object: ChartObject, pptx: any) {
  const type = object.chartType === 'line' ? pptx.ChartType.line : object.chartType === 'pie' ? pptx.ChartType.pie : pptx.ChartType.bar;
  slide.addChart(type, [{ name: object.title || 'Series', labels: object.data.map((point) => point.label), values: object.data.map((point) => point.value) }], { x: inch(object.geometry.x), y: inch(object.geometry.y), w: inch(object.geometry.width), h: inch(object.geometry.height), showTitle: Boolean(object.title), title: object.title, showLegend: false, chartColors: [object.color?.replace('#', '') || '24104F'] } as any);
}
function addDiagram(slide: any, object: DiagramObject, pptx: any) {
  for (const node of object.nodes) {
    const kind = node.kind === 'start-end' ? pptx.ShapeType.roundRect : node.kind === 'decision' ? pptx.ShapeType.diamond : pptx.ShapeType.rect;
    slide.addShape(kind, { x: inch(object.geometry.x + node.x), y: inch(object.geometry.y + node.y), w: inch(node.width), h: inch(node.height), fill: { color: node.kind === 'start-end' ? 'EDE9FE' : 'FFFFFF' }, line: { color: '24104F', width: 1.2 } });
    slide.addText(node.label, { x: inch(object.geometry.x + node.x), y: inch(object.geometry.y + node.y), w: inch(node.width), h: inch(node.height), align: 'center', valign: 'mid', fontSize: 12, margin: 0.03, fit: 'shrink' } as any);
  }
  for (const connector of object.connectors) {
    const from = object.nodes.find((node) => node.id === connector.from); const to = object.nodes.find((node) => node.id === connector.to);
    if (!from || !to) continue;
    slide.addShape(pptx.ShapeType.line, { x: inch(object.geometry.x + from.x + from.width / 2), y: inch(object.geometry.y + from.y + from.height / 2), w: inch(to.x + to.width / 2 - from.x - from.width / 2), h: inch(to.y + to.height / 2 - from.y - from.height / 2), line: { color: '64748B', width: 1.2, endArrowType: 'triangle' } });
  }
}
export async function exportPresentationToPptx(document: PresentationDocument): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'MORIJA', width: 13.333333, height: 7.5 }); pptx.layout = 'MORIJA';
  pptx.author = document.metadata.author || 'Morija'; pptx.subject = document.metadata.title; pptx.title = document.metadata.title;
  for (const sourceSlide of document.slides) {
    const slide = pptx.addSlide(); slide.background = { color: sourceSlide.background.color.replace('#', '') };
    for (const object of [...sourceSlide.objects].sort((a, b) => a.geometry.zIndex - b.geometry.zIndex)) {
      if (object.type === 'text') addText(slide, object);
      else if (object.type === 'shape') addShape(slide, object, pptx);
      else if (object.type === 'image') { if (object.src.startsWith('data:')) slide.addImage({ data: object.src, x: inch(object.geometry.x), y: inch(object.geometry.y), w: inch(object.geometry.width), h: inch(object.geometry.height), transparency: object.style.opacity === undefined ? 0 : Math.round((1 - object.style.opacity) * 100) }); }
      else if (object.type === 'table') addTable(slide, object);
      else if (object.type === 'chart') addChart(slide, object, pptx);
      else if (object.type === 'diagram') addDiagram(slide, object, pptx);
    }
  }
  return (await pptx.write({ outputType: 'blob' } as any)) as Blob;
}
export async function validatePptxPackage(input: Blob | ArrayBuffer): Promise<{ valid: boolean; entries: string[]; error?: string }> {
  try { const zip = await JSZip.loadAsync(input); const entries = Object.keys(zip.files); const missing = ['[Content_Types].xml', 'ppt/presentation.xml'].filter((entry) => !zip.file(entry)); if (missing.length) return { valid: false, entries, error: 'Missing required Open XML parts: ' + missing.join(', ') }; if (!entries.some((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry))) return { valid: false, entries, error: 'The package contains no presentation slides' }; return { valid: true, entries }; } catch (error) { return { valid: false, entries: [], error: 'Invalid ZIP package: ' + (error instanceof Error ? error.message : 'unknown ZIP error') }; }
}
function parseShape(sp: any): TextObject | ShapeObject | null {
  const nv = sp?.nvSpPr?.cNvPr; const id = 'ppt-object-' + (attr(nv, 'id') || createStableId('object')); const geometry = geometryFromXfrm(sp?.spPr?.xfrm);
  const text = textOfParagraphs(sp?.txBody);
  if (text.trim()) return { id, type: 'text', geometry, style: { fontFamily: 'Arial', fontSize: 24, color: colorFromFill(sp?.spPr) || '#111111' }, text, runs: [{ text }], paragraphs: text.split('\n').map(() => ({ alignment: 'left', bullet: null })), verticalAlign: 'top', margins: { left: 8, right: 8, top: 6, bottom: 6 }, autofit: 'shrink-text' };
  return { id, type: 'shape', geometry, style: { shape: shapeKind(attr(sp?.spPr?.prstGeom, 'prst')), backgroundColor: colorFromFill(sp?.spPr) || '#ffffff', outlineColor: '#1e3a8a', outlineWidth: 1 } };
}
function parseTable(frame: any): TableObject | null {
  const table = frame?.graphic?.graphicData?.tbl; if (!table) return null; const rows = safeArray(table.tr).map((row: any, r) => safeArray(row.tc).map((cell: any, c) => ({ id: 'ppt-cell-' + r + '-' + c, text: textOfParagraphs(cell.txBody) }))); if (!rows.length || !rows[0]?.length) return null;
  return { id: 'ppt-table-' + createStableId('object'), type: 'table', geometry: geometryFromXfrm(frame?.xfrm, { x: 100, y: 120, width: 700, height: 260 }), rows: rows.length, columns: rows[0].length, cells: rows, headerRow: true, borderColor: '#64748b', borderWidth: 1 };
}
function parseChart(frame: any, chartXml: any): ChartObject | null {
  const chart = chartXml?.chartSpace?.chart; const plot = chart?.plotArea; if (!plot) return null; const chartType = plot.barChart ? 'bar' : plot.lineChart ? 'line' : plot.pieChart ? 'pie' : null; if (!chartType) return null; const first = safeArray((plot.barChart || plot.lineChart || plot.pieChart)?.ser)[0]; if (!first) return null;
  const labels = safeArray(first.cat?.strRef?.strCache?.pt).map((point: any) => childText(point.v)); const values = safeArray(first.val?.numRef?.numCache?.pt).map((point: any) => Number(childText(point.v)) || 0);
  return { id: 'ppt-chart-' + createStableId('object'), type: 'chart', geometry: geometryFromXfrm(frame?.xfrm, { x: 100, y: 120, width: 700, height: 300 }), chartType, title: childText(chart?.title) || 'Imported chart', data: values.map((value, index) => ({ label: labels[index] || String(index + 1), value })), color: '#24104f' };
}
async function readXml(zip: JSZip, path: string) { const file = zip.file(path); return file ? parser.parse(await file.async('text')) : null; }
function targetPath(source: string, target: string) { const base = source.slice(0, source.lastIndexOf('/') + 1); const path = target.startsWith('/') ? target.slice(1) : base + target; const parts: string[] = []; for (const part of path.split('/')) { if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part); } return parts.join('/'); }

export async function importPptx(input: Blob | ArrayBuffer): Promise<PptxImportResult> {
  const packageCheck = await validatePptxPackage(input); if (!packageCheck.valid) throw new Error(packageCheck.error || 'Invalid .pptx package');
  const zip = await JSZip.loadAsync(input); const presentationXml: any = await readXml(zip, 'ppt/presentation.xml'); const presentationRels: any = await readXml(zip, 'ppt/_rels/presentation.xml.rels');
  const slideIds = safeArray(presentationXml?.presentation?.sldIdLst?.sldId); const rels = safeArray(presentationRels?.Relationships?.Relationship);
  const slidePaths = slideIds.map((entry: any) => { const relationship = rels.find((rel: any) => attr(rel, 'Id') === attr(entry, 'r:id')); return relationship ? targetPath('ppt/presentation.xml', attr(relationship, 'Target') || '') : ''; }).filter(Boolean);
  const fallbackPaths = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0])); const orderedPaths = slidePaths.length ? slidePaths : fallbackPaths; if (!orderedPaths.length) throw new Error('No readable slides found in the .pptx package');
  const document = createPresentationDocument('Imported PowerPoint'); document.slides = []; const limitations = ['Slide transitions, animations, speaker notes, and unsupported Office-specific objects are approximated or omitted.', 'Imported diagrams become editable native shapes when the source does not expose a simple flowchart structure.'];
  for (const path of orderedPaths) {
    const xml: any = await readXml(zip, path); if (!xml?.sld?.cSld?.spTree) throw new Error('Malformed slide XML: ' + path);
    const relXml: any = await readXml(zip, path.replace('slides/slide', 'slides/_rels/slide').replace('.xml', '.xml.rels')); const relEntries = safeArray(relXml?.Relationships?.Relationship);
    const slide = { id: createStableId('slide'), layout: 'blank', background: { color: '#ffffff' }, objects: [], notes: { text: '', updatedAt: Date.now() }, comments: [], transition: { type: 'none', durationMs: 400 }, animations: [], hidden: false } as PresentationSlide; const tree = xml.sld.cSld.spTree; let zIndex = 0;
    for (const shape of safeArray(tree.sp)) { const object = parseShape(shape); if (object) { object.geometry.zIndex = zIndex++; slide.objects.push(object); } }
    for (const picture of safeArray(tree.pic)) { const id = 'ppt-image-' + createStableId('object'); const embed = attr(picture?.blipFill?.blip, 'embed'); const rel = relEntries.find((entry: any) => attr(entry, 'Id') === embed); const mediaPath = rel ? targetPath(path, attr(rel, 'Target') || '') : ''; const media = mediaPath ? zip.file(mediaPath) : null; const data = media ? await media.async('base64') : ''; const extension = mediaPath.split('.').pop() || 'png'; if (data) slide.objects.push({ id, type: 'image', geometry: { ...geometryFromXfrm(picture?.spPr?.xfrm), zIndex: zIndex++ }, style: { opacity: 1 }, src: 'data:image/' + extension + ';base64,' + data, alt: 'Imported image' }); else limitations.push('An image relationship could not be resolved on ' + path + '.'); }
    for (const frame of safeArray(tree.graphicFrame)) { const table = parseTable(frame); if (table) { table.geometry.zIndex = zIndex++; slide.objects.push(table); continue; } const chartRel = attr(frame?.graphic?.graphicData?.chart, 'id'); const chartEntry = relEntries.find((entry: any) => attr(entry, 'Id') === chartRel); if (chartEntry) { const chartPath = targetPath(path, attr(chartEntry, 'Target') || ''); const chart = parseChart(frame, await readXml(zip, chartPath)); if (chart) { chart.geometry.zIndex = zIndex++; slide.objects.push(chart); } else limitations.push('A chart on ' + path + ' was preserved only as an unsupported object.'); } }
    document.slides.push(slide);
  }
  if (!document.slides.length) throw new Error('The .pptx did not contain readable slides'); document.metadata.updatedAt = Date.now(); return { document, limitations };
}
