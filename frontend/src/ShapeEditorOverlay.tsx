import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { createStableId, type GroupObject, type ImageObject, type ShapeObject, type TextObject } from './presentationModel';
import { flipGroup, rotateGroup, rotateShapes } from './objectManipulationCommands';

export type ShapeKind = 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'triangle' | 'diamond' | 'line' | 'arrow' | 'star' | 'heart' | 'chevron' | 'callout';
type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };
type Gesture = { kind: 'insert' | 'move' | 'resize' | 'rotate' | 'select' | 'group' | 'group-resize' | 'group-rotate'; id?: string; groupId?: string; corner?: string; start: Point; originals: ShapeObject[]; originalImages: ImageObject[]; originalTexts: TextObject[]; originalGroups: GroupObject[]; selection: string[]; pointerId: number; target: HTMLElement };
type Menu = { x: number; y: number } | null;

const W = 1280;
const H = 720;
const clone = <T,>(value: T) => JSON.parse(JSON.stringify(value)) as T;

export function ShapeEditorOverlay({ shapes, images = [], texts = [], groups = [], selectedIds = [], selectedGroupIds = [], insertKind, snapEnabled = true, onChange, onSelectionChange, onGroupSelectionChange, onInsertComplete, onUndo, onRedo }: { shapes: ShapeObject[]; images?: ImageObject[]; texts?: TextObject[]; groups?: GroupObject[]; selectedIds?: string[]; selectedGroupIds?: string[]; insertKind: ShapeKind | null; snapEnabled?: boolean; onChange: (shapes: ShapeObject[], groups?: GroupObject[], images?: ImageObject[], texts?: TextObject[]) => void; onSelectionChange: (ids: string[], additive?: boolean) => void; onGroupSelectionChange?: (ids: string[]) => void; onInsertComplete?: () => void; onUndo?: () => void; onRedo?: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const clipboard = useRef<ShapeObject[]>([]);
  const clipboardImages = useRef<ImageObject[]>([]);
  const clipboardTexts = useRef<TextObject[]>([]);
  const clipboardGroups = useRef<GroupObject[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<ShapeObject[] | null>(null);
  const [preview, setPreview] = useState<Box | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [guides, setGuides] = useState<{ axis: 'x' | 'y'; value: number }[]>([]);
  const rendered = draft || shapes;
  useEffect(() => { setSelected(selectedIds); }, [selectedIds.join('|')]);
  useEffect(() => { setSelectedGroups(selectedGroupIds); }, [selectedGroupIds.join('|')]);

  function choose(ids: string[], additive = false) { setSelected(ids); setSelectedGroups([]); onSelectionChange(ids, additive); onGroupSelectionChange?.([]); setMenu(null); }
  function chooseGroup(id: string) { setSelected([]); setSelectedGroups([id]); onSelectionChange([]); onGroupSelectionChange?.([id]); setMenu(null); }
  function point(event: PointerEvent | ReactPointerEvent) { const rect = ref.current?.getBoundingClientRect(); if (!rect) return { x: 0, y: 0 }; return { x: (event.clientX - rect.left) / rect.width * W, y: (event.clientY - rect.top) / rect.height * H }; }
  function commit(next: ShapeObject[]) { setDraft(null); onChange(clone(next), undefined, images, texts); }

  function finish() {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'insert' && preview && preview.width >= 8 && preview.height >= 8) {
      const id = createStableId('shape');
      const zIndex = Math.max(0, ...shapes.map((shape) => shape.geometry.zIndex)) + 1;
      const shape: ShapeObject = { id, type: 'shape', geometry: { ...preview, rotation: 0, zIndex }, style: { shape: insertKind || 'rectangle', backgroundColor: '#dbeafe', outlineColor: '#1e3a8a', outlineWidth: 2, opacity: 1 } };
      commit([...shapes, shape]); choose([id]); onInsertComplete?.();
    } else if (g.kind === 'select' && preview) {
      const ids = shapes.filter((shape) => shape.geometry.x >= preview.x && shape.geometry.y >= preview.y && shape.geometry.x + shape.geometry.width <= preview.x + preview.width && shape.geometry.y + shape.geometry.height <= preview.y + preview.height).map((shape) => shape.id);
      choose(ids);
    } else if ((g.kind === 'group' || g.kind === 'group-resize' || g.kind === 'group-rotate') && g.groupId) {
      const dx = preview?.x || 0;
      const dy = preview?.y || 0;
      const group = g.originalGroups.find((item) => item.id === g.groupId);
      if (group) {
        const ids = new Set(group.childIds);
        let nextShapes = g.originals;
        let nextImages = g.originalImages;
        let nextTexts = g.originalTexts;
        let nextGroup = group;
        if (g.kind === 'group') {
          nextShapes = g.originals.map((shape) => ids.has(shape.id) ? { ...shape, geometry: { ...shape.geometry, x: shape.geometry.x + dx, y: shape.geometry.y + dy } } : shape);
          nextImages = g.originalImages.map((image) => ids.has(image.id) ? { ...image, geometry: { ...image.geometry, x: image.geometry.x + dx, y: image.geometry.y + dy } } : image);
          nextTexts = g.originalTexts.map((text) => ids.has(text.id) ? { ...text, geometry: { ...text.geometry, x: text.geometry.x + dx, y: text.geometry.y + dy } } : text);
          nextGroup = { ...group, geometry: { ...group.geometry, x: group.geometry.x + dx, y: group.geometry.y + dy } };
        } else if (g.kind === 'group-resize') {
          const c = g.corner || ''; const original = group.geometry; const minSize = 24;
          const left = c.includes('left') ? Math.min(original.x + dx, original.x + original.width - minSize) : original.x;
          const top = c.includes('top') ? Math.min(original.y + dy, original.y + original.height - minSize) : original.y;
          const right = c.includes('right') ? Math.max(original.x + original.width + dx, left + minSize) : original.x + original.width;
          const bottom = c.includes('bottom') ? Math.max(original.y + original.height + dy, top + minSize) : original.y + original.height;
          const sx = (right - left) / Math.max(original.width, 1); const sy = (bottom - top) / Math.max(original.height, 1);
          nextShapes = g.originals.map((shape) => ids.has(shape.id) ? { ...shape, geometry: { ...shape.geometry, x: left + (shape.geometry.x - original.x) * sx, y: top + (shape.geometry.y - original.y) * sy, width: Math.max(12, shape.geometry.width * sx), height: Math.max(12, shape.geometry.height * sy) } } : shape);
          nextImages = g.originalImages.map((image) => ids.has(image.id) ? { ...image, geometry: { ...image.geometry, x: left + (image.geometry.x - original.x) * sx, y: top + (image.geometry.y - original.y) * sy, width: Math.max(12, image.geometry.width * sx), height: Math.max(12, image.geometry.height * sy) } } : image);
          nextTexts = g.originalTexts.map((text) => ids.has(text.id) ? { ...text, geometry: { ...text.geometry, x: left + (text.geometry.x - original.x) * sx, y: top + (text.geometry.y - original.y) * sy, width: Math.max(24, text.geometry.width * sx), height: Math.max(24, text.geometry.height * sy) } } : text);
          nextGroup = { ...group, geometry: { ...group.geometry, x: left, y: top, width: right - left, height: bottom - top } };
        } else {
          const cx = group.geometry.x + group.geometry.width / 2; const cy = group.geometry.y + group.geometry.height / 2;
          const delta = Math.atan2((preview?.y || g.start.y) - cy, (preview?.x || g.start.x) - cx);
          const currentAngle = Math.atan2(g.start.y - cy, g.start.x - cx); const radians = delta - currentAngle;
          nextShapes = g.originals.map((shape) => { if (!ids.has(shape.id)) return shape; const sx = shape.geometry.x + shape.geometry.width / 2 - cx; const sy = shape.geometry.y + shape.geometry.height / 2 - cy; return { ...shape, geometry: { ...shape.geometry, x: cx + sx * Math.cos(radians) - sy * Math.sin(radians) - shape.geometry.width / 2, y: cy + sx * Math.sin(radians) + sy * Math.cos(radians) - shape.geometry.height / 2, rotation: shape.geometry.rotation + radians * 180 / Math.PI } }; });
          nextImages = g.originalImages.map((image) => { if (!ids.has(image.id)) return image; const sx = image.geometry.x + image.geometry.width / 2 - cx; const sy = image.geometry.y + image.geometry.height / 2 - cy; return { ...image, geometry: { ...image.geometry, x: cx + sx * Math.cos(radians) - sy * Math.sin(radians) - image.geometry.width / 2, y: cy + sx * Math.sin(radians) + sy * Math.cos(radians) - image.geometry.height / 2, rotation: image.geometry.rotation + radians * 180 / Math.PI } }; });
          nextTexts = g.originalTexts.map((text) => { if (!ids.has(text.id)) return text; const sx = text.geometry.x + text.geometry.width / 2 - cx; const sy = text.geometry.y + text.geometry.height / 2 - cy; return { ...text, geometry: { ...text.geometry, x: cx + sx * Math.cos(radians) - sy * Math.sin(radians) - text.geometry.width / 2, y: cy + sx * Math.sin(radians) + sy * Math.cos(radians) - text.geometry.height / 2, rotation: text.geometry.rotation + radians * 180 / Math.PI } }; });
          nextGroup = { ...group, geometry: { ...group.geometry, rotation: group.geometry.rotation + radians * 180 / Math.PI } };
        }
        const nextGroups = g.originalGroups.map((item) => item.id === g.groupId ? nextGroup : item);
        onChange(nextShapes, nextGroups, nextImages, nextTexts);
      }
    } else if (draft) commit(draft);
    try { g.target.releasePointerCapture(g.pointerId); } catch { /* pointer capture may already be released */ }
    gesture.current = null; setDraft(null); setPreview(null);
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish); setGuides([]);
  }

  function move(event: PointerEvent) {
    const g = gesture.current; if (!g) return;
    const current = point(event); const dx = current.x - g.start.x; const dy = current.y - g.start.y;
    if (g.kind === 'insert' || g.kind === 'select') { setPreview({ x: Math.min(g.start.x, current.x), y: Math.min(g.start.y, current.y), width: Math.abs(dx), height: Math.abs(dy) }); return; }
    if (g.kind === 'group' || g.kind === 'group-resize') {
      let effectiveDx = dx;
      let effectiveDy = dy;
      const nextGuides: { axis: 'x' | 'y'; value: number }[] = [];
      if (snapEnabled && g.kind === 'group' && g.groupId) {
        const movingGroup = g.originalGroups.find((item) => item.id === g.groupId);
        if (movingGroup) {
          const childIds = new Set(movingGroup.childIds);
          const other = g.originals.filter((shape) => !childIds.has(shape.id));
          const candidatesX = [0, W / 2, W, ...other.flatMap((shape) => [shape.geometry.x, shape.geometry.x + shape.geometry.width / 2, shape.geometry.x + shape.geometry.width])];
          const candidatesY = [0, H / 2, H, ...other.flatMap((shape) => [shape.geometry.y, shape.geometry.y + shape.geometry.height / 2, shape.geometry.y + shape.geometry.height])];
          const movingX = [movingGroup.geometry.x + dx, movingGroup.geometry.x + movingGroup.geometry.width / 2 + dx, movingGroup.geometry.x + movingGroup.geometry.width + dx];
          const movingY = [movingGroup.geometry.y + dy, movingGroup.geometry.y + movingGroup.geometry.height / 2 + dy, movingGroup.geometry.y + movingGroup.geometry.height + dy];
          const snapX = candidatesX.map((value) => ({ value, delta: value - movingX.reduce((best, current) => Math.abs(current - value) < Math.abs(best - value) ? current : best, movingX[0]) })).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
          const snapY = candidatesY.map((value) => ({ value, delta: value - movingY.reduce((best, current) => Math.abs(current - value) < Math.abs(best - value) ? current : best, movingY[0]) })).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
          if (snapX && Math.abs(snapX.delta) <= 10) { effectiveDx += snapX.delta; nextGuides.push({ axis: 'x', value: snapX.value }); }
          if (snapY && Math.abs(snapY.delta) <= 10) { effectiveDy += snapY.delta; nextGuides.push({ axis: 'y', value: snapY.value }); }
        }
      }
      setGuides(nextGuides);
      setPreview({ x: effectiveDx, y: effectiveDy, width: 0, height: 0 });
      return;
    }
    if (g.kind === 'group-rotate') { setPreview({ x: current.x, y: current.y, width: 0, height: 0 }); return; }
    let effectiveDx = dx; let effectiveDy = dy; const nextGuides: { axis: 'x' | 'y'; value: number }[] = [];
    if (snapEnabled && g.kind === 'move' && g.selection.length === 1) {
      const moving = g.originals.find((shape) => shape.id === g.selection[0]);
      if (moving) {
        const other = g.originals.filter((shape) => shape.id !== moving.id);
        const candidatesX = [0, W / 2, W, ...other.flatMap((shape) => [shape.geometry.x, shape.geometry.x + shape.geometry.width / 2, shape.geometry.x + shape.geometry.width])];
        const candidatesY = [0, H / 2, H, ...other.flatMap((shape) => [shape.geometry.y, shape.geometry.y + shape.geometry.height / 2, shape.geometry.y + shape.geometry.height])];
        const movingX = [moving.geometry.x + dx, moving.geometry.x + moving.geometry.width / 2 + dx, moving.geometry.x + moving.geometry.width + dx];
        const movingY = [moving.geometry.y + dy, moving.geometry.y + moving.geometry.height / 2 + dy, moving.geometry.y + moving.geometry.height + dy];
        const snapX = candidatesX.map((value) => ({ value, delta: value - movingX.reduce((best, current) => Math.abs(current - value) < Math.abs(best - value) ? current : best, movingX[0]) })).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
        const snapY = candidatesY.map((value) => ({ value, delta: value - movingY.reduce((best, current) => Math.abs(current - value) < Math.abs(best - value) ? current : best, movingY[0]) })).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
        if (snapX && Math.abs(snapX.delta) <= 10) { effectiveDx += snapX.delta; nextGuides.push({ axis: 'x', value: snapX.value }); }
        if (snapY && Math.abs(snapY.delta) <= 10) { effectiveDy += snapY.delta; nextGuides.push({ axis: 'y', value: snapY.value }); }
      }
    }
    const next = g.originals.map((shape) => {
      if (!g.selection.includes(shape.id)) return shape;
      const geometry = { ...shape.geometry };
      if (g.kind === 'move') { geometry.x += effectiveDx; geometry.y += effectiveDy; }
      if (g.kind === 'resize') {
        const c = g.corner || '';
        const minSize = 12;
        const aspect = shape.geometry.width / Math.max(shape.geometry.height, minSize);
        if (c.includes('right')) geometry.width = Math.max(minSize, shape.geometry.width + dx);
        if (c.includes('bottom')) geometry.height = Math.max(minSize, shape.geometry.height + dy);
        if (c.includes('left')) { const width = Math.max(minSize, shape.geometry.width - dx); geometry.x = shape.geometry.x + shape.geometry.width - width; geometry.width = width; }
        if (c.includes('top')) { const height = Math.max(minSize, shape.geometry.height - dy); geometry.y = shape.geometry.y + shape.geometry.height - height; geometry.height = height; }
        if (event.shiftKey && (c.includes('left') || c.includes('right') || c.includes('top') || c.includes('bottom'))) {
          const widthDriven = Math.abs(dx) >= Math.abs(dy);
          const constrainedWidth = widthDriven ? geometry.width : geometry.height * aspect;
          const constrainedHeight = widthDriven ? geometry.width / Math.max(aspect, 0.01) : geometry.height;
          if (c.includes('left')) geometry.x = shape.geometry.x + shape.geometry.width - constrainedWidth;
          if (c.includes('top')) geometry.y = shape.geometry.y + shape.geometry.height - constrainedHeight;
          geometry.width = Math.max(minSize, constrainedWidth);
          geometry.height = Math.max(minSize, constrainedHeight);
        }
      }
      if (g.kind === 'rotate') { const cx = shape.geometry.x + shape.geometry.width / 2; const cy = shape.geometry.y + shape.geometry.height / 2; let angle = Math.atan2(current.y - cy, current.x - cx) * 180 / Math.PI + 90; if (event.shiftKey) angle = Math.round(angle / 15) * 15; geometry.rotation = angle; }
      return { ...shape, geometry };
    });
    setGuides(nextGuides); setDraft(next);
  }

  function begin(kind: Gesture['kind'], event: ReactPointerEvent, id?: string, corner?: string) {
    event.preventDefault(); event.stopPropagation(); setMenu(null);
    let selection = selected;
    if (id && event.shiftKey) selection = selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
    else if (id && !selected.includes(id)) selection = [id];
    if (id) choose(selection);
    const start = point(event);
    const target = event.currentTarget as HTMLElement;
    try { target.setPointerCapture(event.pointerId); } catch { /* capture is unavailable in some embedded browsers */ }
    gesture.current = { kind, id, corner, start, originals: clone(shapes), originalImages: clone(images), originalTexts: clone(texts), originalGroups: clone(groups), selection, pointerId: event.pointerId, target };
    if (kind === 'select') setPreview({ x: start.x, y: start.y, width: 0, height: 0 });
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish);
  }

  function beginBackground(event: ReactPointerEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('.shape-object, .shape-context-menu, .shape-rotate-handle, .shape-handle')) return;
    choose([]);
    begin(insertKind ? 'insert' : 'select', event);
  }

  function duplicate() {
    if (selectedGroups.length) {
      const group = groups.find((item) => item.id === selectedGroups[0]); if (!group) return;
      const idMap = new Map(group.childIds.map((id) => [id, createStableId(shapes.some((shape) => shape.id === id) ? 'shape' : images.some((image) => image.id === id) ? 'image' : 'text')]));
      const groupId = createStableId('group');
      const copies = shapes.filter((shape) => idMap.has(shape.id)).map((shape) => ({ ...clone(shape), id: idMap.get(shape.id)!, geometry: { ...shape.geometry, x: shape.geometry.x + 16, y: shape.geometry.y + 16, zIndex: Math.max(...shapes.map((item) => item.geometry.zIndex), ...images.map((item) => item.geometry.zIndex), 0) + 1 } }));
      const imageCopies = images.filter((image) => idMap.has(image.id)).map((image) => ({ ...clone(image), id: idMap.get(image.id)!, geometry: { ...image.geometry, x: image.geometry.x + 16, y: image.geometry.y + 16, zIndex: Math.max(...shapes.map((item) => item.geometry.zIndex), ...images.map((item) => item.geometry.zIndex), 0) + 1 } }));
      const textCopies = texts.filter((text) => idMap.has(text.id)).map((text) => ({ ...clone(text), id: idMap.get(text.id)!, geometry: { ...text.geometry, x: text.geometry.x + 16, y: text.geometry.y + 16, zIndex: Math.max(...shapes.map((item) => item.geometry.zIndex), ...images.map((item) => item.geometry.zIndex), ...texts.map((item) => item.geometry.zIndex), 0) + 1 } }));
      const copyGroup = { ...clone(group), id: groupId, childIds: [...copies, ...imageCopies, ...textCopies].map((item) => item.id), geometry: { ...group.geometry, x: group.geometry.x + 16, y: group.geometry.y + 16, zIndex: group.geometry.zIndex + 1 } };
      onChange([...shapes, ...copies], [...groups, copyGroup], [...images, ...imageCopies], [...texts, ...textCopies]); chooseGroup(groupId); return;
    }
    const copies = shapes.filter((shape) => selected.includes(shape.id)).map((shape) => ({ ...clone(shape), id: createStableId('shape'), geometry: { ...shape.geometry, x: shape.geometry.x + 16, y: shape.geometry.y + 16, zIndex: Math.max(...shapes.map((item) => item.geometry.zIndex), ...images.map((item) => item.geometry.zIndex), 0) + 1 } }));
    if (copies.length) { commit([...shapes, ...copies]); choose(copies.map((shape) => shape.id)); }
  }
  function remove() {
    if (selectedGroups.length) { const ids = new Set(groups.filter((group) => selectedGroups.includes(group.id)).flatMap((group) => group.childIds)); onChange(shapes.filter((shape) => !ids.has(shape.id)), groups.filter((group) => !selectedGroups.includes(group.id)), images.filter((image) => !ids.has(image.id)), texts.filter((text) => !ids.has(text.id))); choose([]); }
    else if (selected.length) { onChange(shapes.filter((shape) => !selected.includes(shape.id)), undefined, images); choose([]); }
  }
  function arrange(direction: 'front' | 'forward' | 'backward' | 'back') {
    if (!selected.length) return;
    const ordered = [...shapes].sort((a, b) => a.geometry.zIndex - b.geometry.zIndex);
    const selectedSet = new Set(selected);
    if (direction === 'front') {
      const moving = ordered.filter((shape) => selectedSet.has(shape.id));
      commit([...ordered.filter((shape) => !selectedSet.has(shape.id)), ...moving].map((shape, index) => ({ ...shape, geometry: { ...shape.geometry, zIndex: index } })));
      return;
    }
    if (direction === 'back') {
      const moving = ordered.filter((shape) => selectedSet.has(shape.id));
      commit([...moving, ...ordered.filter((shape) => !selectedSet.has(shape.id))].map((shape, index) => ({ ...shape, geometry: { ...shape.geometry, zIndex: index } })));
      return;
    }
    const step = direction === 'forward' ? 1 : -1;
    const next = [...ordered];
    if (step > 0) {
      for (let index = next.length - 2; index >= 0; index -= 1) {
        if (selectedSet.has(next[index].id) && !selectedSet.has(next[index + 1].id)) [next[index], next[index + 1]] = [next[index + 1], next[index]];
      }
    } else {
      for (let index = 1; index < next.length; index += 1) {
        if (selectedSet.has(next[index].id) && !selectedSet.has(next[index - 1].id)) [next[index], next[index - 1]] = [next[index - 1], next[index]];
      }
    }
    commit(next.map((shape, index) => ({ ...shape, geometry: { ...shape.geometry, zIndex: index } })));
  }
  function contextAction(action: string) {
    if (action === 'copy') { clipboard.current = clone(shapes.filter((shape) => selected.includes(shape.id))); clipboardImages.current = clone(images.filter((image) => selected.includes(image.id))); clipboardTexts.current = clone(texts.filter((text) => selected.includes(text.id))); clipboardGroups.current = clone(groups.filter((group) => selectedGroups.includes(group.id))); }
    if (action === 'cut') { clipboard.current = clone(shapes.filter((shape) => selected.includes(shape.id))); clipboardImages.current = clone(images.filter((image) => selected.includes(image.id))); clipboardTexts.current = clone(texts.filter((text) => selected.includes(text.id))); clipboardGroups.current = clone(groups.filter((group) => selectedGroups.includes(group.id))); if (selectedGroups.length) { const ids = new Set(clipboardGroups.current.flatMap((group) => group.childIds)); onChange(shapes.filter((shape) => !ids.has(shape.id)), groups.filter((group) => !selectedGroups.includes(group.id)), images.filter((image) => !ids.has(image.id)), texts.filter((text) => !ids.has(text.id))); choose([]); } else remove(); }
    if (action === 'paste') {
      if (clipboardGroups.current.length) { const ids = new Map(clipboardGroups.current[0].childIds.map((id) => [id, createStableId(shapes.some((shape) => shape.id === id) ? 'shape' : images.some((image) => image.id === id) ? 'image' : 'text')])); const copies = clipboard.current.filter((shape) => ids.has(shape.id)).map((shape) => ({ ...clone(shape), id: ids.get(shape.id)!, geometry: { ...shape.geometry, x: shape.geometry.x + 16, y: shape.geometry.y + 16 } })); const imageCopies = clipboardImages.current.filter((image) => ids.has(image.id)).map((image) => ({ ...clone(image), id: ids.get(image.id)!, geometry: { ...image.geometry, x: image.geometry.x + 16, y: image.geometry.y + 16 } })); const textCopies = clipboardTexts.current.filter((text) => ids.has(text.id)).map((text) => ({ ...clone(text), id: ids.get(text.id)!, geometry: { ...text.geometry, x: text.geometry.x + 16, y: text.geometry.y + 16 } })); const group = { ...clone(clipboardGroups.current[0]), id: createStableId('group'), childIds: [...copies, ...imageCopies, ...textCopies].map((item) => item.id), geometry: { ...clipboardGroups.current[0].geometry, x: clipboardGroups.current[0].geometry.x + 16, y: clipboardGroups.current[0].geometry.y + 16 } }; onChange([...shapes, ...copies], [...groups, group], [...images, ...imageCopies], [...texts, ...textCopies]); chooseGroup(group.id); } else { const copies = clipboard.current.map((shape) => ({ ...shape, id: createStableId('shape'), geometry: { ...shape.geometry, x: shape.geometry.x + 16, y: shape.geometry.y + 16 } })); const imageCopies = clipboardImages.current.map((image) => ({ ...image, id: createStableId('image'), geometry: { ...image.geometry, x: image.geometry.x + 16, y: image.geometry.y + 16 } })); const textCopies = clipboardTexts.current.map((text) => ({ ...text, id: createStableId('text'), geometry: { ...text.geometry, x: text.geometry.x + 16, y: text.geometry.y + 16 } })); if (copies.length || imageCopies.length || textCopies.length) { onChange([...shapes, ...copies], undefined, [...images, ...imageCopies], [...texts, ...textCopies]); choose([...copies, ...imageCopies, ...textCopies].map((item) => item.id)); } }
    }
    if (action === 'duplicate') duplicate();
    if (action === 'delete') remove();
    if (action === 'front') arrange('front');
    if (action === 'forward') arrange('forward');
    if (action === 'backward') arrange('backward');
    if (action === 'back') arrange('back');
    if (['rotateRight', 'rotateLeft', 'flipHorizontal', 'flipVertical'].includes(action)) {
      const mapped = ({ rotateRight: 'right', rotateLeft: 'left', flipHorizontal: 'flip-horizontal', flipVertical: 'flip-vertical' } as const)[action as 'rotateRight' | 'rotateLeft' | 'flipHorizontal' | 'flipVertical'];
      if (selectedGroups.length) {
        const state = mapped === 'right' ? rotateGroup({ shapes, groups }, selectedGroups[0], 90) : mapped === 'left' ? rotateGroup({ shapes, groups }, selectedGroups[0], -90) : flipGroup({ shapes, groups }, selectedGroups[0], mapped === 'flip-horizontal' ? 'horizontal' : 'vertical');
        onChange(state.shapes, state.groups, images);
      } else if (selected.length) onChange(rotateShapes(shapes, selected, mapped), undefined, images);
    }
    setMenu(null);
  }

  useEffect(() => {
    function keys(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !target?.isContentEditable) { event.preventDefault(); onUndo?.(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y' && !target?.isContentEditable) { event.preventDefault(); onRedo?.(); return; }
      if (!selected.length || target?.isContentEditable || target?.closest('[contenteditable="true"]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
      if (event.key === 'Escape') choose([]);
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remove(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicate(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { clipboard.current = clone(shapes.filter((shape) => selected.includes(shape.id))); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') { clipboard.current = clone(shapes.filter((shape) => selected.includes(shape.id))); remove(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') { contextAction('paste'); }
      const step = event.shiftKey ? 10 : 2; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0; const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0; commit(shapes.map((shape) => selected.includes(shape.id) ? { ...shape, geometry: { ...shape.geometry, x: shape.geometry.x + dx, y: shape.geometry.y + dy } } : shape)); }
    }
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys);
  }, [selected, selectedGroups, shapes, groups]);

  const bounds = useMemo(() => { const chosen = rendered.filter((shape) => selected.includes(shape.id)); if (!chosen.length) return null; const left = Math.min(...chosen.map((shape) => shape.geometry.x)); const top = Math.min(...chosen.map((shape) => shape.geometry.y)); const right = Math.max(...chosen.map((shape) => shape.geometry.x + shape.geometry.width)); const bottom = Math.max(...chosen.map((shape) => shape.geometry.y + shape.geometry.height)); return { x: left, y: top, width: right - left, height: bottom - top }; }, [rendered, selected]);

  return <div ref={ref} className={`shape-editor-overlay ${insertKind ? 'inserting' : ''}`} onPointerDown={beginBackground} onPointerMove={(event) => move(event.nativeEvent)} onPointerUp={() => finish()} onPointerCancel={() => finish()} onContextMenu={(event) => { event.preventDefault(); const target = event.target instanceof HTMLElement ? event.target : null; if ((selected.length && target?.closest('.shape-object')) || (selectedGroups.length && target?.closest('.shape-group-selection'))) setMenu({ x: event.clientX, y: event.clientY }); else setMenu(null); }}>
    {rendered.slice().sort((a, b) => a.geometry.zIndex - b.geometry.zIndex).map((shape) => { const active = selected.includes(shape.id); const style = { left: `${shape.geometry.x / W * 100}%`, top: `${shape.geometry.y / H * 100}%`, width: `${shape.geometry.width / W * 100}%`, height: `${shape.geometry.height / H * 100}%`, zIndex: shape.geometry.zIndex, transform: `rotate(${shape.geometry.rotation}deg)`, background: shape.style.backgroundColor === 'transparent' ? 'transparent' : shape.style.backgroundColor, border: `${shape.style.outlineWidth ?? 2}px solid ${shape.style.outlineColor || '#1e3a8a'}`, opacity: shape.style.opacity ?? 1 } as CSSProperties; return <div key={shape.id} className={`shape-object shape-${shape.style.shape} ${active ? 'selected' : ''}`} style={style} onPointerDown={(event) => { const target = event.target instanceof HTMLElement ? event.target : null; const rect = event.currentTarget.getBoundingClientRect(); const nearRotationHandle = active && Math.abs(event.clientX - (rect.left + rect.width / 2)) < 34 && event.clientY >= rect.top - 24 && event.clientY <= rect.top + 24; begin(target?.closest('.shape-rotate-handle') || nearRotationHandle ? 'rotate' : 'move', event, shape.id); }} onContextMenu={(event) => { event.preventDefault(); if (!selected.includes(shape.id)) choose([shape.id]); setMenu({ x: event.clientX, y: event.clientY }); }} aria-label={`${shape.style.shape} shape`}>
      {active && <>
        <span aria-label="Resize top left" className="shape-handle shape-handle-tl" onPointerDown={(event) => begin('resize', event, shape.id, 'top-left')} />
        <span aria-label="Resize top" className="shape-handle shape-handle-tm" onPointerDown={(event) => begin('resize', event, shape.id, 'top')} />
        <span aria-label="Resize top right" className="shape-handle shape-handle-tr" onPointerDown={(event) => begin('resize', event, shape.id, 'top-right')} />
        <span aria-label="Resize left" className="shape-handle shape-handle-ml" onPointerDown={(event) => begin('resize', event, shape.id, 'left')} />
        <span aria-label="Resize right" className="shape-handle shape-handle-mr" onPointerDown={(event) => begin('resize', event, shape.id, 'right')} />
        <span aria-label="Resize bottom left" className="shape-handle shape-handle-bl" onPointerDown={(event) => begin('resize', event, shape.id, 'bottom-left')} />
        <span aria-label="Resize bottom" className="shape-handle shape-handle-bm" onPointerDown={(event) => begin('resize', event, shape.id, 'bottom')} />
        <span aria-label="Resize bottom right" className="shape-handle shape-handle-br" onPointerDown={(event) => begin('resize', event, shape.id, 'bottom-right')} />
      </>}
    </div>; })}
    {groups.map((group) => <div key={group.id} className={`shape-group-object ${selectedGroups.includes(group.id) ? 'selected' : ''}`} aria-label="Group" style={{ left: `${group.geometry.x / W * 100}%`, top: `${group.geometry.y / H * 100}%`, width: `${group.geometry.width / W * 100}%`, height: `${group.geometry.height / H * 100}%`, zIndex: group.geometry.zIndex + 1, transform: `rotate(${group.geometry.rotation}deg)` }} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); chooseGroup(group.id); begin('group', event, undefined, undefined); gesture.current!.groupId = group.id; }} onContextMenu={(event) => { event.preventDefault(); chooseGroup(group.id); setMenu({ x: event.clientX, y: event.clientY }); }} />)}
    {bounds && <div className="shape-combined-selection" style={{ left: `${bounds.x / W * 100}%`, top: `${bounds.y / H * 100}%`, width: `${bounds.width / W * 100}%`, height: `${bounds.height / H * 100}%` }} />}
    {selectedGroups.map((id) => { const group = groups.find((item) => item.id === id); if (!group) return null; const handle = (corner: string, left: number, top: number) => <span key={`${id}-${corner}`} aria-label={`Group resize ${corner}`} className={`shape-handle shape-group-handle-${corner}`} style={{ left: `${left / W * 100}%`, top: `${top / H * 100}%` }} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); begin('group-resize', event, undefined, corner); gesture.current!.groupId = id; }} />; const cx = group.geometry.x + group.geometry.width / 2; return <div key={`selection-${id}`} className="shape-combined-selection shape-group-selection" style={{ left: `${group.geometry.x / W * 100}%`, top: `${group.geometry.y / H * 100}%`, width: `${group.geometry.width / W * 100}%`, height: `${group.geometry.height / H * 100}%` }} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); begin('group', event); gesture.current!.groupId = id; }}>{handle('top-left', group.geometry.x, group.geometry.y)}{handle('top-right', group.geometry.x + group.geometry.width, group.geometry.y)}{handle('bottom-left', group.geometry.x, group.geometry.y + group.geometry.height)}{handle('bottom-right', group.geometry.x + group.geometry.width, group.geometry.y + group.geometry.height)}{handle('left', group.geometry.x, group.geometry.y + group.geometry.height / 2)}{handle('right', group.geometry.x + group.geometry.width, group.geometry.y + group.geometry.height / 2)}{handle('top', cx, group.geometry.y)}{handle('bottom', cx, group.geometry.y + group.geometry.height)}<span aria-label="Rotate group" className="shape-rotate-handle shape-group-rotate" style={{ left: `${cx / W * 100}%`, top: `${(group.geometry.y - 18) / H * 100}%` }} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); begin('group-rotate', event); gesture.current!.groupId = id; }} /></div>; })}
    {selected.length === 1 && (() => { const shape = rendered.find((item) => item.id === selected[0]); if (!shape) return null; const center = shape.geometry.x + shape.geometry.width / 2; return <span aria-label="Rotate shape" className="shape-rotate-handle shape-rotate-handle-overlay" style={{ left: `${center / W * 100}%`, top: `${(shape.geometry.y - 18) / H * 100}%` }} onPointerDown={(event) => begin('rotate', event, shape.id)} />; })()}
    {guides.map((guide, index) => <div key={`guide-${index}`} className={`shape-smart-guide shape-smart-guide-${guide.axis}`} style={guide.axis === 'x' ? { left: `${guide.value / W * 100}%` } : { top: `${guide.value / H * 100}%` }} />)}
    {preview && <div className="shape-preview" style={{ left: `${preview.x / W * 100}%`, top: `${preview.y / H * 100}%`, width: `${preview.width / W * 100}%`, height: `${preview.height / H * 100}%` }} />}
    {menu && <div className="shape-context-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>{[['cut', 'Cut'], ['copy', 'Copy'], ['paste', 'Paste'], ['duplicate', 'Duplicate'], ['front', 'Bring to Front'], ['forward', 'Bring Forward'], ['backward', 'Send Backward'], ['back', 'Send to Back'], ['rotateRight', 'Rotate Right 90°'], ['rotateLeft', 'Rotate Left 90°'], ['flipHorizontal', 'Flip Horizontal'], ['flipVertical', 'Flip Vertical'], ['delete', 'Delete']].map(([key, label]) => <button key={key} type="button" disabled={(key === 'paste' && clipboard.current.length === 0 && clipboardGroups.current.length === 0) || (['front', 'forward', 'backward', 'back'].includes(key) && selectedGroups.length > 0)} onClick={() => contextAction(key)}>{label}</button>)}</div>}
  </div>;
}
