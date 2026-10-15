import { isPresentationRibbonTabActive, presentationRibbonGroups, presentationRibbonTabs } from '../presentationRibbon';

describe('presentation ribbon organization', () => {
  it('keeps one persistent tab row with the expected tool groups', () => {
    expect(presentationRibbonTabs[0]).toBe('Home');
    expect(presentationRibbonTabs).toContain('Slide Show');
    expect(presentationRibbonGroups.Home).toContain('Text color');
    expect(presentationRibbonGroups.Design).toContain('Text-box fill');
    expect(presentationRibbonGroups.Draw).toContain('Arrange');
  });

  it('shows only the active tab group set', () => {
    expect(isPresentationRibbonTabActive('Home', 'Home')).toBe(true);
    expect(isPresentationRibbonTabActive('Home', 'Design')).toBe(false);
  });
});
