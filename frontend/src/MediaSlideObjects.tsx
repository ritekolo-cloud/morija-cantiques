import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { AudioObject, VideoObject } from './presentationModel';

type Props = {
  audio?: AudioObject[];
  video?: VideoObject[];
  editable?: boolean;
  selectedIds?: string[];
  onChange?: (audio: AudioObject[], video: VideoObject[]) => void;
  onSelectionChange?: (ids: string[]) => void;
};

const styleFor = (object: { geometry: { x: number; y: number; width: number; height: number; rotation: number; zIndex: number } }): CSSProperties => ({
  position: 'absolute',
  left: (object.geometry.x / 1280 * 100) + '%',
  top: (object.geometry.y / 720 * 100) + '%',
  width: (object.geometry.width / 1280 * 100) + '%',
  height: (object.geometry.height / 720 * 100) + '%',
  transform: 'rotate(' + object.geometry.rotation + 'deg)',
  zIndex: object.geometry.zIndex,
});

export function MediaSlideObjects({ audio = [], video = [], editable = false, selectedIds = [], onChange, onSelectionChange }: Props) {
  return <>
    {audio.map((object) => <AudioMedia key={object.id} object={object} editable={editable} selected={selectedIds.includes(object.id)} onSelect={() => onSelectionChange?.([object.id])} onDelete={() => onChange?.(audio.filter((candidate) => candidate.id !== object.id), video)} />)}
    {video.map((object) => <VideoMedia key={object.id} object={object} editable={editable} selected={selectedIds.includes(object.id)} onSelect={() => onSelectionChange?.([object.id])} onChange={(next) => onChange?.(audio, video.map((candidate) => candidate.id === next.id ? next : candidate))} onDelete={() => onChange?.(audio, video.filter((candidate) => candidate.id !== object.id))} />)}
  </>;
}
function AudioMedia({ object, editable, selected, onSelect, onDelete }: { object: AudioObject; editable: boolean; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  return <div className={'media-slide-object media-audio-object ' + (selected ? 'selected' : '')} style={styleFor(object)} onPointerDown={editable ? onSelect : undefined} title={object.error || object.name}>
    <span aria-hidden="true">Audio</span>
    {editable && selected && <button type="button" className="media-delete-button" aria-label={'Delete ' + object.name} onPointerDown={(event) => event.stopPropagation()} onClick={onDelete}>Delete</button>}
    <audio controls preload="metadata" src={object.src} onError={(event) => { (event.currentTarget.parentElement as HTMLElement | null)?.setAttribute('data-media-error', 'Audio unavailable or unsupported'); }} />
  </div>;
}

function VideoMedia({ object, editable, selected, onSelect, onChange, onDelete }: { object: VideoObject; editable: boolean; selected: boolean; onSelect: () => void; onChange: (object: VideoObject) => void; onDelete: () => void }) {
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [ratio, setRatio] = useState(object.geometry.width / Math.max(1, object.geometry.height));
  useEffect(() => { setRatio(object.geometry.width / Math.max(1, object.geometry.height)); }, [object.geometry.width, object.geometry.height]);
  return <div className={'media-slide-object media-video-object ' + (selected ? 'selected' : '')} style={styleFor(object)} onPointerDown={(event) => {
    if (!editable) return;
    onSelect();
    drag.current = { x: object.geometry.x, y: object.geometry.y, startX: event.clientX, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={(event) => {
    if (!drag.current) return;
    onChange({ ...object, geometry: { ...object.geometry, x: drag.current.x + (event.clientX - drag.current.startX) * 1280 / Math.max(1, event.currentTarget.clientWidth), y: drag.current.y + (event.clientY - drag.current.startY) * 720 / Math.max(1, event.currentTarget.clientHeight) } });
  }} onPointerUp={() => { drag.current = null; }}>
    <video controls={!editable || selected} playsInline preload="metadata" muted={object.muted} src={object.src} onLoadedMetadata={(event) => { const media = event.currentTarget; if (media.videoWidth && media.videoHeight) setRatio(media.videoWidth / media.videoHeight); }} onError={(event) => { (event.currentTarget.parentElement as HTMLElement | null)?.setAttribute('data-media-error', 'Video unavailable or unsupported'); }} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: editable ? 'none' : 'auto' }} />
    {editable && selected && <><button type="button" className="media-delete-button" aria-label={'Delete ' + object.name} onPointerDown={(event) => event.stopPropagation()} onClick={onDelete}>Delete</button><button type="button" className="media-resize-handle" aria-label={'Resize ' + object.name} onPointerDown={(event) => {
      event.stopPropagation();
      const start = { width: object.geometry.width, x: event.clientX, y: event.clientY };
      const move = (moveEvent: PointerEvent) => {
        const width = Math.max(80, start.width + moveEvent.clientX - start.x);
        onChange({ ...object, geometry: { ...object.geometry, width, height: Math.max(45, width / ratio) } });
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }}>Resize</button></>}</div>;
}
