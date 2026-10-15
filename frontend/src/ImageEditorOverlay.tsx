import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createStableId, type ImageObject } from './presentationModel';

const W = 1280;
const H = 720;
type Point = { x: number; y: number };
type Gesture = { kind: 'move' | 'resize' | 'rotate'; id: string; corner?: string; start: Point; original: ImageObject; pointerId: number; target: HTMLElement };

export function ImageEditorOverlay({ images, selectedIds = [], onChange, onSelectionChange }: { images: ImageObject[]; selectedIds?: string[]; onChange: (images: ImageObject[]) => void; onSelectionChange: (ids: string[], additive?: boolean) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const draftRef = useRef<ImageObject[] | null>(null);
  const [draft, setDraft] = useState<ImageObject[] | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [clipboardHasData, setClipboardHasData] = useState(false);
  const clipboard = useRef<ImageObject[]>([]);
  const contextSelection = useRef<string[]>([]);
  const rendered = draft || images;

  function point(event: PointerEvent | ReactPointerEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (event.clientX - rect.left) / rect.width * W, y: (event.clientY - rect.top) / rect.height * H };
  }
  function choose(id: string, additive: boolean) {
    onSelectionChange(additive ? (selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]) : [id], additive);
  }
  function finish() {
    if (!gesture.current) return;
    if (draftRef.current) onChange(draftRef.current);
    try { gesture.current.target.releasePointerCapture(gesture.current.pointerId); } catch { /* embedded browsers may release capture automatically */ }
    gesture.current = null;
    draftRef.current = null;
    setDraft(null);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish);
  }
  function move(event: PointerEvent) {
    const active = gesture.current;
    if (!active) return;
    const current = point(event);
    const dx = current.x - active.start.x;
    const dy = current.y - active.start.y;
    const original = active.original;
    const next = { ...original, geometry: { ...original.geometry } };
    if (active.kind === 'move') {
      next.geometry.x = Math.max(0, Math.min(W - original.geometry.width, original.geometry.x + dx));
      next.geometry.y = Math.max(0, Math.min(H - original.geometry.height, original.geometry.y + dy));
    } else if (active.kind === 'resize') {
      const corner = active.corner || '';
      const minSize = 24;
      const right = original.geometry.x + original.geometry.width;
      const bottom = original.geometry.y + original.geometry.height;
      const left = corner.includes('left') ? Math.min(original.geometry.x + dx, right - minSize) : original.geometry.x;
      const top = corner.includes('top') ? Math.min(original.geometry.y + dy, bottom - minSize) : original.geometry.y;
      const nextRight = corner.includes('right') ? Math.max(right + dx, left + minSize) : right;
      const nextBottom = corner.includes('bottom') ? Math.max(bottom + dy, top + minSize) : bottom;
      next.geometry.x = Math.max(0, left);
      next.geometry.y = Math.max(0, top);
      next.geometry.width = Math.min(W - next.geometry.x, Math.max(minSize, nextRight - left));
      next.geometry.height = Math.min(H - next.geometry.y, Math.max(minSize, nextBottom - top));
      if (event.shiftKey && (corner.includes('left') || corner.includes('right'))) {
        const ratio = original.geometry.width / Math.max(original.geometry.height, 1);
        next.geometry.height = Math.min(H - next.geometry.y, Math.max(minSize, next.geometry.width / ratio));
      }
    } else {
      const cx = original.geometry.x + original.geometry.width / 2;
      const cy = original.geometry.y + original.geometry.height / 2;
      let angle = Math.atan2(current.y - cy, current.x - cx) * 180 / Math.PI + 90;
      if (event.shiftKey) angle = Math.round(angle / 15) * 15;
      next.geometry.rotation = angle;
    }
    const nextImages = images.map((image) => image.id === original.id ? next : image);
    draftRef.current = nextImages;
    setDraft(nextImages);
  }
  function begin(kind: Gesture['kind'], event: ReactPointerEvent, id: string, corner?: string) {
    event.preventDefault();
    event.stopPropagation();
    const original = images.find((image) => image.id === id);
    if (!original) return;
    choose(id, event.shiftKey);
    const target = event.currentTarget as HTMLElement;
    try { target.setPointerCapture(event.pointerId); } catch { /* capture may be unavailable */ }
    gesture.current = { kind, id, corner, start: point(event), original: JSON.parse(JSON.stringify(original)) as ImageObject, pointerId: event.pointerId, target };
    draftRef.current = null;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }
  function duplicate(id: string) {
    const original = images.find((image) => image.id === id);
    if (!original) return;
    const copy = { ...JSON.parse(JSON.stringify(original)) as ImageObject, id: createStableId('image'), geometry: { ...original.geometry, x: Math.min(W - original.geometry.width, original.geometry.x + 16), y: Math.min(H - original.geometry.height, original.geometry.y + 16), zIndex: Math.max(...images.map((item) => item.geometry.zIndex), 0) + 1 } };
    onChange([...images, copy]);
    onSelectionChange([copy.id]);
  }
  function contextAction(action: string) {
    const activeIds = selectedIds.length ? selectedIds : contextSelection.current;
    const current = images.filter((image) => activeIds.includes(image.id));
    if (action === 'copy') { clipboard.current = JSON.parse(JSON.stringify(current)) as ImageObject[]; setClipboardHasData(clipboard.current.length > 0); }
    if (action === 'cut') { clipboard.current = JSON.parse(JSON.stringify(current)) as ImageObject[]; setClipboardHasData(clipboard.current.length > 0); onChange(images.filter((image) => !activeIds.includes(image.id))); onSelectionChange([]); }
    if (action === 'paste' && clipboard.current.length) {
      const copies = clipboard.current.map((image) => ({ ...JSON.parse(JSON.stringify(image)) as ImageObject, id: createStableId('image'), geometry: { ...image.geometry, x: Math.min(W - image.geometry.width, image.geometry.x + 16), y: Math.min(H - image.geometry.height, image.geometry.y + 16), zIndex: Math.max(...images.map((item) => item.geometry.zIndex), 0) + 1 } }));
      onChange([...images, ...copies]); onSelectionChange(copies.map((image) => image.id));
    }
    if (action === 'duplicate' && activeIds[0]) duplicate(activeIds[0]);
    if (action === 'delete') { onChange(images.filter((image) => !activeIds.includes(image.id))); onSelectionChange([]); }
    if (['rotateRight', 'rotateLeft'].includes(action)) onChange(images.map((image) => activeIds.includes(image.id) ? { ...image, geometry: { ...image.geometry, rotation: image.geometry.rotation + (action === 'rotateRight' ? 90 : -90) } } : image));
    if (action === 'flipHorizontal') onChange(images.map((image) => activeIds.includes(image.id) ? { ...image, flipHorizontal: !image.flipHorizontal } : image));
    if (action === 'flipVertical') onChange(images.map((image) => activeIds.includes(image.id) ? { ...image, flipVertical: !image.flipVertical } : image));
    if (['front', 'forward', 'backward', 'back'].includes(action)) {
      const selected = new Set(activeIds); const ordered = [...images].sort((a, b) => a.geometry.zIndex - b.geometry.zIndex); let next = [...ordered];
      if (action === 'front' || action === 'back') { const moving = ordered.filter((image) => selected.has(image.id)); const rest = ordered.filter((image) => !selected.has(image.id)); next = action === 'front' ? [...rest, ...moving] : [...moving, ...rest]; }
      else { const step = action === 'forward' ? 1 : -1; for (let i = step > 0 ? next.length - 2 : 1; step > 0 ? i >= 0 : i < next.length; i += step > 0 ? -1 : 1) { const other = i + step; if (selected.has(next[i].id) && other >= 0 && other < next.length && !selected.has(next[other].id)) [next[i], next[other]] = [next[other], next[i]]; } }
      onChange(next.map((image, index) => ({ ...image, geometry: { ...image.geometry, zIndex: index } })));
    }
    setMenu(null);
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (!selectedIds.length || target?.isContentEditable || target?.closest('[contenteditable="true"]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onChange(images.filter((image) => !selectedIds.includes(image.id))); onSelectionChange([]); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicate(selectedIds[0]); }
      const step = event.shiftKey ? 10 : 2;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        onChange(images.map((image) => selectedIds.includes(image.id) ? { ...image, geometry: { ...image.geometry, x: Math.max(0, Math.min(W - image.geometry.width, image.geometry.x + dx)), y: Math.max(0, Math.min(H - image.geometry.height, image.geometry.y + dy)) } } : image));
      }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [images, selectedIds]);

  return <div ref={ref} className="image-editor-overlay" aria-label="Image objects">
    {rendered.slice().sort((a, b) => a.geometry.zIndex - b.geometry.zIndex).map((image) => <div key={image.id} className={`image-object ${selectedIds.includes(image.id) ? 'selected' : ''}`} aria-label="Image object" style={{ left: `${image.geometry.x / W * 100}%`, top: `${image.geometry.y / H * 100}%`, width: `${image.geometry.width / W * 100}%`, height: `${image.geometry.height / H * 100}%`, zIndex: image.geometry.zIndex, transform: `rotate(${image.geometry.rotation}deg) scale(${image.flipHorizontal ? -1 : 1}, ${image.flipVertical ? -1 : 1})`, opacity: image.style.opacity ?? 1 }} onPointerDown={(event) => begin('move', event, image.id)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); contextSelection.current = selectedIds.includes(image.id) ? selectedIds : [image.id]; if (!selectedIds.includes(image.id)) onSelectionChange([image.id]); setMenu({ x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY }); }}>
      <img src={image.src} alt={image.alt} draggable={false} />
      {selectedIds.includes(image.id) && <><span className="image-handle image-handle-top-left" aria-label="Resize image top-left" onPointerDown={(event) => begin('resize', event, image.id, 'top-left')} /><span className="image-handle image-handle-top-right" aria-label="Resize image top-right" onPointerDown={(event) => begin('resize', event, image.id, 'top-right')} /><span className="image-handle image-handle-bottom-left" aria-label="Resize image bottom-left" onPointerDown={(event) => begin('resize', event, image.id, 'bottom-left')} /><span className="image-handle image-handle-bottom-right" aria-label="Resize image bottom-right" onPointerDown={(event) => begin('resize', event, image.id, 'bottom-right')} /><span className="image-rotate-handle" aria-label="Rotate image" onPointerDown={(event) => begin('rotate', event, image.id)} /></>}
    </div>)}
    {menu && <div className="image-context-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>{[['copy', 'Copy'], ['cut', 'Cut'], ['paste', 'Paste'], ['duplicate', 'Duplicate'], ['front', 'Bring to Front'], ['forward', 'Bring Forward'], ['backward', 'Send Backward'], ['back', 'Send to Back'], ['rotateRight', 'Rotate Right 90°'], ['rotateLeft', 'Rotate Left 90°'], ['flipHorizontal', 'Flip Horizontal'], ['flipVertical', 'Flip Vertical'], ['delete', 'Delete']].map(([key, label]) => <button key={key} type="button" disabled={key === 'paste' && !clipboardHasData} onClick={() => contextAction(key)}>{label}</button>)}</div>}
  </div>;
}
