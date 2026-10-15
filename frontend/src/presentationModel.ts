export type SlideLayout =
  | 'title-slide'
  | 'title-and-content'
  | 'section-header'
  | 'two-content'
  | 'comparison'
  | 'title-only'
  | 'blank'
  | 'content-with-caption'
  | 'picture-with-caption';

export type TextSlideLayout = 'title-body' | 'title-only' | 'full-text' | 'scripture' | 'quote' | 'announcement';

export type TextAlign = 'left' | 'center' | 'right';
export type TextVerticalAlign = 'top' | 'middle' | 'bottom';
export type TextAutofit = 'none' | 'shrink-text' | 'resize-shape';

export type TextRun = {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
  link?: string;
};

export type TextParagraph = {
  alignment?: TextAlign;
  bullet?: 'bullet' | 'number' | null;
  indent?: number;
  lineSpacing?: number;
  paragraphSpacing?: number;
};

export type PresentationBackground = {
  color: string;
  imageUrl?: string;
  imageOpacity?: number;
};

export type PresentationTheme = {
  name: string;
  headingFont: string;
  bodyFont: string;
  accentColor: string;
  inkColor: string;
};

export type SlideNotes = {
  text: string;
  updatedAt: number;
};

export type SlideComment = {
  id: string;
  text: string;
  author: string;
  createdAt: number;
  resolved: boolean;
};

export type SupportedTransitionType = 'none' | 'fade' | 'push' | 'wipe';
export type SlideTransition = {
  type: SupportedTransitionType;
  durationMs: number;
};

export type SlideAnimation = {
  id: string;
  objectId: string;
  type: 'appear' | 'fade' | 'fly-in' | 'float-in' | 'zoom' | 'wipe';
  order: number;
  durationMs: number;
  delayMs: number;
  direction?: 'left' | 'right' | 'top' | 'bottom';
};

export type ObjectGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
};

export type ObjectStyle = {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: string;
  textAlign?: TextAlign;
  opacity?: number;
};

export type Placeholder = {
  kind: 'title' | 'subtitle' | 'body' | 'content' | 'caption';
  prompt: string;
};

export type TextObject = {
  id: string;
  type: 'text';
  geometry: ObjectGeometry;
  style: ObjectStyle;
  text: string;
  runs: TextRun[];
  paragraphs: TextParagraph[];
  verticalAlign: TextVerticalAlign;
  margins: { left: number; right: number; top: number; bottom: number };
  autofit: TextAutofit;
  html?: string;
  placeholder?: Placeholder;
};

export type ShapeObject = {
  id: string;
  type: 'shape';
  geometry: ObjectGeometry;
  style: ObjectStyle & { outlineColor?: string; outlineWidth?: number; shape: string };
  text?: string;
};

export type ImageObject = {
  id: string;
  type: 'image';
  geometry: ObjectGeometry;
  style: ObjectStyle;
  src: string;
  alt: string;
  crop?: { left: number; top: number; right: number; bottom: number };
  flipHorizontal?: boolean;
  flipVertical?: boolean;
};

export type MediaObjectBase = { id: string; geometry: ObjectGeometry; assetId: string; mimeType: string; name: string; assetSource?: 'indexeddb' | 'cloud' | 'embedded' | 'external'; assetUrl?: string; src?: string; error?: string };
export type AudioObject = MediaObjectBase & { type: 'audio'; autoplay?: boolean; loop?: boolean };
export type VideoObject = MediaObjectBase & { type: 'video'; autoplay?: boolean; loop?: boolean; muted?: boolean; poster?: string };

export type DrawingObject = {
  id: string;
  type: 'drawing';
  geometry: ObjectGeometry;
  points: Array<{ x: number; y: number }>;
  style: { color: string; width: number; opacity?: number };
};

export type TableCell = { id: string; text: string; style?: { backgroundColor?: string; color?: string; bold?: boolean; align?: TextAlign } };
export type TableObject = { id: string; type: 'table'; geometry: ObjectGeometry; rows: number; columns: number; cells: TableCell[][]; headerRow?: boolean; borderColor?: string; borderWidth?: number };
export type ChartPoint = { label: string; value: number };
export type ChartObject = { id: string; type: 'chart'; geometry: ObjectGeometry; chartType: 'bar' | 'line' | 'pie'; title: string; data: ChartPoint[]; color?: string };
export type DiagramNode = { id: string; label: string; kind: 'process' | 'decision' | 'start-end' | 'data'; x: number; y: number; width: number; height: number };
export type DiagramConnector = { id: string; from: string; to: string; label?: string };
export type DiagramObject = { id: string; type: 'diagram'; geometry: ObjectGeometry; layout: 'flowchart' | 'cycle' | 'hierarchy' | 'process'; nodes: DiagramNode[]; connectors: DiagramConnector[] };

export type GroupObject = {
  id: string;
  type: 'group';
  geometry: ObjectGeometry;
  childIds: string[];
  name?: string;
};

export type SlideObject = TextObject | ShapeObject | ImageObject | DrawingObject | GroupObject | TableObject | ChartObject | DiagramObject | AudioObject | VideoObject;

export type PresentationSlide = {
  id: string;
  layout: SlideLayout;
  background: PresentationBackground;
  objects: SlideObject[];
  notes: SlideNotes;
  comments: SlideComment[];
  transition: SlideTransition;
  animations: SlideAnimation[];
  rehearsalDurationMs?: number;
  hidden: boolean;
};

export type PresentationMetadata = {
  title: string;
  author: string;
  createdAt: number;
  updatedAt: number;
};

export type PresentationDocument = {
  version: 1;
  metadata: PresentationMetadata;
  slideSize: { width: number; height: number };
  theme: PresentationTheme;
  slides: PresentationSlide[];
};

export type PortablePresentationFile = {
  format: 'morija-presentation';
  version: 1;
  document: PresentationDocument;
};

export type TextSlideSource = {
  id: string;
  title: string;
  subtitle: string;
  bodyHtml: string;
  reference: string;
  layout: TextSlideLayout;
  presentationLayout?: SlideLayout;
  fontFamily: string;
  fontSize: number;
  titleFontSize: number;
  subtitleFontSize: number;
  textColor: string;
  titleColor: string;
  subtitleColor: string;
  highlightColor: string;
  titleAlign: TextAlign;
  subtitleAlign: TextAlign;
  bodyAlign: TextAlign;
  titleOffsetX: number;
  titleOffsetY: number;
  subtitleOffsetX: number;
  subtitleOffsetY: number;
  titleWidth: number;
  titleHeight: number;
  subtitleWidth: number;
  subtitleHeight: number;
  bodyWidth: number;
  bodyHeight: number;
  bodyOffsetX: number;
  bodyOffsetY: number;
  background: string;
  transitionType?: SupportedTransitionType;
  transitionDurationMs?: number;
  showTitle?: boolean;
  showSubtitle?: boolean;
  showBody?: boolean;
  objectIds?: { title?: string; subtitle?: string; body?: string };
  shapeObjects?: ShapeObject[];
  groupObjects?: GroupObject[];
  imageObjects?: ImageObject[];
  textObjects?: TextObject[];
  drawingObjects?: DrawingObject[];
  tableObjects?: TableObject[];
  chartObjects?: ChartObject[];
  diagramObjects?: DiagramObject[];
  audioObjects?: AudioObject[];
  videoObjects?: VideoObject[];
  comments?: SlideComment[];
  rehearsalDurationMs?: number;
  animationObjectIds?: string[];
  animations?: SlideAnimation[];
  updatedAt: number;
};

export function createStableId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function fitPresentationZoomPercent(availableWidth: number, availableHeight: number) {
  const usableWidth = Math.max(240, availableWidth - 32);
  const usableHeight = Math.max(180, availableHeight - 32);
  const naturalHeight = usableWidth * 720 / 1280;
  return Math.max(25, Math.min(150, Math.floor(Math.min(1, usableHeight / naturalHeight) * 100)));
}

export function isValidHyperlink(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}
export function createPresentationSlide(layout: SlideLayout = 'title-and-content'): PresentationSlide {
  const now = Date.now();
  const slide: PresentationSlide = {
    id: createStableId('slide'),
    layout,
    background: { color: '#ffffff' },
    objects: [],
    notes: { text: '', updatedAt: now },
    comments: [],
    transition: { type: 'none', durationMs: 400 },
    animations: [],
    hidden: false,
  };
  return applySlideLayoutToSlide(slide, layout);
}

export function createPresentationDocument(title = 'Presentation1'): PresentationDocument {
  const now = Date.now();
  return {
    version: 1,
    metadata: { title, author: '', createdAt: now, updatedAt: now },
    slideSize: { width: 1280, height: 720 },
    theme: { name: 'Morija Light', headingFont: 'Georgia', bodyFont: 'Arial', accentColor: '#fff000', inkColor: '#24104f' },
    slides: [createPresentationSlide('title-slide')],
  };
}

function textObject(id: string, text: string, geometry: ObjectGeometry, style: ObjectStyle, placeholder?: Placeholder, html?: string): TextObject {
  return { id, type: 'text', geometry, style, text, runs: [{ text, fontFamily: style.fontFamily, fontSize: style.fontSize, color: style.color, bold: style.fontWeight ? style.fontWeight >= 600 : false, italic: style.fontStyle === 'italic', underline: Boolean(style.textDecoration) }], paragraphs: text.split('\n').map(() => ({ alignment: style.textAlign || 'left', bullet: null, indent: 0, lineSpacing: 1.15, paragraphSpacing: 0 })), verticalAlign: 'top', margins: { left: 12, right: 12, top: 10, bottom: 10 }, autofit: 'shrink-text', html, placeholder };
}

const slideLayoutVisibility: Record<SlideLayout, { title: boolean; subtitle: boolean; body: boolean }> = {
  'title-slide': { title: true, subtitle: true, body: false },
  'title-and-content': { title: true, subtitle: false, body: true },
  'section-header': { title: true, subtitle: true, body: false },
  'two-content': { title: true, subtitle: true, body: true },
  comparison: { title: true, subtitle: true, body: true },
  'title-only': { title: true, subtitle: false, body: false },
  blank: { title: false, subtitle: false, body: false },
  'content-with-caption': { title: true, subtitle: true, body: true },
  'picture-with-caption': { title: true, subtitle: true, body: true },
};

type PlaceholderKind = 'title' | 'subtitle' | 'body';
type PlaceholderPreset = { x: number; y: number; width: number; height: number; align: TextAlign; fontSize: number; color: string };

export function slideLayoutPlaceholderPreset(layout: SlideLayout, kind: PlaceholderKind): PlaceholderPreset | null {
  const title: PlaceholderPreset = layout === 'title-slide'
    ? { x: 160, y: 120, width: 960, height: 130, align: 'center', fontSize: 44, color: '#24104f' }
    : { x: 64, y: 48, width: 1152, height: 100, align: 'left', fontSize: 44, color: '#24104f' };
  const subtitle: PlaceholderPreset = { x: 220, y: 300, width: 840, height: 72, align: 'center', fontSize: 22, color: '#4c4473' };
  const body: PlaceholderPreset = { x: 80, y: 180, width: 1120, height: 450, align: 'left', fontSize: 30, color: '#24104f' };
  if (!slideLayoutVisibility[layout][kind]) return null;
  return kind === 'title' ? title : kind === 'subtitle' ? subtitle : body;
}

function createPlaceholderTextObject(slide: PresentationSlide, layout: SlideLayout, kind: PlaceholderKind): TextObject | null {
  const preset = slideLayoutPlaceholderPreset(layout, kind);
  if (!preset) return null;
  const fontFamily = kind === 'title' || kind === 'subtitle' ? 'Georgia, serif' : 'Arial, sans-serif';
  return textObject(createStableId(kind), '', { x: preset.x, y: preset.y, width: preset.width, height: preset.height, rotation: 0, zIndex: kind === 'body' ? 1 : 2 }, { fontFamily, fontSize: preset.fontSize, color: preset.color, textAlign: preset.align, fontWeight: kind === 'title' ? 700 : 400 }, { kind, prompt: kind === 'title' ? 'Click to add a title' : kind === 'subtitle' ? 'Click to add a subtitle' : 'Click to add text' });
}

export function applySlideLayoutToSlide(slide: PresentationSlide, layout: SlideLayout): PresentationSlide {
  const next: PresentationSlide = { ...slide, layout, objects: [...slide.objects] };
  (['title', 'subtitle', 'body'] as PlaceholderKind[]).forEach((kind) => {
    const preset = slideLayoutPlaceholderPreset(layout, kind);
    const index = next.objects.findIndex((object) => object.type === 'text' && object.placeholder?.kind === kind);
    if (index < 0) {
      const created = createPlaceholderTextObject(next, layout, kind);
      if (created) next.objects.push(created);
      return;
    }
    if (!preset) return;
    const object = next.objects[index] as TextObject;
    next.objects[index] = { ...object, geometry: { ...object.geometry, x: preset.x, y: preset.y, width: preset.width, height: preset.height }, style: { ...object.style, textAlign: preset.align } };
  });
  return next;
}
export function textSlideToPresentationSlide(source: TextSlideSource): PresentationSlide {
  const presentationLayout = source.presentationLayout || (source.layout === 'title-body' ? 'title-and-content' : 'title-only');
  const slide = createPresentationSlide(presentationLayout);
  slide.id = source.id;
  // Keep the authored slide background verbatim.  The editor and audience
  // canvas both consume this value, so normalizing a valid color here would
  // make the projected slide diverge from the editing surface.
  slide.background = { color: source.background };
  const transitionType = source.transitionType === 'fade' || source.transitionType === 'push' || source.transitionType === 'wipe' ? source.transitionType : 'none';
  slide.transition = { ...slide.transition, type: transitionType, durationMs: Math.max(0, Math.min(3000, source.transitionDurationMs || slide.transition.durationMs)) };
  slide.objects.push(...(source.shapeObjects || []).map((shape) => JSON.parse(JSON.stringify(shape)) as ShapeObject));
  slide.objects.push(...(source.imageObjects || []).map((image) => JSON.parse(JSON.stringify(image)) as ImageObject));
  slide.objects.push(...(source.textObjects || []).map((text) => JSON.parse(JSON.stringify(text)) as TextObject));
  slide.objects.push(...(source.drawingObjects || []).map((drawing) => JSON.parse(JSON.stringify(drawing)) as DrawingObject));
  slide.objects.push(...(source.tableObjects || []).map((table) => JSON.parse(JSON.stringify(table)) as TableObject));
  slide.objects.push(...(source.chartObjects || []).map((chart) => JSON.parse(JSON.stringify(chart)) as ChartObject));
  slide.objects.push(...(source.diagramObjects || []).map((diagram) => JSON.parse(JSON.stringify(diagram)) as DiagramObject));
  slide.objects.push(...(source.audioObjects || []).map((audio) => JSON.parse(JSON.stringify(audio)) as AudioObject));
  slide.objects.push(...(source.videoObjects || []).map((video) => JSON.parse(JSON.stringify(video)) as VideoObject));
  slide.comments = JSON.parse(JSON.stringify(source.comments || [])) as SlideComment[];
  slide.rehearsalDurationMs = source.rehearsalDurationMs;
  slide.objects.push(...(source.groupObjects || []).map((group) => {
    const next = JSON.parse(JSON.stringify(group)) as GroupObject;
    next.geometry.x = Math.max(0, Math.min(next.geometry.x, 1280 - 24));
    next.geometry.y = Math.max(0, Math.min(next.geometry.y, 720 - 24));
    next.geometry.width = Math.max(24, Math.min(next.geometry.width, 1280 - next.geometry.x));
    next.geometry.height = Math.max(24, Math.min(next.geometry.height, 720 - next.geometry.y));
    return next;
  }));
  slide.animations = JSON.parse(JSON.stringify(source.animations || (source.animationObjectIds || []).map((objectId, index) => ({ id: createStableId('animation'), objectId, type: 'fade' as const, order: index, durationMs: 420, delayMs: 0 }))));
  slide.objects = slide.objects.filter((object) => !(object.type === 'text' && object.placeholder));
  const addPlaceholder = (kind: PlaceholderKind, include: boolean, text: string, html?: string) => {
    if (!include) return;
    const preset = slideLayoutPlaceholderPreset(presentationLayout, kind) || (kind === 'title'
      ? { x: 64 + source.titleOffsetX, y: 48 + source.titleOffsetY, width: source.titleWidth, height: source.titleHeight, align: source.titleAlign, fontSize: source.titleFontSize, color: source.titleColor }
      : kind === 'subtitle'
        ? { x: 128 + source.subtitleOffsetX, y: 190 + source.subtitleOffsetY, width: source.subtitleWidth, height: source.subtitleHeight, align: source.subtitleAlign, fontSize: source.subtitleFontSize, color: source.subtitleColor }
        : { x: 64 + source.bodyOffsetX, y: 260 + source.bodyOffsetY, width: source.bodyWidth, height: source.bodyHeight, align: source.bodyAlign, fontSize: source.fontSize, color: source.textColor });
    slide.objects.push(textObject(source.objectIds?.[kind] || createStableId(kind), text, { x: preset.x, y: preset.y, width: preset.width, height: preset.height, rotation: 0, zIndex: kind === 'body' ? 1 : 2 }, { fontFamily: source.fontFamily, fontSize: kind === 'title' ? source.titleFontSize : kind === 'subtitle' ? source.subtitleFontSize : source.fontSize, color: kind === 'title' ? source.titleColor : kind === 'subtitle' ? source.subtitleColor : source.textColor, textAlign: preset.align, fontWeight: kind === 'title' ? 700 : 400 }, { kind, prompt: kind === 'title' ? 'Click to add a title' : kind === 'subtitle' ? 'Click to add a subtitle' : 'Click to add text' }, html));
  };
  addPlaceholder('title', slideLayoutVisibility[presentationLayout].title || Boolean(source.title) || Boolean(source.objectIds?.title), source.title);
  addPlaceholder('subtitle', slideLayoutVisibility[presentationLayout].subtitle || Boolean(source.subtitle) || Boolean(source.objectIds?.subtitle), source.subtitle);
  addPlaceholder('body', slideLayoutVisibility[presentationLayout].body || Boolean(source.bodyHtml) || Boolean(source.objectIds?.body), source.bodyHtml.replace(/<[^>]+>/g, ' '), source.bodyHtml);
  return slide;
}

export function presentationSlideToTextSlide(slide: PresentationSlide, fallback: TextSlideSource): TextSlideSource {
  const title = slide.objects.find((object): object is TextObject => object.type === 'text' && object.placeholder?.kind === 'title');
  const subtitle = slide.objects.find((object): object is TextObject => object.type === 'text' && object.placeholder?.kind === 'subtitle');
  const body = slide.objects.find((object): object is TextObject => object.type === 'text' && object.placeholder?.kind === 'body');
  const shapeObjects = slide.objects.filter((object): object is ShapeObject => object.type === 'shape');
  const groupObjects = slide.objects.filter((object): object is GroupObject => object.type === 'group');
  const imageObjects = slide.objects.filter((object): object is ImageObject => object.type === 'image');
  const textObjects = slide.objects.filter((object): object is TextObject => object.type === 'text' && !object.placeholder);
  const drawingObjects = slide.objects.filter((object): object is DrawingObject => object.type === 'drawing');
  const tableObjects = slide.objects.filter((object): object is TableObject => object.type === 'table');
  const chartObjects = slide.objects.filter((object): object is ChartObject => object.type === 'chart');
  const diagramObjects = slide.objects.filter((object): object is DiagramObject => object.type === 'diagram');
  const audioObjects = slide.objects.filter((object): object is AudioObject => object.type === 'audio');
  const videoObjects = slide.objects.filter((object): object is VideoObject => object.type === 'video');
  const visibility = slideLayoutVisibility[slide.layout];
  const titleGeometry = title?.geometry || { x: 64, y: 48, width: 1152, height: 100 };
  const subtitleGeometry = subtitle?.geometry || { x: 128, y: 190, width: 922, height: 54 };
  const bodyGeometry = body?.geometry || { x: 64, y: 260, width: 1152, height: 260 };
  return {
    ...fallback,
    layout: slide.layout === 'title-and-content' || slide.layout === 'two-content' || slide.layout === 'comparison' || slide.layout === 'content-with-caption' || slide.layout === 'picture-with-caption' ? 'title-body' : slide.layout === 'title-only' || slide.layout === 'section-header' ? 'title-only' : 'full-text',
    presentationLayout: slide.layout,
    id: slide.id,
    title: title?.text || '',
    subtitle: subtitle?.text || '',
    bodyHtml: body?.html || body?.text || '',
    background: slide.background.color,
    transitionType: slide.transition?.type || 'none',
    transitionDurationMs: slide.transition?.durationMs || 400,
    animations: JSON.parse(JSON.stringify(slide.animations || [])) as SlideAnimation[],
    showTitle: Boolean(title) && visibility.title,
    showSubtitle: Boolean(subtitle) && visibility.subtitle,
    showBody: Boolean(body) && visibility.body,
    titleOffsetX: titleGeometry.x - 64,
    titleOffsetY: titleGeometry.y - 48,
    subtitleOffsetX: subtitleGeometry.x - 128,
    subtitleOffsetY: subtitleGeometry.y - 190,
    bodyOffsetX: bodyGeometry.x - 64,
    bodyOffsetY: bodyGeometry.y - 260,
    titleWidth: titleGeometry.width / 1280 * 100,
    titleHeight: titleGeometry.height,
    subtitleWidth: subtitleGeometry.width / 1280 * 100,
    subtitleHeight: subtitleGeometry.height,
    bodyWidth: bodyGeometry.width / 1280 * 100,
    bodyHeight: bodyGeometry.height,
    objectIds: { title: title?.id, subtitle: subtitle?.id, body: body?.id },
    shapeObjects: JSON.parse(JSON.stringify(shapeObjects)) as ShapeObject[],
    groupObjects: JSON.parse(JSON.stringify(groupObjects)) as GroupObject[],
    imageObjects: JSON.parse(JSON.stringify(imageObjects)) as ImageObject[],
    textObjects: JSON.parse(JSON.stringify(textObjects)) as TextObject[],
    drawingObjects: JSON.parse(JSON.stringify(drawingObjects)) as DrawingObject[],
    tableObjects: JSON.parse(JSON.stringify(tableObjects)) as TableObject[],
    chartObjects: JSON.parse(JSON.stringify(chartObjects)) as ChartObject[],
    diagramObjects: JSON.parse(JSON.stringify(diagramObjects)) as DiagramObject[],
    audioObjects: JSON.parse(JSON.stringify(audioObjects)) as AudioObject[],
    videoObjects: JSON.parse(JSON.stringify(videoObjects)) as VideoObject[],
    comments: JSON.parse(JSON.stringify(slide.comments || [])) as SlideComment[],
    rehearsalDurationMs: slide.rehearsalDurationMs,
    animationObjectIds: (slide.animations || []).filter((animation) => animation.type === 'fade').sort((a, b) => a.order - b.order).map((animation) => animation.objectId),
    updatedAt: Date.now(),
  };
}

export function clonePresentationDocument(document: PresentationDocument): PresentationDocument {
  return JSON.parse(JSON.stringify(document)) as PresentationDocument;
}

export function serializePresentationDocument(document: PresentationDocument) {
  const errors = validatePresentationDocument(document);
  if (errors.length) throw new Error(errors.join('; '));
  const file: PortablePresentationFile = { format: 'morija-presentation', version: 1, document: clonePresentationDocument(document) };
  return JSON.stringify(file, null, 2);
}

export function parsePresentationDocument(input: string | unknown): PresentationDocument {
  let value: unknown = input;
  if (typeof input === 'string') value = JSON.parse(input) as unknown;
  const file = value && typeof value === 'object' && 'format' in value
    ? value as Partial<PortablePresentationFile>
    : { format: 'morija-presentation', version: 1, document: value } as Partial<PortablePresentationFile>;
  if (file.format !== 'morija-presentation' || file.version !== 1 || !file.document) throw new Error('Unsupported presentation file format or version');
  const document = clonePresentationDocument(file.document as PresentationDocument);
  for (const slide of document.slides || []) {
    if (!slide.transition || !['none', 'fade', 'push', 'wipe'].includes(slide.transition.type)) slide.transition = { type: 'none', durationMs: 400 };
    slide.animations = (slide.animations || []).filter((animation) => ['appear', 'fade', 'fly-in'].includes(animation.type) && slide.objects.some((object) => object.id === animation.objectId));
  }
  const errors = validatePresentationDocument(document);
  if (errors.length) throw new Error(errors.join('; '));
  return document;
}

export function validatePresentationDocument(document: PresentationDocument): string[] {
  const errors: string[] = [];
  if (!document || typeof document !== 'object') return ['Invalid presentation document'];
  if (document.version !== 1) errors.push('Unsupported document version');
  if (!Array.isArray(document.slides) || !document.slides.length) errors.push('A presentation must contain at least one slide');
  const slideIds = new Set<string>();
  for (const slide of document.slides || []) {
    if (!slide || typeof slide !== 'object' || typeof slide.id !== 'string' || !Array.isArray(slide.objects)) {
      errors.push('Invalid slide structure');
      continue;
    }
    if (slideIds.has(slide.id)) errors.push(`Duplicate slide id: ${slide.id}`);
    slideIds.add(slide.id);
if (slide.transition && !['none', 'fade', 'push', 'wipe'].includes(slide.transition.type)) errors.push(`Unsupported transition type on slide: ${slide.id}`);
    if (slide.transition && (!Number.isFinite(slide.transition.durationMs) || slide.transition.durationMs < 0)) errors.push(`Invalid transition duration on slide: ${slide.id}`);
    const objectIds = new Set<string>();
    for (const object of slide.objects || []) {
      if (!object || typeof object !== 'object' || typeof object.id !== 'string' || !object.geometry) {
        errors.push('Invalid object structure');
        continue;
      }
      if (objectIds.has(object.id)) errors.push(`Duplicate object id: ${object.id}`);
      objectIds.add(object.id);
      if (object.geometry.width < 0 || object.geometry.height < 0) errors.push(`Invalid dimensions for object: ${object.id}`);
      if (object.type === 'table') {
        if (object.rows < 1 || object.columns < 1 || object.cells.length !== object.rows || object.cells.some((row) => row.length !== object.columns)) errors.push('Invalid table dimensions for object: ' + object.id);
        if (object.cells.some((row) => row.some((cell) => !cell || typeof cell.id !== 'string'))) errors.push('Invalid table cells for object: ' + object.id);
      }
      if (object.type === 'chart' && (!Array.isArray(object.data) || object.data.some((point) => typeof point.label !== 'string' || !Number.isFinite(point.value)))) errors.push('Invalid chart data for object: ' + object.id);
      if ((object.type === 'audio' || object.type === 'video') && (!object.assetId || !object.mimeType || !object.name)) errors.push('Invalid media metadata for object: ' + object.id);
      if (object.type === 'audio' && !object.mimeType.startsWith('audio/')) errors.push('Invalid audio MIME type for object: ' + object.id);
      if (object.type === 'video' && !object.mimeType.startsWith('video/')) errors.push('Invalid video MIME type for object: ' + object.id);
      if (object.type === 'diagram') {
        const nodeIds = new Set(object.nodes.map((node) => node.id));
        if (object.nodes.some((node) => !node.id || !node.label) || object.connectors.some((connector) => !nodeIds.has(connector.from) || !nodeIds.has(connector.to))) errors.push('Invalid diagram references for object: ' + object.id);
      }
      if (object.type === 'text') {
        for (const run of object.runs || []) if (run.link && !isValidHyperlink(run.link)) errors.push(`Invalid hyperlink for object: ${object.id}`);
      }
    }
    for (const object of slide.objects || []) {
      if (!object || typeof object !== 'object' || object.type !== 'group') continue;
      if (!Array.isArray(object.childIds)) {
        errors.push(`Invalid group children for group ${object.id}`);
        continue;
      }
      for (const childId of object.childIds) {
        if (!objectIds.has(childId)) errors.push(`Missing group child ${childId} in group ${object.id}`);
        if (childId === object.id) errors.push(`Group cannot contain itself: ${object.id}`);
      }
    }
    for (const animation of slide.animations || []) {
      if (!animation || typeof animation.id !== 'string' || !objectIds.has(animation.objectId)) errors.push(`Invalid animation target on slide: ${slide.id}`);
      if (!['appear', 'fade', 'fly-in'].includes(animation.type)) errors.push(`Unsupported animation type on slide: ${slide.id}`);
      if (!Number.isFinite(animation.durationMs) || animation.durationMs < 0 || !Number.isFinite(animation.delayMs) || animation.delayMs < 0) errors.push(`Invalid animation timing on slide: ${slide.id}`);
    }
  }
  return errors;
}
