import { describe, expect, it } from 'vitest';
import { fitPresentationText } from '../textModel';

describe('presentation text fitting', () => {
  it('chooses the largest size that fits and returns to the preferred size when content is removed', () => {
    const measure = (size: number) => size * 10;
    expect(fitPresentationText({ preferredSize: 40, minimumSize: 18, availableHeight: 250, measureHeight: measure })).toEqual({ fontSize: 25, overflow: false });
    expect(fitPresentationText({ preferredSize: 40, minimumSize: 18, availableHeight: 500, measureHeight: measure })).toEqual({ fontSize: 40, overflow: false });
  });

  it('signals overflow when even the readable minimum cannot fit', () => {
    expect(fitPresentationText({ preferredSize: 40, minimumSize: 18, availableHeight: 100, measureHeight: (size) => size * 10 })).toEqual({ fontSize: 18, overflow: true });
  });
});
