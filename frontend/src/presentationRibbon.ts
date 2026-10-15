export const presentationRibbonTabs = ['Home', 'Insert', 'Draw', 'Design', 'Transitions', 'Animations', 'Slide Show', 'Record', 'Review', 'View', 'Help'] as const;

export type PresentationRibbonTab = typeof presentationRibbonTabs[number];

export const presentationRibbonGroups: Record<PresentationRibbonTab, readonly string[]> = {
  Home: ['Clipboard', 'Text', 'Slides', 'Font', 'Text color', 'Text background', 'Paragraph'],
  Insert: ['Text', 'Shapes', 'Pictures', 'Media', 'Slides', 'Tables and charts', 'Diagrams'],
  Draw: ['Ink', 'Drawing', 'Arrange'],
  Design: ['Background', 'Layout', 'Text-box fill'],
  Transitions: ['Transition'],
  Animations: ['Object animation'],
  'Slide Show': ['Start'],
  Record: ['Rehearse timings'],
  Review: ['Slide comments'],
  View: ['Presentation views', 'Portable file'],
  Help: ['Keyboard shortcuts'],
};

export function isPresentationRibbonTabActive(activeTab: PresentationRibbonTab, tab: PresentationRibbonTab) {
  return activeTab === tab;
}
