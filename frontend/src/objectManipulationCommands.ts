import { createStableId, type GroupObject, type ImageObject, type ObjectGeometry, type ShapeObject, type TextObject } from './presentationModel';

export type EditableObject = ShapeObject | ImageObject | TextObject;
export type EditableShapeState = { shapes: ShapeObject[]; images?: ImageObject[]; groups: GroupObject[] };
export type Bounds = { x: number; y: number; width: number; height: number };

const copy = <T,>(value: T) => JSON.parse(JSON.stringify(value)) as T;

export function boundsOf(shapes: ShapeObject[], ids: string[]): Bounds | null {
  const selected = shapes.filter((shape) => ids.includes(shape.id));
  if (!selected.length) return null;
  const left = Math.min(...selected.map((shape) => shape.geometry.x));
  const top = Math.min(...selected.map((shape) => shape.geometry.y));
  const right = Math.max(...selected.map((shape) => shape.geometry.x + shape.geometry.width));
  const bottom = Math.max(...selected.map((shape) => shape.geometry.y + shape.geometry.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function boundsOfObjects(objects: EditableObject[], ids: string[]): Bounds | null {
  const selected = objects.filter((object) => ids.includes(object.id));
  if (!selected.length) return null;
  const left = Math.min(...selected.map((object) => object.geometry.x));
  const top = Math.min(...selected.map((object) => object.geometry.y));
  const right = Math.max(...selected.map((object) => object.geometry.x + object.geometry.width));
  const bottom = Math.max(...selected.map((object) => object.geometry.y + object.geometry.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function alignObjects<T extends EditableObject>(objects: T[], ids: string[], mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): T[] {
  const bounds = boundsOfObjects(objects, ids);
  if (!bounds || ids.length < 2) return objects;
  return objects.map((object) => {
    if (!ids.includes(object.id)) return object;
    const x = mode === 'left' ? bounds.x : mode === 'center' ? bounds.x + (bounds.width - object.geometry.width) / 2 : mode === 'right' ? bounds.x + bounds.width - object.geometry.width : object.geometry.x;
    const y = mode === 'top' ? bounds.y : mode === 'middle' ? bounds.y + (bounds.height - object.geometry.height) / 2 : mode === 'bottom' ? bounds.y + bounds.height - object.geometry.height : object.geometry.y;
    return { ...object, geometry: { ...object.geometry, x, y } };
  });
}

export function distributeObjects<T extends EditableObject>(objects: T[], ids: string[], axis: 'horizontal' | 'vertical'): T[] {
  if (ids.length < 3) return objects;
  const selected = objects.filter((object) => ids.includes(object.id)).sort((a, b) => axis === 'horizontal' ? a.geometry.x - b.geometry.x : a.geometry.y - b.geometry.y);
  const first = selected[0];
  const last = selected[selected.length - 1];
  const start = axis === 'horizontal' ? first.geometry.x : first.geometry.y;
  const end = axis === 'horizontal' ? last.geometry.x : last.geometry.y;
  const step = (end - start) / (selected.length - 1);
  const positions = new Map(selected.map((object, index) => [object.id, start + step * index]));
  return objects.map((object) => positions.has(object.id) ? { ...object, geometry: { ...object.geometry, ...(axis === 'horizontal' ? { x: positions.get(object.id)! } : { y: positions.get(object.id)! }) } } : object);
}

export function arrangeObjects<T extends EditableObject>(objects: T[], ids: string[], direction: 'front' | 'forward' | 'backward' | 'back'): T[] {
  if (!ids.length) return objects;
  const selected = new Set(ids);
  const ordered = [...objects].sort((a, b) => a.geometry.zIndex - b.geometry.zIndex);
  let next = [...ordered];
  if (direction === 'front' || direction === 'back') {
    const moving = ordered.filter((object) => selected.has(object.id));
    const rest = ordered.filter((object) => !selected.has(object.id));
    next = direction === 'front' ? [...rest, ...moving] : [...moving, ...rest];
  } else {
    const delta = direction === 'forward' ? 1 : -1;
    for (let i = delta > 0 ? next.length - 2 : 1; delta > 0 ? i >= 0 : i < next.length; i += delta > 0 ? -1 : 1) {
      const other = i + delta;
      if (selected.has(next[i].id) && other >= 0 && other < next.length && !selected.has(next[other].id)) [next[i], next[other]] = [next[other], next[i]];
    }
  }
  return next.map((object, index) => ({ ...object, geometry: { ...object.geometry, zIndex: index } }));
}

export function rotateObjects<T extends EditableObject>(objects: T[], ids: string[], action: 'right' | 'left' | 'flip-horizontal' | 'flip-vertical'): T[] {
  const bounds = boundsOfObjects(objects, ids);
  if (!bounds) return objects;
  return objects.map((object) => {
    if (!ids.includes(object.id)) return object;
    const cx = object.geometry.x + object.geometry.width / 2;
    const cy = object.geometry.y + object.geometry.height / 2;
    if (action === 'right' || action === 'left') {
      const radians = (action === 'right' ? 90 : -90) * Math.PI / 180;
      const bx = bounds.x + bounds.width / 2; const by = bounds.y + bounds.height / 2;
      const sx = cx - bx; const sy = cy - by;
      return { ...object, geometry: { ...object.geometry, x: bx + sx * Math.cos(radians) - sy * Math.sin(radians) - object.geometry.width / 2, y: by + sx * Math.sin(radians) + sy * Math.cos(radians) - object.geometry.height / 2, rotation: object.geometry.rotation + (action === 'right' ? 90 : -90) } };
    }
    return { ...object, geometry: { ...object.geometry, x: action === 'flip-horizontal' ? bounds.x + bounds.width - (object.geometry.x - bounds.x) - object.geometry.width : object.geometry.x, y: action === 'flip-vertical' ? bounds.y + bounds.height - (object.geometry.y - bounds.y) - object.geometry.height : object.geometry.y, rotation: action === 'flip-horizontal' ? -object.geometry.rotation : object.geometry.rotation } };
  });
}

export function groupShapes(state: EditableShapeState, ids: string[]): { state: EditableShapeState; group: GroupObject | null } {
  if (ids.length < 2) return { state, group: null };
  const bounds = boundsOf(state.shapes, ids);
  if (!bounds) return { state, group: null };
  const children = state.shapes.filter((shape) => ids.includes(shape.id));
  const group: GroupObject = { id: createStableId('group'), type: 'group', geometry: { ...bounds, rotation: 0, zIndex: Math.max(...state.shapes.map((shape) => shape.geometry.zIndex), 0) + 1 }, childIds: children.map((shape) => shape.id), name: 'Group' };
  return { state: { shapes: copy(state.shapes), groups: [...state.groups, group] }, group };
}

export function ungroup(state: EditableShapeState, groupId: string): EditableShapeState {
  return { shapes: copy(state.shapes), groups: state.groups.filter((group) => group.id !== groupId) };
}

export function translateGroup(state: EditableShapeState, groupId: string, dx: number, dy: number): EditableShapeState {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return state;
  const ids = new Set(group.childIds);
  return { groups: state.groups.map((item) => item.id === groupId ? { ...item, geometry: { ...item.geometry, x: item.geometry.x + dx, y: item.geometry.y + dy } } : item), shapes: state.shapes.map((shape) => ids.has(shape.id) ? { ...shape, geometry: { ...shape.geometry, x: shape.geometry.x + dx, y: shape.geometry.y + dy } } : shape) };
}

export function alignShapes(shapes: ShapeObject[], ids: string[], mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): ShapeObject[] {
  const bounds = boundsOf(shapes, ids);
  if (!bounds || ids.length < 2) return shapes;
  return shapes.map((shape) => {
    if (!ids.includes(shape.id)) return shape;
    const { geometry } = shape;
    const x = mode === 'left' ? bounds.x : mode === 'center' ? bounds.x + (bounds.width - geometry.width) / 2 : mode === 'right' ? bounds.x + bounds.width - geometry.width : geometry.x;
    const y = mode === 'top' ? bounds.y : mode === 'middle' ? bounds.y + (bounds.height - geometry.height) / 2 : mode === 'bottom' ? bounds.y + bounds.height - geometry.height : geometry.y;
    return { ...shape, geometry: { ...geometry, x, y } };
  });
}

export function distributeShapes(shapes: ShapeObject[], ids: string[], axis: 'horizontal' | 'vertical'): ShapeObject[] {
  if (ids.length < 3) return shapes;
  const selected = shapes.filter((shape) => ids.includes(shape.id)).sort((a, b) => axis === 'horizontal' ? a.geometry.x - b.geometry.x : a.geometry.y - b.geometry.y);
  const first = selected[0];
  const last = selected[selected.length - 1];
  const start = axis === 'horizontal' ? first.geometry.x : first.geometry.y;
  const end = axis === 'horizontal' ? last.geometry.x : last.geometry.y;
  const step = (end - start) / (selected.length - 1);
  const positions = new Map(selected.map((shape, index) => [shape.id, start + step * index]));
  return shapes.map((shape) => {
    const position = positions.get(shape.id);
    if (position === undefined) return shape;
    return { ...shape, geometry: { ...shape.geometry, ...(axis === 'horizontal' ? { x: position } : { y: position }) } };
  });
}

export function arrangeShapes(shapes: ShapeObject[], ids: string[], direction: 'front' | 'forward' | 'backward' | 'back'): ShapeObject[] {
  if (!ids.length) return shapes;
  const selected = new Set(ids);
  const ordered = [...shapes].sort((a, b) => a.geometry.zIndex - b.geometry.zIndex);
  let next: ShapeObject[];
  if (direction === 'front' || direction === 'back') {
    const moving = ordered.filter((shape) => selected.has(shape.id));
    const rest = ordered.filter((shape) => !selected.has(shape.id));
    next = direction === 'front' ? [...rest, ...moving] : [...moving, ...rest];
  } else {
    next = [...ordered];
    const delta = direction === 'forward' ? 1 : -1;
    for (let i = delta > 0 ? next.length - 2 : 1; delta > 0 ? i >= 0 : i < next.length; i += delta > 0 ? -1 : 1) {
      const other = i + delta;
      if (selected.has(next[i].id) && other >= 0 && other < next.length && !selected.has(next[other].id)) [next[i], next[other]] = [next[other], next[i]];
    }
  }
  return next.map((shape, index) => ({ ...shape, geometry: { ...shape.geometry, zIndex: index } }));
}

export function rotateShapes(shapes: ShapeObject[], ids: string[], action: 'right' | 'left' | 'flip-horizontal' | 'flip-vertical'): ShapeObject[] {
  const bounds = boundsOf(shapes, ids);
  if (!bounds) return shapes;
  return shapes.map((shape) => {
    if (!ids.includes(shape.id)) return shape;
    const cx = shape.geometry.x + shape.geometry.width / 2;
    const cy = shape.geometry.y + shape.geometry.height / 2;
    if (action === 'right' || action === 'left') {
      const radians = (action === 'right' ? 90 : -90) * Math.PI / 180;
      const bx = bounds.x + bounds.width / 2; const by = bounds.y + bounds.height / 2;
      const sx = cx - bx; const sy = cy - by;
      return { ...shape, geometry: { ...shape.geometry, x: bx + sx * Math.cos(radians) - sy * Math.sin(radians) - shape.geometry.width / 2, y: by + sx * Math.sin(radians) + sy * Math.cos(radians) - shape.geometry.height / 2, rotation: shape.geometry.rotation + (action === 'right' ? 90 : -90) } };
    }
    const x = action === 'flip-horizontal' ? bounds.x + bounds.width - (shape.geometry.x - bounds.x) - shape.geometry.width : shape.geometry.x;
    const y = action === 'flip-vertical' ? bounds.y + bounds.height - (shape.geometry.y - bounds.y) - shape.geometry.height : shape.geometry.y;
    return { ...shape, geometry: { ...shape.geometry, x, y, rotation: action === 'flip-horizontal' ? -shape.geometry.rotation : shape.geometry.rotation } };
  });
}

export function rotateGroup(state: EditableShapeState, groupId: string, angle: number): EditableShapeState {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return state;
  const radians = (angle * Math.PI) / 180;
  const cx = group.geometry.x + group.geometry.width / 2;
  const cy = group.geometry.y + group.geometry.height / 2;
  const ids = new Set(group.childIds);
  return { groups: state.groups.map((item) => item.id === groupId ? { ...item, geometry: { ...item.geometry, rotation: item.geometry.rotation + angle } } : item), shapes: state.shapes.map((shape) => {
    if (!ids.has(shape.id)) return shape;
    const sx = shape.geometry.x + shape.geometry.width / 2 - cx;
    const sy = shape.geometry.y + shape.geometry.height / 2 - cy;
    const x = cx + sx * Math.cos(radians) - sy * Math.sin(radians) - shape.geometry.width / 2;
    const y = cy + sx * Math.sin(radians) + sy * Math.cos(radians) - shape.geometry.height / 2;
    return { ...shape, geometry: { ...shape.geometry, x, y, rotation: shape.geometry.rotation + angle } };
  }) };
}

export function flipGroup(state: EditableShapeState, groupId: string, axis: 'horizontal' | 'vertical'): EditableShapeState {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return state;
  const ids = new Set(group.childIds);
  const cx = group.geometry.x + group.geometry.width / 2;
  const cy = group.geometry.y + group.geometry.height / 2;
  return { groups: copy(state.groups), shapes: state.shapes.map((shape) => {
    if (!ids.has(shape.id)) return shape;
    const x = axis === 'horizontal' ? cx - (shape.geometry.x + shape.geometry.width - cx) : shape.geometry.x;
    const y = axis === 'vertical' ? cy - (shape.geometry.y + shape.geometry.height - cy) : shape.geometry.y;
    return { ...shape, geometry: { ...shape.geometry, x, y, rotation: axis === 'horizontal' ? -shape.geometry.rotation : shape.geometry.rotation } };
  }) };
}

export type { ObjectGeometry };
