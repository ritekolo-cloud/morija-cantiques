export type SongProjectionPosition = {
  selectedIndex: number;
  itemCount: number;
  scrollProgress: number;
};

export function clampProjectionIndex(index: number, itemCount: number) {
  if (itemCount <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), itemCount - 1);
}

export function startSongProjection(itemCount: number, currentIndex = 0, fromCurrent = false): SongProjectionPosition {
  return {
    selectedIndex: clampProjectionIndex(fromCurrent ? currentIndex : 0, itemCount),
    itemCount,
    scrollProgress: 0,
  };
}

export function moveSongProjection(position: SongProjectionPosition, direction: -1 | 1): SongProjectionPosition {
  return {
    ...position,
    selectedIndex: clampProjectionIndex(position.selectedIndex + direction, position.itemCount),
    scrollProgress: 0,
  };
}

export function resetSongProjectionScroll(position: SongProjectionPosition): SongProjectionPosition {
  return { ...position, scrollProgress: 0 };
}
