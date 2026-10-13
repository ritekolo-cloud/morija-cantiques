import type { TextParagraph, TextRun } from './presentationModel';
import type { TextObject } from './presentationModel';

export function sameRunStyle(a: TextRun, b: TextRun) {
  return a.fontFamily === b.fontFamily && a.fontSize === b.fontSize && a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.color === b.color;
}
export function normalizeRuns(runs: TextRun[]): TextRun[] {
  const result: TextRun[] = [];
  runs.forEach((run) => {
    if (!run.text) return;
    const previous = result.at(-1);
    if (previous && sameRunStyle(previous, run)) previous.text += run.text;
    else result.push({ ...run });
  });
  return result.length ? result : [{ text: '' }];
}

export function textFromRuns(runs: TextRun[]) {
  return runs.map((run) => run.text).join('');
}

export function splitRunsAt(runs: TextRun[], offset: number): [TextRun[], TextRun[]] {
  const before: TextRun[] = []; const after: TextRun[] = []; let cursor = 0;
  runs.forEach((run) => {
    const end = cursor + run.text.length;
    if (end <= offset) before.push({ ...run });
    else if (cursor >= offset) after.push({ ...run });
    else {
      before.push({ ...run, text: run.text.slice(0, offset - cursor) });
      after.push({ ...run, text: run.text.slice(offset - cursor) });
    }
    cursor = end;
  });
  return [normalizeRuns(before), normalizeRuns(after)];
}

export function formatRunRange(runs: TextRun[], start: number, end: number, patch: Partial<TextRun> | ((run: TextRun) => Partial<TextRun>)): TextRun[] {
  if (start === end) return runs;
  const [before, rest] = splitRunsAt(runs, Math.min(start, end));
  const [middle, after] = splitRunsAt(rest, Math.max(start, end) - Math.min(start, end));
  return normalizeRuns([...before, ...middle.map((run) => ({ ...run, ...(typeof patch === 'function' ? patch(run) : patch) })), ...after]);
}

export function deleteRunRange(runs: TextRun[], start: number, end: number): TextRun[] {
  const [before, rest] = splitRunsAt(runs, Math.min(start, end));
  const [, after] = splitRunsAt(rest, Math.max(start, end) - Math.min(start, end));
  return normalizeRuns([...before, ...after]);
}

export function paragraphsForText(text: string, previous: TextParagraph[] = []): TextParagraph[] {
  return text.split('\n').map((_, index) => previous[index] || { alignment: 'left', bullet: null, indent: 0, lineSpacing: 1.15, paragraphSpacing: 0 });
}

export function lineRange(text: string, start: number, end: number) {
  const from = text.slice(0, Math.min(start, end)).split('\n').length - 1;
  const to = text.slice(0, Math.max(start, end)).split('\n').length - 1;
  return { from, to };
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function runsToEditableHtml(runs: TextRun[]) {
  return normalizeRuns(runs).map((run) => {
    const styles = [run.fontFamily ? `font-family:${run.fontFamily}` : '', run.fontSize ? `font-size:${run.fontSize}px` : '', run.color ? `color:${run.color}` : ''].filter(Boolean).join(';');
    let value = escapeHtml(run.text).replace(/\n/g, '<br>');
    if (styles) value = `<span style="${styles}">${value}</span>`;
    if (run.bold) value = `<strong>${value}</strong>`;
    if (run.italic) value = `<em>${value}</em>`;
    if (run.underline) value = `<u>${value}</u>`;
    if (run.link) value = '<a href="' + escapeHtml(run.link) + '" target="_blank" rel="noopener noreferrer">' + value + '</a>';
    return value;
  }).join('');
}

export function runsToSlideHtml(runs: TextRun[], paragraphs: TextParagraph[] = []) {
  const lines: TextRun[][] = [[]];
  runs.forEach((run) => {
    const parts = run.text.split('\n');
    parts.forEach((part, index) => {
      if (part) lines.at(-1)?.push({ ...run, text: part });
      if (index < parts.length - 1) lines.push([]);
    });
  });
  return lines.map((line, index) => {
    const content = runsToEditableHtml(line);
    const bullet = paragraphs[index]?.bullet ? '<span class="text-bullet">• </span>' : '';
    return `${bullet}${content}`;
  }).join('<br>');
}

export function effectiveTextFontSize(object: Pick<TextObject, 'text' | 'style' | 'geometry' | 'autofit'>) {
  const base = object.style.fontSize || 28;
  if (object.autofit !== 'shrink-text' || !object.text) return base;
  const charsPerLine = Math.max(8, Math.floor(object.geometry.width / Math.max(base * 0.55, 1)));
  const lines = object.text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  const availableLines = Math.max(1, Math.floor(object.geometry.height / Math.max(base * 1.2, 1)));
  return Math.max(8, Math.min(base, base * Math.sqrt(availableLines / Math.max(lines, 1))));
}
