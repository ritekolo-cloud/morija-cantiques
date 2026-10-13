import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TextObject, TextRun } from './presentationModel';
import { deleteRunRange, effectiveTextFontSize, formatRunRange, lineRange, normalizeRuns, paragraphsForText, runsToEditableHtml, splitRunsAt, textFromRuns } from './textModel';

const SW = 1280; const SH = 720;
let internalTextClipboard: { text: string; runs: TextRun[]; paragraphs: TextObject['paragraphs'] } | null = null;
let internalTextPastePosition: { id: string; offset: number } | null = null;
let internalTextAfterCutText: string | null = null;
let internalObjectClipboard: TextObject[] = [];

type TextSelection = { start: number; end: number };
type ActiveFormatting = Pick<TextRun, 'fontFamily' | 'fontSize' | 'bold' | 'italic' | 'underline' | 'color'>;

function runsFromElement(root: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  const visit = (node: Node, inherited: Partial<TextRun> = {}) => {
    if (node.nodeType === Node.TEXT_NODE) { if (node.textContent) runs.push({ text: node.textContent, ...inherited }); return; }
    const element = node as HTMLElement; const next = { ...inherited }; const tag = element.tagName?.toLowerCase();
    if (tag === 'br') { runs.push({ text: '\n', ...inherited }); return; }
    if (tag === 'strong' || tag === 'b') next.bold = true; if (tag === 'em' || tag === 'i') next.italic = true; if (tag === 'u') next.underline = true;
    if (element.style?.fontFamily) next.fontFamily = element.style.fontFamily; if (element.style?.fontSize) next.fontSize = Number.parseFloat(element.style.fontSize); if (element.style?.color) next.color = element.style.color;
    if (tag === 'a' && element.getAttribute('href')) next.link = element.getAttribute('href') || undefined;
    Array.from(node.childNodes).forEach((child) => visit(child, next));
  };
  Array.from(root.childNodes).forEach((child) => visit(child)); return normalizeRuns(runs);
}

function selectionOffsets(root: HTMLElement) {
  const selection = window.getSelection(); if (!selection || !selection.rangeCount || !root.contains(selection.anchorNode)) return null;
  const nodeLength = (node: Node): number => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length || 0;
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName.toLowerCase() === 'br') return 1;
    return Array.from(node.childNodes).reduce((sum, child) => sum + nodeLength(child), 0);
  };
  const offsetAt = (container: Node, offset: number) => {
    let length = container.nodeType === Node.TEXT_NODE
      ? offset
      : Array.from(container.childNodes).slice(0, offset).reduce((sum, child) => sum + nodeLength(child), 0);
    let node: Node | null = container;
    while (node && node !== root) {
      const parent: Node | null = node.parentNode;
      if (!parent) break;
      let sibling = node.previousSibling;
      while (sibling) { length += nodeLength(sibling); sibling = sibling.previousSibling; }
      node = parent;
    }
    return length;
  };
  return { start: offsetAt(selection.anchorNode!, selection.anchorOffset), end: offsetAt(selection.focusNode!, selection.focusOffset) };
}

function setDomSelection(root: HTMLElement, start: number, end = start) {
  const walker = document.createTreeWalker(root, 1 | 4);
  const nodes: Array<{ node: Node; length: number }> = [];
  let node: Node | null;
  while ((node = walker.nextNode())) { const element = node as HTMLElement; if (node.nodeType === 3) nodes.push({ node, length: node.textContent?.length || 0 }); else if (element.tagName?.toLowerCase() === 'br') nodes.push({ node, length: 1 }); }
  const locate = (offset: number) => {
    let remaining = Math.max(0, offset);
    for (const entry of nodes) {
      if (entry.node.nodeType === 3) { if (remaining <= entry.length) return { node: entry.node, offset: remaining }; remaining -= entry.length; continue; }
      const parent = entry.node.parentNode; const childIndex = parent ? Array.prototype.indexOf.call(parent.childNodes, entry.node) : 0;
      if (remaining === 0) return { node: parent || root, offset: childIndex };
      if (remaining === 1) return { node: parent || root, offset: childIndex + 1 };
      remaining -= 1;
    }
    const last = nodes.at(-1); const parent = last?.node.parentNode; const childIndex = parent && last ? Array.prototype.indexOf.call(parent.childNodes, last.node) : -1;
    return last?.node.nodeType === 3 ? { node: last.node, offset: last.node.textContent?.length || 0 } : { node: parent || root, offset: childIndex + 1 };
  };
  const low = Math.min(start, end); const high = Math.max(start, end); const a = locate(low); const b = locate(high); const range = document.createRange();
  range.setStart(a.node, a.offset); range.setEnd(b.node, b.offset);
  const current = window.getSelection(); current?.removeAllRanges(); current?.addRange(range);
}

function paragraphIndexAt(text: string, offset: number) {
  return text.slice(0, offset).split('\n').length - 1;
}

function wordBoundary(text: string, offset: number, direction: -1 | 1) {
  if (direction < 0) {
    let cursor = Math.max(0, offset - 1);
    while (cursor > 0 && /\s/.test(text[cursor])) cursor -= 1;
    while (cursor > 0 && !/\s/.test(text[cursor - 1])) cursor -= 1;
    return cursor;
  }
  let cursor = Math.min(text.length, offset + 1);
  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
  while (cursor < text.length && !/\s/.test(text[cursor])) cursor += 1;
  return cursor;
}

function createText(id: string, geometry: { x: number; y: number; width: number; height: number }, zIndex: number): TextObject {
  return { id, type: 'text', geometry: { ...geometry, rotation: 0, zIndex }, style: { fontFamily: 'Arial', fontSize: 28, color: '#222222', textAlign: 'left' }, text: '', runs: [{ text: '' }], paragraphs: [{ alignment: 'left', bullet: null, indent: 0, lineSpacing: 1.15, paragraphSpacing: 0 }], verticalAlign: 'top', margins: { left: 12, right: 12, top: 10, bottom: 10 }, autofit: 'shrink-text' };
}

export function TextEditorOverlay({ texts, selectedIds = [], insertMode = false, onChange, onSelectionChange, onInsertComplete, onHistoryStart, onHistoryCommit, onHistoryCancel }: { texts: TextObject[]; selectedIds?: string[]; insertMode?: boolean; onChange: (texts: TextObject[]) => void; onSelectionChange: (ids: string[], additive?: boolean) => void; onInsertComplete?: () => void; onHistoryStart?: () => void; onHistoryCommit?: () => void; onHistoryCancel?: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null); const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 }); const [activeFormatting, setActiveFormatting] = useState<ActiveFormatting>({}); const [draftSelection, setDraftSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null); const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string; editing: boolean } | null>(null);
  const editingCommitRef = useRef(false);
  const editingTransactionStartedRef = useRef(false);
  const selectionRef = useRef<TextSelection>({ start: 0, end: 0 });
  const verticalColumnRef = useRef<number | null>(null);
  const selectionAnchorRef = useRef<number | null>(null);
  const pendingSelectionRef = useRef<{ id: string; next: TextSelection } | null>(null);
  const selectionLockUntilRef = useRef(0);
  const clipboardInsertionRef = useRef<number | null>(null);
  const ignoreSelectionSync = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null); const contentRefs = useRef(new Map<string, HTMLDivElement>()); const gesture = useRef<{ type: 'insert' | 'move' | 'resize' | 'rotate'; startX: number; startY: number; original?: TextObject } | null>(null);
  const point = (event: { clientX: number; clientY: number }) => { const root = rootRef.current; if (!root) return { x: 0, y: 0 }; const rect = root.getBoundingClientRect(); return { x: ((event.clientX - rect.left) / rect.width) * SW, y: ((event.clientY - rect.top) / rect.height) * SH }; };
  const syncSelection = (id: string) => { const root = contentRefs.current.get(id); const next = root && selectionOffsets(root); if (next && !ignoreSelectionSync.current && !pendingSelectionRef.current && Date.now() >= selectionLockUntilRef.current) { selectionRef.current = next; setSelection(next); if (next.start === next.end) selectionAnchorRef.current = next.start; else if (selectionAnchorRef.current === null) selectionAnchorRef.current = next.start; } };
  const restoreSelection = (id: string, next: TextSelection) => { const root = contentRefs.current.get(id); if (!root) return; ignoreSelectionSync.current = true; root.focus(); setDomSelection(root, next.start, next.end); selectionRef.current = next; setSelection(next); selectionAnchorRef.current = next.start === next.end ? next.start : selectionAnchorRef.current ?? next.start; window.setTimeout(() => { ignoreSelectionSync.current = false; }, 0); };
  const restoreSelectionAfterRender = (id: string, next: TextSelection) => { pendingSelectionRef.current = { id, next }; selectionLockUntilRef.current = Date.now() + 2000; window.requestAnimationFrame(() => window.requestAnimationFrame(() => restoreSelection(id, next))); window.setTimeout(() => restoreSelection(id, next), 40); };
  useLayoutEffect(() => { const pending = pendingSelectionRef.current; if (!pending) return; pendingSelectionRef.current = null; restoreSelection(pending.id, pending.next); }, [texts, editingId]);
  useEffect(() => {
    if (!editingId) return;
    if (!editingTransactionStartedRef.current) {
      editingTransactionStartedRef.current = true;
      onHistoryStart?.();
    }
    const finishEditing = () => {
      if (editingCommitRef.current) return;
      editingCommitRef.current = true;
      onHistoryCommit?.();
      setEditingId(null);
    };
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) finishEditing();
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
      if (!editingCommitRef.current) onHistoryCancel?.();
      editingCommitRef.current = false;
      editingTransactionStartedRef.current = false;
    };
  }, [editingId, onHistoryCancel, onHistoryStart]);
  const updateText = (id: string, root: HTMLElement) => { const nextSelection = selectionOffsets(root) || selection; const runs = runsFromElement(root); const text = textFromRuns(runs); onChange(texts.map((item) => item.id === id ? { ...item, text, html: root.innerHTML, runs, paragraphs: paragraphsForText(text, item.paragraphs) } : item)); restoreSelection(id, nextSelection); };

  function applyCommand(command: string, value?: string) {
    if (!editingId) {
      const item = texts.find((text) => selectedIds.includes(text.id));
      if (command === 'copy' && item) internalObjectClipboard = [JSON.parse(JSON.stringify(item)) as TextObject];
      if (command === 'cut' && item) { internalObjectClipboard = [JSON.parse(JSON.stringify(item)) as TextObject]; onChange(texts.filter((text) => text.id !== item.id)); onSelectionChange([]); }
      if (command === 'delete' && item) { onChange(texts.filter((text) => text.id !== item.id)); onSelectionChange([]); }
      if ((command === 'duplicate' || command === 'paste') && (item || internalObjectClipboard.length)) { const source = item ? [item] : internalObjectClipboard; const copies = source.map((original, index) => ({ ...JSON.parse(JSON.stringify(original)), id: `text-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${index}`, geometry: { ...original.geometry, x: Math.min(SW - original.geometry.width, original.geometry.x + 24), y: Math.min(SH - original.geometry.height, original.geometry.y + 24) } } as TextObject)); onChange([...texts, ...copies]); onSelectionChange(copies.map((copy) => copy.id)); }
      return;
    }
    const item = texts.find((text) => text.id === editingId); const root = contentRefs.current.get(editingId); if (!item || !root) return;
    const liveSelection = selectionRef.current; setSelection(liveSelection);
    const start = Math.min(liveSelection.start, liveSelection.end); const end = Math.max(liveSelection.start, liveSelection.end); let runs = item.runs?.length ? item.runs : [{ text: item.text }]; let paragraphs = paragraphsForText(item.text, item.paragraphs);
    if (command === 'copy' || command === 'cut') { if (start !== end) { const [, rest] = splitRunsAt(runs, start); const [middle] = splitRunsAt(rest, end - start); internalTextClipboard = { text: item.text.slice(start, end), runs: middle, paragraphs }; if (command === 'cut') { clipboardInsertionRef.current = start; const nextRuns = deleteRunRange(runs, start, end); const nextText = textFromRuns(nextRuns); internalTextPastePosition = { id: item.id, offset: start }; internalTextAfterCutText = nextText; const nextPosition = { start, end: start }; selectionRef.current = nextPosition; selectionAnchorRef.current = start; onChange(texts.map((candidate) => candidate.id === item.id ? { ...candidate, text: nextText, runs: nextRuns, html: runsToEditableHtml(nextRuns), paragraphs: paragraphsForText(nextText, paragraphs) } : candidate)); restoreSelectionAfterRender(item.id, nextPosition); } } return; }
    if (command === 'paste' && internalTextClipboard) { const transactionMatches = internalTextPastePosition?.id === item.id || item.text === internalTextAfterCutText || clipboardInsertionRef.current !== null; const pasteStart = transactionMatches && (internalTextPastePosition || clipboardInsertionRef.current !== null) ? Math.min(internalTextPastePosition?.offset ?? clipboardInsertionRef.current ?? start, item.text.length) : start; const nextRuns = normalizeRuns([{ text: item.text.slice(0, pasteStart) }, ...internalTextClipboard.runs, { text: item.text.slice(pasteStart) }]); const nextText = textFromRuns(nextRuns); const nextPosition = { start: pasteStart + internalTextClipboard.text.length, end: pasteStart + internalTextClipboard.text.length }; clipboardInsertionRef.current = null; internalTextPastePosition = null; internalTextAfterCutText = null; onChange(texts.map((candidate) => candidate.id === item.id ? { ...candidate, text: nextText, runs: nextRuns, html: runsToEditableHtml(nextRuns), paragraphs: paragraphsForText(nextText, paragraphs) } : candidate)); restoreSelectionAfterRender(item.id, nextPosition); return; }
    if (start === end && ['bold', 'italic', 'underline', 'fontName', 'fontSize', 'increaseFontSize', 'decreaseFontSize', 'foreColor', 'textColor'].includes(command)) {
      const run = runs.find((candidate, index) => { const before = runs.slice(0, index).reduce((sum, value) => sum + value.text.length, 0); return start >= before && start <= before + candidate.text.length; }) || runs[0];
      const next = { ...activeFormatting, fontFamily: run?.fontFamily, fontSize: run?.fontSize || item.style.fontSize, bold: run?.bold, italic: run?.italic, underline: run?.underline, color: run?.color || item.style.color };
      if (command === 'bold' || command === 'italic' || command === 'underline') next[command] = !next[command];
      if (command === 'fontName') next.fontFamily = value;
      if (command === 'fontSize') next.fontSize = Number(value) || next.fontSize;
      if (command === 'increaseFontSize' || command === 'decreaseFontSize') next.fontSize = Math.max(8, (next.fontSize || 28) + (command === 'increaseFontSize' ? 2 : -2));
      if (command === 'foreColor' || command === 'textColor') next.color = value;
      setActiveFormatting(next); return;
    }
    const toggle = (key: 'bold' | 'italic' | 'underline') => { const active = runs.filter((run) => run.text).every((run) => Boolean(run[key])); runs = formatRunRange(runs, start, end, (run) => ({ [key]: !active })); };
    if (command === 'bold' || command === 'italic' || command === 'underline') toggle(command);
    else if (command === 'fontName') runs = formatRunRange(runs, start, end, { fontFamily: value });
    else if (command === 'fontSize') runs = formatRunRange(runs, start, end, { fontSize: Number(value) || item.style.fontSize || 28 });
    else if (command === 'increaseFontSize' || command === 'decreaseFontSize') runs = formatRunRange(runs, start, end, (run) => ({ fontSize: Math.max(8, (run.fontSize || item.style.fontSize || 28) + (command === 'increaseFontSize' ? 2 : -2)) }));
    else if (command === 'foreColor' || command === 'textColor') runs = formatRunRange(runs, start, end, { color: value });
    else if (command === 'createLink' && value) runs = formatRunRange(runs, start, end, { link: value });
    else if (command === 'unlink') runs = formatRunRange(runs, start, end, { link: undefined });
    else if (command === 'justifyLeft' || command === 'justifyCenter' || command === 'justifyRight') { const alignment = command === 'justifyLeft' ? 'left' : command === 'justifyCenter' ? 'center' : 'right'; const range = lineRange(item.text, start, end); paragraphs = paragraphs.map((paragraph, index) => index >= range.from && index <= range.to ? { ...paragraph, alignment } : paragraph); }
    else if (command === 'insertUnorderedList' || command === 'insertOrderedList') { const range = lineRange(item.text, start, end); const bullet = command === 'insertUnorderedList' ? 'bullet' : 'number'; const selectedParagraphs = paragraphs.slice(range.from, range.to + 1); const nextBullet = selectedParagraphs.some((paragraph) => paragraph.bullet === bullet) ? null : bullet; paragraphs = paragraphs.map((paragraph, index) => index >= range.from && index <= range.to ? { ...paragraph, bullet: nextBullet } : paragraph); }
    else if (command === 'indent' || command === 'outdent') { const range = lineRange(item.text, start, end); paragraphs = paragraphs.map((paragraph, index) => index >= range.from && index <= range.to ? { ...paragraph, indent: Math.max(0, (paragraph.indent || 0) + (command === 'indent' ? 1 : -1)) } : paragraph); }
    else return;
    const text = textFromRuns(runs); const nextRuns = normalizeRuns(runs); onChange(texts.map((candidate) => candidate.id === item.id ? { ...candidate, text, runs: nextRuns, paragraphs, html: runsToEditableHtml(nextRuns) } : candidate)); restoreSelection(item.id, selection);
  }

  useEffect(() => { const listener = (event: Event) => { const detail = (event as CustomEvent<{ command: string; value?: string }>).detail; if (detail) applyCommand(detail.command, detail.value); }; window.addEventListener('text-format-command', listener); return () => window.removeEventListener('text-format-command', listener); });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (editingId) {
        return;
      }
      if (key === 'c' || key === 'x' || key === 'v' || key === 'd') { event.preventDefault(); applyCommand(key === 'd' ? 'duplicate' : key === 'c' ? 'copy' : key === 'x' ? 'cut' : 'paste'); }
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [editingId, selection, texts, selectedIds]);
  function finish(canceled = false) { const current = gesture.current; if (!current) return; if (current.type === 'insert' && draftSelection && !canceled) { const item = createText(`text-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, draftSelection, Math.max(0, ...texts.map((text) => text.geometry.zIndex), 0) + 1); onChange([...texts, item]); onSelectionChange([item.id]); setEditingId(item.id); onInsertComplete?.(); } else if (current.type !== 'insert') { if (canceled) onHistoryCancel?.(); else onHistoryCommit?.(); } gesture.current = null; setDraftSelection(null); }
  function move(event: PointerEvent) { const current = gesture.current; if (!current) return; const nextPoint = point(event); if (current.type === 'insert') { setDraftSelection({ x: Math.min(current.startX, nextPoint.x), y: Math.min(current.startY, nextPoint.y), width: Math.max(24, Math.abs(nextPoint.x - current.startX)), height: Math.max(24, Math.abs(nextPoint.y - current.startY)) }); return; } const original = current.original; if (!original) return; const dx = nextPoint.x - current.startX; const dy = nextPoint.y - current.startY; const next = texts.map((item) => { if (item.id !== original.id) return item; if (current.type === 'move') return { ...item, geometry: { ...item.geometry, x: Math.max(0, Math.min(SW - item.geometry.width, original.geometry.x + dx)), y: Math.max(0, Math.min(SH - item.geometry.height, original.geometry.y + dy)) } }; if (current.type === 'resize') return { ...item, geometry: { ...item.geometry, width: Math.max(24, Math.min(SW - original.geometry.x, original.geometry.width + dx)), height: Math.max(24, Math.min(SH - original.geometry.y, original.geometry.height + dy)) } }; const cx = original.geometry.x + original.geometry.width / 2; const cy = original.geometry.y + original.geometry.height / 2; return { ...item, geometry: { ...item.geometry, rotation: Math.atan2(nextPoint.y - cy, nextPoint.x - cx) * 180 / Math.PI + 90 } }; }); onChange(next); }
  function begin(event: React.PointerEvent, type: 'insert' | 'move' | 'resize' | 'rotate', id?: string) { event.preventDefault(); event.stopPropagation(); const start = point(event); if (type === 'insert') { gesture.current = { type, startX: start.x, startY: start.y }; (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId); return; } const item = texts.find((text) => text.id === id); if (!item) return; onHistoryStart?.(); onSelectionChange([item.id], event.shiftKey); gesture.current = { type, startX: start.x, startY: start.y, original: JSON.parse(JSON.stringify(item)) as TextObject }; (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId); }
  function keyDown(event: React.KeyboardEvent<HTMLDivElement>, item: TextObject) {
    const root = event.currentTarget; const liveSelection = selectionOffsets(root); if (liveSelection) selectionRef.current = liveSelection; const current = selectionRef.current; const start = Math.min(current.start, current.end); const end = Math.max(current.start, current.end); const caret = current.end;
    const caretForDirection = (direction: -1 | 1) => event.shiftKey && start !== end ? (direction < 0 ? start : end) : caret;
    const moveCaret = (next: number, extend = false) => { const anchor = selectionAnchorRef.current ?? current.start; const range = extend ? { start: anchor, end: next } : { start: next, end: next }; if (!extend) selectionAnchorRef.current = next; event.preventDefault(); restoreSelection(item.id, range); };
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); restoreSelection(item.id, { start: 0, end: item.text.length }); return; }
    if ((event.ctrlKey || event.metaKey) && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { const navigationCaret = caretForDirection(event.key === 'ArrowLeft' ? -1 : 1); moveCaret(wordBoundary(item.text, navigationCaret, event.key === 'ArrowLeft' ? -1 : 1), event.shiftKey); return; }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { verticalColumnRef.current = null; const navigationCaret = caretForDirection(event.key === 'ArrowLeft' ? -1 : 1); moveCaret(event.key === 'ArrowLeft' ? Math.max(0, navigationCaret - 1) : Math.min(item.text.length, navigationCaret + 1), event.shiftKey); return; }
    if (event.key === 'Home' || event.key === 'End') { verticalColumnRef.current = null; const navigationCaret = event.shiftKey && start !== end ? (event.key === 'Home' ? start : end) : caret; const paragraphStart = item.text.lastIndexOf('\n', Math.max(0, navigationCaret - 1)) + 1; const paragraphEnd = item.text.indexOf('\n', navigationCaret); const next = event.key === 'Home' ? paragraphStart : (paragraphEnd < 0 ? item.text.length : paragraphEnd); moveCaret(next, event.shiftKey); return; }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { const navigationCaret = caretForDirection(event.key === 'ArrowUp' ? -1 : 1); const lines = item.text.split('\n'); const line = paragraphIndexAt(item.text, navigationCaret); const lineStart = item.text.lastIndexOf('\n', Math.max(0, navigationCaret - 1)) + 1; const column = navigationCaret - lineStart; const desiredColumn = verticalColumnRef.current ?? column; verticalColumnRef.current = desiredColumn; const target = Math.max(0, Math.min(lines.length - 1, line + (event.key === 'ArrowUp' ? -1 : 1))); const offset = lines.slice(0, target).join('\n').length + (target ? 1 : 0) + Math.min(desiredColumn, lines[target].length); moveCaret(offset, event.shiftKey); return; }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); const paragraphIndex = paragraphIndexAt(item.text, caret); const paragraph = item.paragraphs[paragraphIndex] || { alignment: 'left', bullet: null, indent: 0, lineSpacing: 1.15, paragraphSpacing: 0 };
      if (paragraph.bullet && start === end && caret === item.text.length && item.text.endsWith('\n')) {
        const nextParagraphs = paragraphsForText(item.text, item.paragraphs).map((candidate, index) => index === paragraphIndex ? { ...candidate, bullet: null } : candidate);
        onChange(texts.map((candidate) => candidate.id === item.id ? { ...candidate, paragraphs: nextParagraphs } : candidate));
        verticalColumnRef.current = null;
        restoreSelection(item.id, { start: caret, end: caret });
        return;
      }
      const before = item.text.slice(0, start); const after = item.text.slice(end); const nextText = `${before}\n${after}`; const baseRuns = deleteRunRange(item.runs, start, end); const [left, right] = splitRunsAt(baseRuns, start); const nextRuns = normalizeRuns([...left, { text: '\n', ...activeFormatting }, ...right]);
      let nextParagraphs = paragraphsForText(nextText, item.paragraphs); nextParagraphs = nextParagraphs.map((candidate, index) => index === paragraphIndex + 1 ? { ...candidate, ...paragraph } : candidate);
      if (paragraph.bullet) nextParagraphs = nextParagraphs.map((candidate, index) => index === paragraphIndex + 1 ? { ...candidate, bullet: paragraph.bullet } : candidate);
      const nextItem = { ...item, text: nextText, runs: nextRuns, paragraphs: nextParagraphs, html: runsToEditableHtml(nextRuns) }; selectionRef.current = { start: caret + 1, end: caret + 1 }; onChange(texts.map((candidate) => candidate.id === item.id ? nextItem : candidate)); requestAnimationFrame(() => restoreSelection(item.id, selectionRef.current)); return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      if (start === end && event.key === 'Backspace' && caret > 0 && item.text[caret - 1] === '\n') { const paragraphIndex = paragraphIndexAt(item.text, caret); const nextParagraphs = item.paragraphs.filter((_, index) => index !== paragraphIndex); const nextRuns = deleteRunRange(item.runs, caret - 1, caret); const nextText = textFromRuns(nextRuns); onChange(texts.map((candidate) => candidate.id === item.id ? { ...candidate, text: nextText, runs: nextRuns, paragraphs: paragraphsForText(nextText, nextParagraphs), html: runsToEditableHtml(nextRuns) } : candidate)); restoreSelection(item.id, { start: caret - 1, end: caret - 1 }); return; }
      const from = start === end ? (event.key === 'Backspace' ? Math.max(0, caret - 1) : caret) : start; const to = start === end ? (event.key === 'Backspace' ? caret : Math.min(item.text.length, caret + 1)) : end; if (from === to) return; const nextRuns = deleteRunRange(item.runs, from, to); const nextText = textFromRuns(nextRuns); const nextParagraphs = paragraphsForText(nextText, item.paragraphs); onChange(texts.map((candidate) => candidate.id === item.id ? { ...candidate, text: nextText, runs: nextRuns, paragraphs: nextParagraphs, html: runsToEditableHtml(nextRuns) } : candidate)); restoreSelection(item.id, { start: from, end: from }); return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const runAtCaret = item.runs.reduce<{ run: TextRun; offset: number } | null>((found, run) => {
        if (found) return found;
        const consumed = item.runs.slice(0, item.runs.indexOf(run)).reduce((sum, candidate) => sum + candidate.text.length, 0);
        return caret >= consumed && caret <= consumed + run.text.length ? { run, offset: consumed } : null;
      }, null)?.run;
      const formatting: TextRun = { text: event.key, fontFamily: activeFormatting.fontFamily || runAtCaret?.fontFamily, fontSize: activeFormatting.fontSize || runAtCaret?.fontSize, bold: activeFormatting.bold ?? runAtCaret?.bold, italic: activeFormatting.italic ?? runAtCaret?.italic, underline: activeFormatting.underline ?? runAtCaret?.underline, color: activeFormatting.color || runAtCaret?.color };
      const effectiveStart = start === 0 && end === 0 && item.text.endsWith('\n') ? item.text.length : start;
      const insertionEnd = effectiveStart === start ? end : effectiveStart; const baseRuns = deleteRunRange(item.runs, effectiveStart, insertionEnd); const [left, right] = splitRunsAt(baseRuns, effectiveStart); const nextRuns = normalizeRuns([...left, formatting, ...right]); const nextText = textFromRuns(nextRuns); const nextItem = { ...item, text: nextText, runs: nextRuns, paragraphs: paragraphsForText(nextText, item.paragraphs), html: runsToEditableHtml(nextRuns) };
      const nextPosition = { start: effectiveStart + event.key.length, end: effectiveStart + event.key.length }; selectionRef.current = nextPosition; onChange(texts.map((candidate) => candidate.id === item.id ? nextItem : candidate)); requestAnimationFrame(() => restoreSelection(item.id, nextPosition));
    }
  }

  const menuButton = (label: string, command: string) => <button type="button" onMouseDown={(event) => { event.preventDefault(); applyCommand(command); setContextMenu(null); }}>{label}</button>;
  return <div ref={rootRef} className={`text-editor-overlay ${insertMode ? 'inserting' : ''}`} onPointerDown={(event) => { setContextMenu(null); if (insertMode && event.target === event.currentTarget) begin(event, 'insert'); }} onPointerMove={(event) => move(event.nativeEvent)} onPointerUp={() => finish(false)} onPointerCancel={() => finish(true)}>
    {texts.map((item) => { const selected = selectedIds.includes(item.id); const editing = editingId === item.id; const style: React.CSSProperties = { left: `${item.geometry.x / SW * 100}%`, top: `${item.geometry.y / SH * 100}%`, width: `${item.geometry.width / SW * 100}%`, height: `${item.geometry.height / SH * 100}%`, transform: `rotate(${item.geometry.rotation}deg)`, zIndex: item.geometry.zIndex, fontFamily: item.style.fontFamily, fontSize: `${effectiveTextFontSize(item)}px`, color: item.style.color, textAlign: item.style.textAlign || 'left', fontWeight: item.style.fontWeight, opacity: item.style.opacity ?? 1, padding: `${item.margins?.top ?? 10}px ${item.margins?.right ?? 12}px ${item.margins?.bottom ?? 10}px ${item.margins?.left ?? 12}px`, display: 'flex', alignItems: item.verticalAlign === 'middle' ? 'center' : item.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start' };
      return <div key={item.id} className={`text-object ${selected ? 'selected' : ''} ${editing ? 'editing' : ''}`} style={style} onContextMenu={(event) => { event.preventDefault(); onSelectionChange([item.id]); setEditingId(editing ? item.id : null); setContextMenu({ x: event.clientX, y: event.clientY, id: item.id, editing }); }} onPointerDown={(event) => { if (!editing) begin(event, 'move', item.id); }} onDoubleClick={(event) => { event.stopPropagation(); onSelectionChange([item.id], event.shiftKey); selectionAnchorRef.current = null; editingCommitRef.current = false; editingTransactionStartedRef.current = true; onHistoryStart?.(); setEditingId(item.id); }}><div ref={(node) => { if (node) contentRefs.current.set(item.id, node); else contentRefs.current.delete(item.id); }} className="text-object-content" contentEditable={editing} suppressContentEditableWarning onBlur={() => { if (editingId === item.id) { editingCommitRef.current = true; onHistoryCommit?.(); setEditingId(null); } }} onSelect={() => syncSelection(item.id)} onPointerUp={() => syncSelection(item.id)} onCopy={(event) => { event.preventDefault(); applyCommand('copy'); }} onCut={(event) => { event.preventDefault(); applyCommand('cut'); }} onPaste={(event) => { event.preventDefault(); applyCommand('paste'); }} onKeyDown={(event) => keyDown(event, item)} onClick={(event) => { if (editingId === item.id && (event.target as HTMLElement).closest('a')) event.preventDefault(); }} onInput={(event) => updateText(item.id, event.currentTarget)} dangerouslySetInnerHTML={{ __html: runsToEditableHtml(item.runs || [{ text: item.text }]) }} />{selected && !editing && <><span className="text-object-handle text-object-resize" aria-label="Resize text box" onPointerDown={(event) => begin(event, 'resize', item.id)} /><span className="text-object-handle text-object-rotate" aria-label="Rotate text box" onPointerDown={(event) => begin(event, 'rotate', item.id)} /></>}</div>;
    })}
    {draftSelection && <span className="text-insertion-preview" style={{ left: `${draftSelection.x / SW * 100}%`, top: `${draftSelection.y / SH * 100}%`, width: `${draftSelection.width / SW * 100}%`, height: `${draftSelection.height / SH * 100}%` }} />}
    {contextMenu && <div className="text-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>{contextMenu.editing ? <>{menuButton('Cut', 'cut')}{menuButton('Copy', 'copy')}{menuButton('Paste', 'paste')}{menuButton('Bold', 'bold')}{menuButton('Italic', 'italic')}{menuButton('Underline', 'underline')}{menuButton('Bullets', 'insertUnorderedList')}{menuButton('Align Left', 'justifyLeft')}{menuButton('Align Center', 'justifyCenter')}{menuButton('Align Right', 'justifyRight')}</> : <>{menuButton('Copy', 'copy')}{menuButton('Cut', 'cut')}{menuButton('Duplicate', 'duplicate')}{menuButton('Delete', 'delete')}</>}</div>}
  </div>;
}
