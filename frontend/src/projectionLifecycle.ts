export type AudienceCloseMode = 'close-window' | 'history-back';

export function audienceCloseMode(hasOpener: boolean): AudienceCloseMode {
  return hasOpener ? 'close-window' : 'history-back';
}
