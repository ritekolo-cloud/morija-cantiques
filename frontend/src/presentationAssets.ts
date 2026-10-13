import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PresentationDocument } from './presentationModel';

export type PresentationAsset = { id: string; blob: Blob; name: string; mimeType: string; size: number; createdAt: number };

interface PresentationAssetDB extends DBSchema {
  assets: { key: string; value: PresentationAsset };
}
const DB_NAME = 'morija-presentation-assets';
const DB_VERSION = 1;
let dbPromise: Promise<IDBPDatabase<PresentationAssetDB>> | null = null;

function getDb() {
  if (!dbPromise) dbPromise = openDB<PresentationAssetDB>(DB_NAME, DB_VERSION, { upgrade(db) { if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets'); } });
  return dbPromise;
}

export async function savePresentationAsset(asset: PresentationAsset) {
  await (await getDb()).put('assets', asset);
}

export async function getPresentationAsset(id: string) {
  return (await getDb()).get('assets', id);
}

export async function deletePresentationAsset(id: string) {
  await (await getDb()).delete('assets', id);
}

export async function assetUrl(id: string) {
  const asset = await getPresentationAsset(id);
  return asset ? URL.createObjectURL(asset.blob) : null;
}

export function supportedMediaType(kind: 'audio' | 'video', mimeType: string) {
  return kind === 'audio'
    ? /^audio\/(mpeg|mp4|ogg|wav|webm|aac|x-m4a)$/i.test(mimeType)
    : /^video\/(mp4|webm|ogg|quicktime)$/i.test(mimeType);
}

export const MEDIA_MAX_BYTES = 100 * 1024 * 1024;

export async function hydratePresentationMedia(document: PresentationDocument): Promise<PresentationDocument> {
  const next = JSON.parse(JSON.stringify(document)) as PresentationDocument;
  await Promise.all(next.slides.flatMap((slide) => slide.objects).filter((object) => object.type === 'audio' || object.type === 'video').map(async (object) => {
    const asset = await getPresentationAsset(object.assetId);
    object.src = asset ? URL.createObjectURL(asset.blob) : undefined;
    object.error = asset ? undefined : 'Media asset is missing. Reinsert the original file.';
  }));
  return next;
}
