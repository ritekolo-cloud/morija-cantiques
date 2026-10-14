import { describe, expect, it } from 'vitest';
import { audienceCloseMode } from '../projectionLifecycle';

describe('projection lifecycle', () => {
  it('closes script-opened audience windows instead of leaving a blank slide', () => {
    expect(audienceCloseMode(true)).toBe('close-window');
  });

  it('returns manually opened audience routes to the previous page', () => {
    expect(audienceCloseMode(false)).toBe('history-back');
  });
});
