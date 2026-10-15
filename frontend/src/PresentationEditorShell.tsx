import { FileText, Redo2, Save, Undo2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { ShapeKind } from './ShapeEditorOverlay';
import type { SlideComment, SlideLayout, SupportedTransitionType } from './presentationModel';
import { isPresentationRibbonTabActive, presentationRibbonTabs, type PresentationRibbonTab } from './presentationRibbon';

type Props = {
  title: string;
  saveState: 'saved' | 'unsaved';
  canUndo: boolean;
  canRedo: boolean;
  onTitleChange: (title: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExport: () => void;
  onExportPowerPoint: () => void;
  onImport: (file: File) => void;
  onImportPowerPoint: (file: File) => void;
  statusMessage?: string;
  onNewSlide: () => void;
  onDuplicateSlide: () => void;
  onRemoveSlide: () => void;
  onFormat: (command: string, value?: string) => void;
  shapeInsertKind: ShapeKind | null;
  shapeSelected: boolean;
  objectSelected: boolean;
  selectedObjectCount: number;
  groupSelected: boolean;
  shapeFill: string;
  shapeOutline: string;
  shapeOutlineWidth: number;
  textBoxFill: string;
  onTextBoxFill: (color: string) => void;
  textColor: string;
  fontSize: number;
  onShapeInsert: (kind: ShapeKind | null) => void;
  onImageInsert: (file: File) => void;
  onAudioInsert: (file: File) => void;
  onVideoInsert: (file: File) => void;
  onTextInsert: () => void;
  onInsertTable: () => void;
  onInsertChart: () => void;
  onInsertDiagram: () => void;
  onStartSlideShow: (fromCurrent: boolean) => void;
  onCancelSlideShow?: () => void;
  slideShowOpen?: boolean;
  viewMode: 'editor' | 'sorter';
  onViewMode: (mode: 'editor' | 'sorter') => void;
  slideBackground: string;
  onSlideBackground: (color: string) => void;
  slideLayout: SlideLayout;
  onSlideLayout: (layout: SlideLayout) => void;
  transitionType: SupportedTransitionType;
  onTransitionChange: (type: SupportedTransitionType) => void;
  transitionDuration: number;
  onTransitionDurationChange: (duration: number) => void;
  animationSelected: boolean;
  animationType: 'none' | 'appear' | 'fade' | 'fly-in';
  animationDuration: number;
  onAnimationDurationChange: (duration: number) => void;
  onAnimationCommand: (command: 'appear' | 'fade' | 'fly-in' | 'clear') => void;
  onFitToWindow: () => void;
  onPrint: () => void;
  slideHidden: boolean;
  onToggleSlideHidden: () => void;
  drawingMode: boolean;
  drawingColor: string;
  drawingWidth: number;
  onDrawingChange: (change: 'toggle' | 'clear') => void;
  onDrawingColor: (color: string) => void;
  onDrawingWidth: (width: number) => void;
  comments: SlideComment[];
  commentDraft: string;
  onCommentDraft: (value: string) => void;
  onAddComment: () => void;
  onResolveComment: (id: string) => void;
  onDeleteComment: (id: string) => void;
  rehearsalActive: boolean;
  rehearsalElapsed: number;
  rehearsalDurations: Record<string, number>;
  onRehearsalCommand: (command: 'start' | 'stop' | 'reset') => void;
  onShapeCommand: (command: string, value?: string) => void;
  snapEnabled: boolean;
  onSnapToggle: (enabled: boolean) => void;
  children: ReactNode;
};

export function PresentationEditorShell({ title, saveState, canUndo, canRedo, onTitleChange, onUndo, onRedo, onSave, onExport, onExportPowerPoint, onImport, onImportPowerPoint, statusMessage, onNewSlide, onDuplicateSlide, onRemoveSlide, onFormat, shapeInsertKind, shapeSelected, objectSelected, selectedObjectCount, groupSelected, shapeFill, shapeOutline, shapeOutlineWidth, textBoxFill, onTextBoxFill, textColor, fontSize, onShapeInsert, onImageInsert, onAudioInsert, onVideoInsert, onTextInsert, onInsertTable, onInsertChart, onInsertDiagram, onStartSlideShow, onCancelSlideShow, slideShowOpen = false, onShapeCommand, snapEnabled, onSnapToggle, viewMode, onViewMode, slideBackground, onSlideBackground, slideLayout, onSlideLayout, transitionType, onTransitionChange, transitionDuration, onTransitionDurationChange, animationSelected, animationType, animationDuration, onAnimationDurationChange, onAnimationCommand, onFitToWindow, onPrint, slideHidden, onToggleSlideHidden, drawingMode, drawingColor, drawingWidth, onDrawingChange, onDrawingColor, onDrawingWidth, comments, commentDraft, onCommentDraft, onAddComment, onResolveComment, onDeleteComment, rehearsalActive, rehearsalElapsed, rehearsalDurations, onRehearsalCommand, children }: Props) {
  const [activeTab, setActiveTab] = useState<PresentationRibbonTab>('Home');
  const [fontSizeDraft, setFontSizeDraft] = useState(String(fontSize));
  useEffect(() => {
    if (!(document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('presentation-ribbon-font-size'))) setFontSizeDraft(String(fontSize));
  }, [fontSize]);
  function commitFontSize() {
    const parsed = Number(fontSizeDraft);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 400) { setFontSizeDraft(String(fontSize)); return; }
    const normalized = String(Math.round(parsed));
    setFontSizeDraft(normalized);
    onFormat('fontSize', normalized);
  }
  return (
    <section className="presentation-editor-shell" aria-label="Text slide editor">
      <header className="presentation-titlebar">
        <div className="presentation-titlebar-brand"><FileText size={18} /><input aria-label="Presentation name" value={title} onChange={(event) => onTitleChange(event.target.value)} /></div>
        <span className={`presentation-save-state ${saveState}`}>{statusMessage || (saveState === 'saved' ? 'Saved' : 'Unsaved changes')}</span>
        <div className="presentation-quick-access" aria-label="Quick Access Toolbar">
          <button type="button" title="Undo" aria-label="Undo" disabled={!canUndo} onClick={onUndo}><Undo2 size={16} /></button>
          <button type="button" title="Redo" aria-label="Redo" disabled={!canRedo} onClick={onRedo}><Redo2 size={16} /></button>
          <button type="button" title="Save presentation" aria-label="Save presentation" onClick={onSave}><Save size={16} /></button>
        </div>
      </header>
      <nav className="presentation-ribbon-tabs" aria-label="Ribbon tabs">
        {presentationRibbonTabs.map((tab) => <button key={tab} type="button" className={isPresentationRibbonTabActive(activeTab, tab) ? 'active' : ''} title={`${tab} tab`} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>
      <div className="presentation-ribbon" aria-label={`${activeTab} ribbon`}>
        {activeTab === 'Insert' && <>
          <RibbonGroup label="Text"><RibbonButton label="Text Box" onClick={onTextInsert} /></RibbonGroup>
          <RibbonGroup label="Shapes"><select className="presentation-ribbon-select" aria-label="Insert shape" value={shapeInsertKind || ''} onChange={(event) => onShapeInsert((event.target.value || null) as ShapeKind | null)}><option value="">Shapes</option><option value="rectangle">Rectangle</option><option value="rounded-rectangle">Rounded Rectangle</option><option value="ellipse">Ellipse</option><option value="triangle">Triangle</option><option value="diamond">Diamond</option><option value="line">Line</option><option value="arrow">Arrow</option><option value="star">Star</option><option value="heart">Heart</option><option value="chevron">Chevron</option><option value="callout">Callout</option></select></RibbonGroup>
          <RibbonGroup label="Pictures"><label className="presentation-ribbon-file">Insert picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImageInsert(file); event.currentTarget.value = ''; }} /></label></RibbonGroup>
          <RibbonGroup label="Media"><label className="presentation-ribbon-file">Insert audio<input type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) onAudioInsert(file); event.currentTarget.value = ''; }} /></label><label className="presentation-ribbon-file">Insert video<input type="file" accept="video/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) onVideoInsert(file); event.currentTarget.value = ''; }} /></label></RibbonGroup>
          <RibbonGroup label="Slides"><RibbonButton label="New Slide" onClick={onNewSlide} /><RibbonButton label="Duplicate" onClick={onDuplicateSlide} /></RibbonGroup>
        </>}
        {activeTab === 'Insert' && <><RibbonGroup label="Tables and charts"><RibbonButton label="Table" onClick={onInsertTable} /><RibbonButton label="Chart" onClick={onInsertChart} /></RibbonGroup><RibbonGroup label="Diagrams"><RibbonButton label="Flowchart" onClick={onInsertDiagram} /></RibbonGroup></>}
        {activeTab === 'Slide Show' && <RibbonGroup label="Start"><button type="button" className="presentation-ribbon-button" onClick={() => onStartSlideShow(false)}>From beginning</button><button type="button" className="presentation-ribbon-button" onClick={() => onStartSlideShow(true)}>From current slide</button>{onCancelSlideShow && <RibbonButton label="Cancel projection" disabled={!slideShowOpen} onClick={onCancelSlideShow} />}</RibbonGroup>}
        {activeTab === 'Design' && <><RibbonGroup label="Background"><label className="presentation-ribbon-color">Slide color<input aria-label="Slide background color" type="color" value={slideBackground} onChange={(event) => onSlideBackground(event.target.value)} /></label><HexColorField label="Slide" ariaLabel="Slide background hex" value={slideBackground} onApply={onSlideBackground} /><select className="presentation-ribbon-select" aria-label="Background preset" value={slideBackground} onChange={(event) => onSlideBackground(event.target.value)}><option value="#ffffff">White</option><option value="#cdeeff">Sky</option><option value="#24104f">Morija purple</option><option value="#111827">Charcoal</option><option value="#fef3c7">Warm</option></select></RibbonGroup><RibbonGroup label="Layout"><select className="presentation-ribbon-select" aria-label="Slide layout preset" value={slideLayout} onChange={(event) => onSlideLayout(event.target.value as Props['slideLayout'])}><option value="title-and-content">Title + content</option><option value="title-only">Title only</option><option value="section-header">Section header</option><option value="two-content">Two content</option><option value="comparison">Comparison</option><option value="blank">Blank</option><option value="content-with-caption">Content with caption</option><option value="picture-with-caption">Picture with caption</option></select></RibbonGroup></>}
        {activeTab === 'Transitions' && <RibbonGroup label="Transition"><select className="presentation-ribbon-select" aria-label="Slide transition" value={transitionType} onChange={(event) => onTransitionChange(event.target.value as SupportedTransitionType)}><option value="none">None</option><option value="fade">Fade</option><option value="push">Push</option><option value="wipe">Wipe</option></select><label className="presentation-ribbon-number-label">Duration<input className="presentation-ribbon-number" aria-label="Transition duration milliseconds" type="number" min="0" max="3000" step="50" value={transitionDuration} onChange={(event) => onTransitionDurationChange(Number(event.target.value) || 0)} /></label></RibbonGroup>}
        {activeTab === 'Animations' && <RibbonGroup label="Object animation"><select className="presentation-ribbon-select" aria-label="Animation effect" value={animationType} onChange={(event) => onAnimationCommand(event.target.value as 'appear' | 'fade' | 'fly-in')}><option value="none">Choose effect</option><option value="appear">Appear</option><option value="fade">Fade in</option><option value="fly-in">Fly in</option></select><label className="presentation-ribbon-number-label">Duration<input className="presentation-ribbon-number" aria-label="Animation duration milliseconds" type="number" min="0" max="3000" step="50" value={animationDuration} disabled={!animationSelected} onChange={(event) => onAnimationDurationChange(Number(event.target.value) || 0)} /></label><RibbonButton label="Clear animation" disabled={!animationSelected} onClick={() => onAnimationCommand('clear')} /><span className="presentation-ribbon-status">{animationSelected ? 'Selected object animated' : 'Select an object'}</span></RibbonGroup>}
        {activeTab === 'Draw' && <RibbonGroup label="Ink"><RibbonButton label={drawingMode ? 'Stop pen' : 'Pen'} onClick={() => onDrawingChange('toggle')} /><label className="presentation-ribbon-color">Ink color<input aria-label="Ink color" type="color" value={drawingColor} onChange={(event) => onDrawingColor(event.target.value)} /></label><input aria-label="Ink width" className="presentation-ribbon-number" type="number" min="1" max="24" value={drawingWidth} onChange={(event) => onDrawingWidth(Math.max(1, Math.min(24, Number(event.target.value) || 1)))} /><RibbonButton label="Clear ink" onClick={() => onDrawingChange('clear')} /></RibbonGroup>}
        {activeTab === 'Record' && <RibbonGroup label="Rehearse timings"><RibbonButton label={rehearsalActive ? 'Stop rehearsal' : 'Start rehearsal'} onClick={() => onRehearsalCommand(rehearsalActive ? 'stop' : 'start')} /><RibbonButton label="Reset timings" onClick={() => onRehearsalCommand('reset')} /><span className="presentation-ribbon-status">{rehearsalActive ? `Recording ${Math.floor(rehearsalElapsed / 1000)}s` : `${Object.keys(rehearsalDurations).length} slide timings`}</span></RibbonGroup>}
        {activeTab === 'Review' && <RibbonGroup label="Slide comments"><textarea aria-label="New comment" value={commentDraft} onChange={(event) => onCommentDraft(event.target.value)} placeholder="Add a comment" /><RibbonButton label="Add comment" onClick={onAddComment} />{comments.map((comment) => <span className={`presentation-comment ${comment.resolved ? 'resolved' : ''}`} key={comment.id}>{comment.text}<RibbonButton label={comment.resolved ? 'Reopen' : 'Resolve'} onClick={() => onResolveComment(comment.id)} /><RibbonButton label="Delete comment" onClick={() => onDeleteComment(comment.id)} /></span>)}</RibbonGroup>}
        {activeTab === 'Help' && <RibbonGroup label="Keyboard shortcuts"><div className="presentation-help-content"><strong>Text</strong><span>Ctrl+A select all · Ctrl+C/Ctrl+V copy and paste · Enter new paragraph</span><strong>Objects</strong><span>Click to select · Shift-click additive selection · Ctrl+D duplicate · Delete remove · Ctrl+Z undo · Ctrl+Y redo</span><strong>Slides</strong><span>Ctrl+M new slide · Slide sorter reorders slides</span><strong>Audience</strong><span>Arrow keys, PageUp/PageDown, Space navigate · Escape exits</span></div></RibbonGroup>}
        {activeTab === 'View' && <><RibbonGroup label="Presentation views"><RibbonButton label="Normal" onClick={() => onViewMode('editor')} /><RibbonButton label="Slide sorter" onClick={() => onViewMode('sorter')} /><RibbonButton label={slideHidden ? 'Show slide' : 'Hide slide'} onClick={onToggleSlideHidden} /><RibbonButton label="Fit to window" onClick={onFitToWindow} /><RibbonButton label="Print / Export PDF" onClick={onPrint} /></RibbonGroup><RibbonGroup label="Portable file"><label className="presentation-ribbon-file">Open presentation<input type="file" accept="application/json,.json,.morija.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = ''; }} /></label><RibbonButton label="Export presentation JSON" onClick={onExport} /><RibbonButton label="Export PowerPoint" onClick={onExportPowerPoint} /><label className="presentation-ribbon-file">Open PowerPoint<input type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportPowerPoint(file); event.currentTarget.value = ''; }} /></label></RibbonGroup></>}
        {activeTab === 'Home' && <>
        <RibbonGroup label="Clipboard"><RibbonButton label="Paste" onClick={() => onFormat('paste')} /><RibbonButton label="Cut" onClick={() => onFormat('cut')} /><RibbonButton label="Copy" onClick={() => onFormat('copy')} /></RibbonGroup>
        <RibbonGroup label="Text"><RibbonButton label="Text Box" onClick={onTextInsert} /></RibbonGroup>
        <RibbonGroup label="Slides"><RibbonButton label="New Slide" onClick={onNewSlide} /><RibbonButton label="Duplicate" onClick={onDuplicateSlide} /><RibbonButton label="Remove" onClick={onRemoveSlide} /></RibbonGroup>
        <RibbonGroup label="Font"><select className="presentation-ribbon-select" aria-label="Font family" defaultValue="Arial" onChange={(event) => onFormat('fontName', event.target.value)}><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Trebuchet MS</option></select><label className="presentation-ribbon-number-label">Size<input className="presentation-ribbon-number presentation-ribbon-font-size" aria-label="Font size in points" type="number" min="1" max="400" step="1" value={fontSizeDraft} onChange={(event) => setFontSizeDraft(event.target.value)} onBlur={commitFontSize} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitFontSize(); } }} /><span>pt</span></label><RibbonButton label="A+" onClick={() => onFormat('increaseFontSize')} /><RibbonButton label="A−" onClick={() => onFormat('decreaseFontSize')} /><RibbonButton label="Bold" onClick={() => onFormat('bold')} /><RibbonButton label="Italic" onClick={() => onFormat('italic')} /><RibbonButton label="Underline" onClick={() => onFormat('underline')} /><RibbonButton label="Link" onClick={() => onFormat('createLink')} /><RibbonButton label="Unlink" onClick={() => onFormat('unlink')} /></RibbonGroup>
        <RibbonGroup label="Text color"><label className="presentation-ribbon-color"><span>Text Color</span><input aria-label="Text color picker" type="color" value={textColor} onChange={(event) => onFormat('textColor', event.target.value)} /></label><HexColorField label="Text" ariaLabel="Text color hex" value={textColor} onApply={(value) => onFormat('textColor', value)} /><select className="presentation-ribbon-select" aria-label="Text color preset" defaultValue="#24104f" onChange={(event) => onFormat('textColor', event.target.value)}><option value="#24104f">Purple</option><option value="#6d28d9">Violet</option><option value="#111827">Black</option><option value="#ffffff">White</option><option value="#b91c1c">Red</option></select></RibbonGroup>
        <RibbonGroup label="Text background"><label className="presentation-ribbon-color"><span>Highlight Color</span><input aria-label="Text highlight color" type="color" defaultValue="#fef3c7" onChange={(event) => onFormat('hiliteColor', event.target.value)} /></label><HexColorField label="Highlight" ariaLabel="Text highlight hex" value="#fef3c7" onApply={(value) => onFormat('hiliteColor', value)} /><select className="presentation-ribbon-select" aria-label="Text highlight preset" defaultValue="#fef3c7" onChange={(event) => onFormat('hiliteColor', event.target.value)}><option value="#fef3c7">Warm</option><option value="#ddd6fe">Violet tint</option><option value="#dbeafe">Sky tint</option><option value="transparent">No highlight</option></select><RibbonButton label="No Highlight" onClick={() => onFormat('hiliteColor', 'transparent')} /></RibbonGroup>
        <RibbonGroup label="Paragraph"><RibbonButton label="Bullets" onClick={() => onFormat('insertUnorderedList')} /><RibbonButton label="Numbered" onClick={() => onFormat('insertOrderedList')} /><RibbonButton label="Left" onClick={() => onFormat('justifyLeft')} /><RibbonButton label="Center" onClick={() => onFormat('justifyCenter')} /><RibbonButton label="Right" onClick={() => onFormat('justifyRight')} /></RibbonGroup>
        </>}
        {activeTab === 'Draw' && <>
        <RibbonGroup label="Drawing"><select className="presentation-ribbon-select" aria-label="Shapes" value={shapeInsertKind || ''} onChange={(event) => onShapeInsert((event.target.value || null) as ShapeKind | null)}><option value="">Shapes</option><option value="rectangle">Rectangle</option><option value="rounded-rectangle">Rounded Rectangle</option><option value="ellipse">Ellipse</option><option value="triangle">Triangle</option><option value="diamond">Diamond</option><option value="line">Line</option><option value="arrow">Arrow</option><option value="star">Star</option><option value="heart">Heart</option><option value="chevron">Chevron</option><option value="callout">Callout</option></select><label className="presentation-ribbon-file">Pictures<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImageInsert(file); event.currentTarget.value = ''; }} /></label><label className="presentation-ribbon-color">Fill<input type="color" disabled={!shapeSelected} value={shapeFill.startsWith('#') ? shapeFill : '#dbeafe'} onChange={(event) => onShapeCommand('fill', event.target.value)} /></label><select className="presentation-ribbon-select" aria-label="Fill preset" disabled={!shapeSelected} value={shapeFill} onChange={(event) => onShapeCommand('fill', event.target.value)}><option value="#dbeafe">Blue</option><option value="#fecaca">Red</option><option value="#bbf7d0">Green</option><option value="#fde68a">Yellow</option><option value="transparent">No fill</option></select><label className="presentation-ribbon-color">Outline<input type="color" disabled={!shapeSelected} value={shapeOutline.startsWith('#') ? shapeOutline : '#1e3a8a'} onChange={(event) => onShapeCommand('outline', event.target.value)} /></label><select className="presentation-ribbon-select" aria-label="Outline preset" disabled={!shapeSelected} value={shapeOutline} onChange={(event) => onShapeCommand('outline', event.target.value)}><option value="#1e3a8a">Blue</option><option value="#991b1b">Red</option><option value="#166534">Green</option><option value="#111827">Black</option></select><select className="presentation-ribbon-select" aria-label="Outline width" disabled={!shapeSelected} value={String(shapeOutlineWidth)} onChange={(event) => onShapeCommand('outlineWidth', event.target.value)}><option value="0">No outline</option><option value="1">Thin</option><option value="2">Medium</option><option value="4">Thick</option></select><RibbonButton label="Front" disabled={!objectSelected} onClick={() => onShapeCommand('bringToFront')} /><RibbonButton label="Back" disabled={!objectSelected} onClick={() => onShapeCommand('sendToBack')} /><RibbonButton label="Delete" disabled={!objectSelected} onClick={() => onShapeCommand('delete')} /><RibbonButton label="Group" disabled={selectedObjectCount < 2} onClick={() => onShapeCommand('group')} /><RibbonButton label="Ungroup" disabled={!groupSelected} onClick={() => onShapeCommand('ungroup')} /><RibbonButton label="Align Left" disabled={selectedObjectCount < 2} onClick={() => onShapeCommand('alignLeft')} /><RibbonButton label="Align Center" disabled={selectedObjectCount < 2} onClick={() => onShapeCommand('alignCenter')} /><RibbonButton label="Align Right" disabled={selectedObjectCount < 2} onClick={() => onShapeCommand('alignRight')} /><RibbonButton label="Align Top" disabled={selectedObjectCount < 2} onClick={() => onShapeCommand('alignTop')} /><RibbonButton label="Align Middle" disabled={selectedObjectCount < 2} onClick={() => onShapeCommand('alignMiddle')} /><RibbonButton label="Align Bottom" disabled={selectedObjectCount < 2} onClick={() => onShapeCommand('alignBottom')} /><RibbonButton label="Distribute H" disabled={selectedObjectCount < 3} onClick={() => onShapeCommand('distributeHorizontal')} /><RibbonButton label="Distribute V" disabled={selectedObjectCount < 3} onClick={() => onShapeCommand('distributeVertical')} /></RibbonGroup>
        <RibbonGroup label="Arrange"><RibbonButton label="Rotate Right 90°" disabled={!shapeSelected && !groupSelected} onClick={() => onShapeCommand('rotateRight')} /><RibbonButton label="Rotate Left 90°" disabled={!shapeSelected && !groupSelected} onClick={() => onShapeCommand('rotateLeft')} /><RibbonButton label="Flip Horizontal" disabled={!shapeSelected && !groupSelected} onClick={() => onShapeCommand('flipHorizontal')} /><RibbonButton label="Flip Vertical" disabled={!shapeSelected && !groupSelected} onClick={() => onShapeCommand('flipVertical')} /><label className="presentation-ribbon-check"><input type="checkbox" aria-label="Snap objects" checked={snapEnabled} onChange={(event) => onSnapToggle(event.target.checked)} />Snap</label></RibbonGroup>
        </>}
        {activeTab === 'Design' && <>
        <RibbonGroup label="Text-box fill"><label className="presentation-ribbon-color">Fill<input aria-label="Text-box fill color" type="color" disabled={!textBoxFill} value={textBoxFill.startsWith('#') ? textBoxFill : '#ffffff'} onChange={(event) => onTextBoxFill(event.target.value)} /></label><HexColorField label="Fill" ariaLabel="Text-box fill hex" value={textBoxFill || '#ffffff'} disabled={!textBoxFill} onApply={onTextBoxFill} /><select className="presentation-ribbon-select" aria-label="Text-box fill preset" disabled={!textBoxFill} value={textBoxFill || 'transparent'} onChange={(event) => onTextBoxFill(event.target.value)}><option value="transparent">No fill</option><option value="#ffffff">White</option><option value="#f5f3ff">Violet tint</option><option value="#fef3c7">Warm tint</option><option value="#111827">Charcoal</option></select></RibbonGroup>
        </>}
      </div>
      {children}
    </section>
  );
}

function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className="presentation-ribbon-group"><div className="presentation-ribbon-group-items">{children}</div><span>{label}</span></div>;
}

function RibbonButton({ label, onClick, disabled = false }: { label: string; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" className="presentation-ribbon-button" disabled={disabled} title={label} onMouseDown={(event) => { if (!disabled) event.preventDefault(); }} onClick={() => { if (!disabled) onClick?.(); }}>{label}</button>;
}

function HexColorField({ label, value, ariaLabel, disabled = false, onApply }: { label: string; value: string; ariaLabel: string; disabled?: boolean; onApply: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  function commit() {
    const normalized = draft.trim().startsWith('#') ? draft.trim() : `#${draft.trim()}`;
    if (/^#[0-9a-f]{6}$/i.test(normalized)) { setDraft(normalized); onApply(normalized); }
    else setDraft(value);
  }
  return <label className="presentation-ribbon-color presentation-ribbon-hex"><span>{label} hex</span><input aria-label={ariaLabel} type="text" inputMode="text" maxLength={7} value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} /></label>;
}
