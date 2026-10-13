import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clonePresentationDocument,
  createPresentationDocument,
  parsePresentationDocument,
  textSlideToPresentationSlide,
  type TextSlideSource,
  type PresentationDocument,
  type TextObject,
} from './presentationModel';
import { hydratePresentationMedia } from './presentationAssets';
const PRESENTATION_DOCUMENT_KEY = 'text-slides:document:v1';
const PRESENTATION_ACTIVE_SLIDE_KEY = 'text-slides:active-slide:v1';

const DEVELOPMENT_TEXT_MARKERS = ['POWERPOINT-STYLE EDITOR SHELL', 'BEGIN WITH PHASE 1', 'PHASE 2:', 'DO NOT PROCEED TO PHASE'];

function removeDevelopmentText(document: PresentationDocument): PresentationDocument {
  const containsDevelopmentText = (value: string) => DEVELOPMENT_TEXT_MARKERS.some((marker) => value.toUpperCase().includes(marker));
  return {
    ...document,
    slides: document.slides.map((slide) => {
      const hasDevelopmentText = slide.objects.some((object) => object.type === 'text' && containsDevelopmentText(`${object.text} ${object.html || ''}`));
      if (!hasDevelopmentText) return slide;
      return { ...slide, objects: slide.objects.map((object) => object.type === 'text' ? { ...(object as TextObject), text: '', html: '' } : object) };
    }),
  };
}

function readDocument(): PresentationDocument {
  try {
    const stored = localStorage.getItem(PRESENTATION_DOCUMENT_KEY);
    if (stored) return removeDevelopmentText(JSON.parse(stored) as PresentationDocument);
    const legacy = localStorage.getItem('text-slides:items:v1');
    if (legacy) {
      const items = JSON.parse(legacy) as Array<{ type: 'text'; entryId: string; slide: TextSlideSource }>;
      const document = createPresentationDocument('Text Slides');
      const slides = items.filter((item) => item.type === 'text').map((item) => {
        const source = item.slide;
        const sourceText = `${source.title} ${source.subtitle} ${source.bodyHtml}`.toUpperCase();
        const contaminated = DEVELOPMENT_TEXT_MARKERS.some((marker) => sourceText.includes(marker));
        return textSlideToPresentationSlide(contaminated ? { ...source, title: '', subtitle: '', bodyHtml: '', reference: '' } : source);
      });
      if (slides.length) document.slides = slides;
      return document;
    }
  } catch {
    // Fall through to a new valid document.
  }
  return createPresentationDocument();
}

function writeDocument(document: PresentationDocument) {
  localStorage.setItem(PRESENTATION_DOCUMENT_KEY, JSON.stringify(document));
  window.dispatchEvent(new CustomEvent('presentationdocumentchange'));
}

export function resolveSelectedSlideId(document: PresentationDocument, requestedId?: string | null) {
  return (requestedId && document.slides.some((slide) => slide.id === requestedId))
    ? requestedId
    : document.slides[0]?.id ?? null;
}

function readActiveSlideId(document: PresentationDocument) {
  try {
    return resolveSelectedSlideId(document, localStorage.getItem(PRESENTATION_ACTIVE_SLIDE_KEY));
  } catch {
    return resolveSelectedSlideId(document);
  }
}

function writeActiveSlideId(id: string | null) {
  try {
    if (id) localStorage.setItem(PRESENTATION_ACTIVE_SLIDE_KEY, id);
    else localStorage.removeItem(PRESENTATION_ACTIVE_SLIDE_KEY);
  } catch {
    // Active-slide restoration is an enhancement; document persistence remains available.
  }
}

export function usePresentationDocument() {
  const [document, setDocument] = useState<PresentationDocument>(() => readDocument());
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(() => readActiveSlideId(document));
  const [past, setPast] = useState<PresentationDocument[]>([]);
  const [future, setFuture] = useState<PresentationDocument[]>([]);
  const [saveState, setSaveState] = useState<'saved' | 'unsaved'>('saved');
  const historyTransaction = useRef<{ document: PresentationDocument; saveState: 'saved' | 'unsaved'; status: 'active' | 'committing' | 'canceled' } | null>(null);
  const documentRef = useRef(document);
  const saveStateRef = useRef(saveState);
  documentRef.current = document;
  saveStateRef.current = saveState;

  useEffect(() => {
    let cancelled = false;
    hydratePresentationMedia(readDocument()).then((next) => { if (!cancelled) setDocument(next); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const refresh = () => setDocument(readDocument());
    window.addEventListener('storage', refresh);
    window.addEventListener('presentationdocumentchange', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('presentationdocumentchange', refresh);
    };
  }, []);

  useEffect(() => {
    const resolved = resolveSelectedSlideId(document, selectedSlideId);
    if (resolved !== selectedSlideId) setSelectedSlideId(resolved);
    writeActiveSlideId(resolved);
  }, [document.slides]);

  const beginHistoryTransaction = useCallback(() => {
    if (!historyTransaction.current) historyTransaction.current = { document: clonePresentationDocument(documentRef.current), saveState: saveStateRef.current, status: 'active' };
  }, []);

  const updateDocument = useCallback((next: PresentationDocument | ((current: PresentationDocument) => PresentationDocument)) => {
    const transaction = historyTransaction.current;
    setDocument((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      if (resolved === current) return current;
      if (transaction) {
        if (transaction.status === 'canceled') return current;
        setSaveState('unsaved');
        return { ...resolved, metadata: { ...resolved.metadata, updatedAt: Date.now() } };
      }
      setPast((history) => [...history.slice(-49), clonePresentationDocument(current)]);
      setFuture([]);
      setSaveState('unsaved');
      return { ...resolved, metadata: { ...resolved.metadata, updatedAt: Date.now() } };
    });
  }, []);

  const commitHistoryTransaction = useCallback(() => {
    const transaction = historyTransaction.current;
    if (!transaction || transaction.status !== 'active') return;
    transaction.status = 'committing';
    setDocument((current) => {
      if (historyTransaction.current === transaction) historyTransaction.current = null;
      if (JSON.stringify(transaction.document) === JSON.stringify(current)) return current;
      setPast((history) => [...history.slice(-49), transaction.document]);
      setFuture([]);
      setSaveState('unsaved');
      return current;
    });
  }, []);

  const cancelHistoryTransaction = useCallback(() => {
    const transaction = historyTransaction.current;
    if (!transaction || transaction.status !== 'active') return;
    transaction.status = 'canceled';
    historyTransaction.current = null;
    setDocument(transaction.document);
    setSaveState(transaction.saveState);
  }, []);

  const undo = useCallback(() => {
    setPast((history) => {
      const previous = history.at(-1);
      if (!previous) return history;
      setDocument((current) => {
        setFuture((redo) => [clonePresentationDocument(current), ...redo.slice(0, 49)]);
        return previous;
      });
      setSaveState('unsaved');
      return history.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((history) => {
      const next = history[0];
      if (!next) return history;
      setDocument((current) => {
        setPast((pastHistory) => [...pastHistory.slice(-49), clonePresentationDocument(current)]);
        return next;
      });
      setSaveState('unsaved');
      return history.slice(1);
    });
  }, []);

  const save = useCallback(() => {
    writeDocument(documentRef.current);
    setSaveState('saved');
  }, []);

  const importDocument = useCallback(async (input: string | unknown) => {
    const parsed = parsePresentationDocument(input);
    const next = await hydratePresentationMedia(parsed).catch(() => parsed);
    const previous = clonePresentationDocument(documentRef.current);
    setPast((history) => [...history.slice(-49), previous]);
    setFuture([]);
    setDocument(next);
    setSelectedSlideId((current) => resolveSelectedSlideId(next, current));
    writeDocument(next);
    setSaveState('saved');
  }, []);

  useEffect(() => {
    if (saveState !== 'unsaved') return;
    const timer = window.setTimeout(() => { try { localStorage.setItem(PRESENTATION_DOCUMENT_KEY, JSON.stringify(document)); } catch { /* local recovery is best-effort */ } }, 500);
    return () => window.clearTimeout(timer);
  }, [document, saveState]);
  const selectedSlide = useMemo(() => document.slides.find((slide) => slide.id === selectedSlideId) ?? document.slides[0] ?? null, [document.slides, selectedSlideId]);

  const selectSlide = useCallback((id: string | null) => {
    setSelectedSlideId(id);
    writeActiveSlideId(id);
  }, []);

  return { document, selectedSlide, selectedSlideId, selectSlide, updateDocument, beginHistoryTransaction, commitHistoryTransaction, cancelHistoryTransaction, undo, redo, save, importDocument, canUndo: past.length > 0, canRedo: future.length > 0, saveState };
}
