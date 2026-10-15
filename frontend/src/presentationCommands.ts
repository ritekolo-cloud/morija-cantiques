import {
  createStableId,
  textSlideToPresentationSlide,
  type PresentationDocument,
  type PresentationSlide,
  type TextSlideSource,
} from './presentationModel';

export function insertSlide(document: PresentationDocument, source: TextSlideSource): { document: PresentationDocument; slide: PresentationSlide } {
  const slide = textSlideToPresentationSlide(source);
  return { document: { ...document, slides: [...document.slides, slide] }, slide };
}
export function updateSlide(document: PresentationDocument, slideId: string, source: TextSlideSource): PresentationDocument {
  return { ...document, slides: document.slides.map((slide) => slide.id === slideId ? textSlideToPresentationSlide(source) : slide) };
}

export function duplicateSlide(document: PresentationDocument, slideId: string, duplicatedSlideId = createStableId('slide')): { document: PresentationDocument; slide: PresentationSlide | null } {
  const original = document.slides.find((slide) => slide.id === slideId);
  if (!original) return { document, slide: null };
  const copy = JSON.parse(JSON.stringify(original)) as PresentationSlide;
  copy.id = duplicatedSlideId;
  const idMap = new Map(copy.objects.map((object) => [object.id, createStableId(object.type)]));
  copy.objects = copy.objects.map((object) => {
    const next = { ...object, id: idMap.get(object.id) || createStableId(object.type) } as typeof object;
    if (next.type === 'group') next.childIds = next.childIds.map((childId) => idMap.get(childId) || childId);
    return next;
  });
  copy.animations = (copy.animations || []).map((animation) => ({ ...animation, id: createStableId('animation'), objectId: idMap.get(animation.objectId) || animation.objectId }));
  const index = document.slides.findIndex((slide) => slide.id === slideId);
  const slides = [...document.slides];
  slides.splice(index + 1, 0, copy);
  return { document: { ...document, slides }, slide: copy };
}

export function deleteSlide(document: PresentationDocument, slideId: string): PresentationDocument {
  if (document.slides.length <= 1) return document;
  return { ...document, slides: document.slides.filter((slide) => slide.id !== slideId) };
}

export function deleteSlides(document: PresentationDocument, slideIds: string[]): PresentationDocument {
  if (document.slides.length <= 1 || slideIds.length === 0) return document;
  const selected = new Set(slideIds);
  const remaining = document.slides.filter((slide) => !selected.has(slide.id));
  if (remaining.length > 0) return { ...document, slides: remaining };
  // A presentation must retain one slide when every slide is selected.
  return { ...document, slides: [document.slides[0]] };
}

export function reorderSlides(document: PresentationDocument, fromIndex: number, toIndex: number): PresentationDocument {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= document.slides.length || toIndex >= document.slides.length || fromIndex === toIndex) return document;
  const slides = [...document.slides];
  const [slide] = slides.splice(fromIndex, 1);
  slides.splice(toIndex, 0, slide);
  return { ...document, slides };
}

export function nextSlideSelection(
  slideIds: string[],
  selectedIds: string[],
  clickedId: string,
  options: { additive?: boolean; rangeAnchor?: string | null } = {},
) {
  const clickedIndex = slideIds.indexOf(clickedId);
  if (clickedIndex < 0) return selectedIds;
  if (options.rangeAnchor && slideIds.includes(options.rangeAnchor)) {
    const anchorIndex = slideIds.indexOf(options.rangeAnchor);
    const from = Math.min(anchorIndex, clickedIndex);
    const to = Math.max(anchorIndex, clickedIndex);
    return slideIds.slice(from, to + 1);
  }
  if (options.additive) {
    return selectedIds.includes(clickedId)
      ? selectedIds.filter((id) => id !== clickedId)
      : [...selectedIds, clickedId];
  }
  return [clickedId];
}


export function getVisibleSlideId(document: PresentationDocument, currentId: string | null, direction: -1 | 1): string | null {
  const visible = document.slides.filter((slide) => !slide.hidden);
  if (!visible.length) return null;
  const currentIndex = Math.max(0, visible.findIndex((slide) => slide.id === currentId));
  return visible[Math.max(0, Math.min(visible.length - 1, currentIndex + direction))]?.id || null;
}
