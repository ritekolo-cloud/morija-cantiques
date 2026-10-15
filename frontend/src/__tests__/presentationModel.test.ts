import { describe, expect, it } from 'vitest';
import {
  clonePresentationDocument,
  createPresentationDocument,
  createPresentationSlide,
  fitPresentationZoomPercent,
  isValidHyperlink,
  parsePresentationDocument,
  presentationSlideToTextSlide,
  serializePresentationDocument,
  textSlideToPresentationSlide,
  validatePresentationDocument,
  type GroupObject,
  type DrawingObject,
  type ImageObject,
  type SlideComment,
  type ShapeObject,
  type TextObject,
  type TextSlideSource,
} from '../presentationModel';
import { resolveSelectedSlideId } from '../presentationStore';
import { duplicateSlide, nextSlideSelection, reorderSlides } from '../presentationCommands';

const geometry = (x: number, y: number, zIndex: number) => ({ x, y, width: 120, height: 60, rotation: 0, zIndex });

const textObject: TextObject = {
  id: 'text-1', type: 'text', geometry: geometry(80, 90, 1),
  style: { fontFamily: 'Arial', fontSize: 30, color: '#111111', textAlign: 'left' },
  text: 'First\nSecond',
  runs: [{ text: 'First\nSecond', fontFamily: 'Arial', fontSize: 30, color: '#111111' }],
  paragraphs: [
    { alignment: 'left', bullet: 'bullet', indent: 0, lineSpacing: 1.15, paragraphSpacing: 0 },
    { alignment: 'left', bullet: null, indent: 0, lineSpacing: 1.15, paragraphSpacing: 0 },
  ],
  verticalAlign: 'top', margins: { left: 12, right: 12, top: 10, bottom: 10 }, autofit: 'shrink-text',
  html: '<span class="text-bullet">• </span>First<br>Second',
};

describe('slide navigator selection', () => {
  const ids = ['slide-1', 'slide-2', 'slide-3', 'slide-4'];

  it('supports normal, additive, toggle, range, and select-all selection', () => {
    expect(nextSlideSelection(ids, [], 'slide-2')).toEqual(['slide-2']);
    expect(nextSlideSelection(ids, ['slide-2'], 'slide-4', { additive: true })).toEqual(['slide-2', 'slide-4']);
    expect(nextSlideSelection(ids, ['slide-2', 'slide-4'], 'slide-2', { additive: true })).toEqual(['slide-4']);
    expect(nextSlideSelection(ids, ['slide-2'], 'slide-4', { rangeAnchor: 'slide-2' })).toEqual(['slide-2', 'slide-3', 'slide-4']);
  });
});

const shapeObject: ShapeObject = {
  id: 'shape-1', type: 'shape', geometry: geometry(240, 120, 2),
  style: { shape: 'rectangle', backgroundColor: '#abcdef', outlineColor: '#123456', outlineWidth: 2 },
};

const imageObject: ImageObject = {
  id: 'image-1', type: 'image', geometry: geometry(420, 150, 3),
  style: { opacity: 0.9 }, src: '/fixtures/test.png', alt: 'Test image',
};

const groupObject: GroupObject = {
  id: 'group-1', type: 'group', geometry: { x: 80, y: 90, width: 460, height: 120, rotation: 15, zIndex: 4 },
  childIds: ['text-1', 'shape-1', 'image-1'], name: 'Mixed group',
};

const drawingObject: DrawingObject = {
  id: 'drawing-1', type: 'drawing', geometry: geometry(40, 50, 5),
  points: [{ x: 40, y: 50 }, { x: 80, y: 90 }], style: { color: '#ef4444', width: 4 },
};

const comment: SlideComment = { id: 'comment-1', text: 'Review this slide', author: 'You', createdAt: 1, resolved: false };

function source(): TextSlideSource {
  return {
    id: 'slide-1', title: 'Title', subtitle: 'Subtitle', bodyHtml: '<p>Body</p>', reference: 'John 3:16',
    layout: 'title-body', fontFamily: 'Arial', fontSize: 28, titleFontSize: 48, subtitleFontSize: 28,
    textColor: '#111111', titleColor: '#222222', subtitleColor: '#333333', highlightColor: '#ffff00',
    titleAlign: 'center', subtitleAlign: 'left', bodyAlign: 'left', titleOffsetX: 0, titleOffsetY: 0,
    subtitleOffsetX: 0, subtitleOffsetY: 0, titleWidth: 800, titleHeight: 100, subtitleWidth: 600,
    subtitleHeight: 60, bodyWidth: 900, bodyHeight: 400, bodyOffsetX: 0, bodyOffsetY: 0,
    background: '#ffffff', transitionType: 'fade', animationObjectIds: ['text-1'], showTitle: true, showSubtitle: true, showBody: true,
    objectIds: { title: 'title-1', subtitle: 'subtitle-1', body: 'body-1' },
    shapeObjects: [shapeObject], imageObjects: [imageObject], groupObjects: [groupObject], textObjects: [textObject], drawingObjects: [drawingObject], comments: [comment], rehearsalDurationMs: 1250, updatedAt: 1,
  };
}

describe('presentation model', () => {
  it('resolves persisted active slides and safely falls back when the id is invalid', () => {
    const document = createPresentationDocument();
    const second = createPresentationSlide();
    const withTwoSlides = { ...document, slides: [...document.slides, second] };

    expect(resolveSelectedSlideId(withTwoSlides, second.id)).toBe(second.id);
    expect(resolveSelectedSlideId(withTwoSlides, 'missing-slide')).toBe(document.slides[0].id);
    expect(resolveSelectedSlideId({ ...document, slides: [] }, second.id)).toBeNull();
  });
  it('calculates a bounded aspect-ratio-preserving fit zoom', () => {
    expect(fitPresentationZoomPercent(1280, 720)).toBe(98);
    expect(fitPresentationZoomPercent(320, 720)).toBe(100);
    expect(fitPresentationZoomPercent(2400, 400)).toBe(27);
  });
  it('creates valid documents and slides with stable structural defaults', () => {
    const document = createPresentationDocument('Test deck');
    const extraSlide = createPresentationSlide('blank');

    expect(document.metadata.title).toBe('Test deck');
    expect(document.slides).toHaveLength(1);
    expect(document.slides[0].layout).toBe('title-slide');
    expect(extraSlide.layout).toBe('blank');
    expect(document.slides[0].id).toMatch(/^slide-/);
    expect(extraSlide.id).toMatch(/^slide-/);
    expect(extraSlide.id).not.toBe(document.slides[0].id);
    expect(validatePresentationDocument(document)).toEqual([]);
  });

  it('converts text, shape, image, bullet, and group data into a presentation slide', () => {
    const slide = textSlideToPresentationSlide(source());
    const objects = slide.objects;

    expect(objects.map((object) => object.id)).toEqual(expect.arrayContaining(['title-1', 'subtitle-1', 'body-1', 'shape-1', 'image-1', 'text-1', 'group-1']));
    expect(objects.find((object) => object.id === 'text-1')).toMatchObject({ text: 'First\nSecond', paragraphs: textObject.paragraphs });
    expect(objects.find((object) => object.id === 'shape-1')).toMatchObject({ type: 'shape', style: shapeObject.style });
    expect(objects.find((object) => object.id === 'image-1')).toMatchObject({ type: 'image', src: imageObject.src, alt: imageObject.alt });
    expect(objects.find((object) => object.id === 'group-1')).toMatchObject({ type: 'group', childIds: groupObject.childIds });
    expect(objects.find((object) => object.id === 'drawing-1')).toMatchObject({ type: 'drawing', points: drawingObject.points });
    expect(slide.comments).toEqual([comment]);
    expect(slide.rehearsalDurationMs).toBe(1250);
    expect(slide.transition.type).toBe('fade');
    expect(slide.animations).toHaveLength(1);
    expect(slide.animations[0].objectId).toBe('text-1');
    expect(validatePresentationDocument({ ...createPresentationDocument(), slides: [slide] })).toEqual([]);
  });

  it('round-trips persistent slide data without losing object identity or bullet state', () => {
    const slide = textSlideToPresentationSlide(source());
    const fallback = source();
    const roundTrip = presentationSlideToTextSlide(slide, fallback);

    expect(roundTrip.id).toBe('slide-1');
    expect(roundTrip.objectIds).toEqual({ title: 'title-1', subtitle: 'subtitle-1', body: 'body-1' });
    expect(roundTrip.textObjects).toEqual([textObject]);
    expect(roundTrip.shapeObjects).toEqual([shapeObject]);
    expect(roundTrip.imageObjects).toEqual([imageObject]);
    expect(roundTrip.groupObjects).toEqual([groupObject]);
    expect(roundTrip.drawingObjects).toEqual([drawingObject]);
    expect(roundTrip.comments).toEqual([comment]);
    expect(roundTrip.rehearsalDurationMs).toBe(1250);
    expect(roundTrip.textObjects?.[0].paragraphs[0].bullet).toBe('bullet');
    expect(roundTrip.transitionType).toBe('fade');
    expect(roundTrip.animationObjectIds).toEqual(['text-1']);
  });

  it('keeps authored slide backgrounds and inline body styling through conversion', () => {
    const styled = source();
    styled.background = '#cdeeff';
    styled.bodyHtml = '<p style="text-align:center"><span style="color:#6d28d9;background-color:#ddd6fe;font-size:72px;font-weight:700">Styled words</span></p>';
    const slide = textSlideToPresentationSlide(styled);
    const body = slide.objects.find((object): object is TextObject => object.type === 'text' && object.placeholder?.kind === 'body');
    expect(slide.background.color).toBe('#cdeeff');
    expect(body?.html).toBe(styled.bodyHtml);
    expect(presentationSlideToTextSlide(slide, styled).bodyHtml).toBe(styled.bodyHtml);
  });

  it('deep-clones documents and validates duplicate IDs and invalid geometry', () => {
    const document = createPresentationDocument();
    document.slides[0].objects = [textObject];
    const clone = clonePresentationDocument(document);
    clone.slides[0].objects[0].geometry.x = 999;

    expect(document.slides[0].objects[0].geometry.x).toBe(80);
    expect(validatePresentationDocument(document)).toEqual([]);
    expect(validatePresentationDocument({ ...document, slides: [{ ...document.slides[0], objects: [textObject, { ...textObject }] }] })).toContain('Duplicate object id: text-1');
    expect(validatePresentationDocument({ ...document, slides: [{ ...document.slides[0], objects: [{ ...textObject, geometry: { ...textObject.geometry, width: -1 } }] }] })).toContain('Invalid dimensions for object: text-1');
  });

  it('duplicates a slide with a caller-owned stable id', () => {
    const document = { ...createPresentationDocument(), slides: [textSlideToPresentationSlide(source())] };
    const result = duplicateSlide(document, 'slide-1', 'slide-copy-1');

    expect(result.slide?.id).toBe('slide-copy-1');
    expect(result.document.slides.map((slide) => slide.id)).toEqual(['slide-1', 'slide-copy-1']);
    expect(result.document.slides[1].objects.map((object) => object.id)).not.toContain('title-1');
  });

  it('reorders slides without changing their stable identities', () => {
    const first = createPresentationSlide('title-slide');
    const second = createPresentationSlide('blank');
    const document = { ...createPresentationDocument(), slides: [first, second] };
    const reordered = reorderSlides(document, 1, 0);

    expect(reordered.slides.map((slide) => slide.id)).toEqual([second.id, first.id]);
    expect(reordered.slides[0].layout).toBe('blank');
  });

  it('round-trips the versioned portable document format with groups and slide metadata', () => {
    const slide = textSlideToPresentationSlide(source());
    const document = { ...createPresentationDocument('Portable deck'), slides: [slide, { ...slide, id: 'slide-2' }] };
    const restored = parsePresentationDocument(serializePresentationDocument(document));

    expect(restored).toEqual(document);
    expect(restored.slides[0].objects.find((object) => object.type === 'group')).toMatchObject({ childIds: ['text-1', 'shape-1', 'image-1'] });
    expect(restored.slides[0].comments).toEqual([comment]);
    expect(restored.slides[0].transition.type).toBe('fade');
    expect(restored.slides[0].rehearsalDurationMs).toBe(1250);
  });

  it('preserves hidden slide state for audience-safe presentation workflows', () => {
    const document = createPresentationDocument('Hidden slides');
    const second = createPresentationSlide('blank');
    second.hidden = true;
    const restored = parsePresentationDocument(serializePresentationDocument({ ...document, slides: [document.slides[0], second] }));

    expect(restored.slides.map((slide) => slide.hidden)).toEqual([false, true]);
  });

  it('preserves the selected slide layout through the presentation model', () => {
    const slide = textSlideToPresentationSlide({ ...source(), layout: 'title-body' });
    slide.layout = 'blank';
    const restored = parsePresentationDocument(serializePresentationDocument({ ...createPresentationDocument(), slides: [slide] }));

    expect(restored.slides[0].layout).toBe('blank');
    expect(presentationSlideToTextSlide(restored.slides[0], source()).layout).toBe('full-text');
  });

  it('rejects unsupported versions and invalid group references', () => {
    const document = createPresentationDocument();
    const invalid = { ...document, slides: [{ ...document.slides[0], objects: [{ ...groupObject }] }] };

    expect(() => parsePresentationDocument(JSON.stringify({ format: 'morija-presentation', version: 2, document }))).toThrow('Unsupported presentation file format or version');
    expect(() => parsePresentationDocument(JSON.stringify({ format: 'morija-presentation', version: 1, document: invalid }))).toThrow('Missing group child text-1');
    expect(() => parsePresentationDocument('{not-json')).toThrow();
  });

  it('rejects malformed object entries without crashing during validation', () => {
    const malformed = {
      version: 1,
      slides: [{ id: 'slide-1', objects: [null] }],
    };
    expect(() => parsePresentationDocument(malformed)).toThrow('Invalid object structure');
  });
  it('keeps the selected Design preset and placeholder content through edit and reload', () => {
    const initial = source();
    const slide = textSlideToPresentationSlide({ ...initial, presentationLayout: 'comparison' });
    const restored = parsePresentationDocument(serializePresentationDocument({ ...createPresentationDocument(), slides: [slide] }));
    const editable = presentationSlideToTextSlide(restored.slides[0], initial);

    expect(restored.slides[0].layout).toBe('comparison');
    expect(editable.presentationLayout).toBe('comparison');
    expect(editable.title).toBe('Title');
    expect(editable.bodyHtml).toContain('Body');
  });

  it('applies every Design preset to the rendered placeholder arrangement without losing content', () => {
    const cases = [
      ['title-and-content', true, false, true],
      ['title-only', true, false, false],
      ['section-header', true, true, false],
      ['two-content', true, true, true],
      ['comparison', true, true, true],
      ['blank', false, false, false],
      ['content-with-caption', true, true, true],
      ['picture-with-caption', true, true, true],
    ] as const;
    for (const [layout, showTitle, showSubtitle, showBody] of cases) {
      const editable = presentationSlideToTextSlide(
        textSlideToPresentationSlide({ ...source(), presentationLayout: layout }),
        source(),
      );
      expect(editable.presentationLayout).toBe(layout);
      expect([editable.showTitle, editable.showSubtitle, editable.showBody]).toEqual([showTitle, showSubtitle, showBody]);
      expect(editable.title).toBe('Title');
      expect(editable.subtitle).toBe('Subtitle');
      expect(editable.bodyHtml).toContain('Body');
    }
  });
  it('validates and round-trips editable hyperlinks', () => {
    expect(isValidHyperlink('https://example.com')).toBe(true);
    expect(isValidHyperlink('mailto:test@example.com')).toBe(true);
    expect(isValidHyperlink('javascript:alert(1)')).toBe(false);
    expect(() => serializePresentationDocument({ ...createPresentationDocument(), slides: [textSlideToPresentationSlide({ ...source(), textObjects: [{ ...textObject, runs: [{ ...textObject.runs[0], link: 'javascript:alert(1)' }] }] })] })).toThrow('Invalid hyperlink');

    const linked = { ...textObject, runs: [{ ...textObject.runs[0], link: 'https://example.com' }] };
    const slide = textSlideToPresentationSlide({ ...source(), textObjects: [linked] });
    const restored = presentationSlideToTextSlide(parsePresentationDocument(serializePresentationDocument({ ...createPresentationDocument(), slides: [slide] })).slides[0], source());
    expect(restored.textObjects?.[0].runs[0].link).toBe('https://example.com');
  });

});
