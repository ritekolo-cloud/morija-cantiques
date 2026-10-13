import { AppError } from '../../middleware/error.middleware';

export function assertMatchingRevision(currentRevision: number, baseRevision: number): void {
  if (currentRevision !== baseRevision) throw new AppError('Presentation has changed since this draft was loaded.', 409, { code: 'REVISION_CONFLICT', details: { currentRevision } });
}
export function nextRevision(baseRevision: number): number { return baseRevision + 1; }