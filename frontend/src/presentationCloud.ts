import { authRequest } from './authClient';
import { clonePresentationDocument, type PresentationDocument } from './presentationModel';

export type CloudPermission = 'OWNER' | 'VIEW' | 'EDIT';
export type CloudPresentationSummary = { id: string; title: string; revision: number; ownerId: number; permission: CloudPermission; createdAt: string; updatedAt: string };
export type CloudPresentation = CloudPresentationSummary & { document: PresentationDocument; canEdit: boolean };
export type CloudVersion = { id: string; revision: number; authorId: number; author?: { displayName: string; email: string }; createdAt: string };
export type CloudShare = { id: string; permission: 'VIEW' | 'EDIT'; recipient: { id: number; email: string; displayName: string }; createdAt: string };
export type CloudConflict = Error & { status?: number; code?: string; data?: { currentRevision?: number } };

export function isRevisionConflict(error: unknown): error is CloudConflict { return Boolean(error && typeof error === 'object' && (error as CloudConflict).status === 409 && (error as CloudConflict).code === 'REVISION_CONFLICT'); }
const path = (id: string) => '/presentations/' + encodeURIComponent(id);
const portableCloudDocument = (document: PresentationDocument) => { const next = clonePresentationDocument(document); next.slides.forEach((slide) => slide.objects.forEach((object) => { if (object.type === 'audio' || object.type === 'video') { object.assetSource = object.assetSource || 'indexeddb'; if (object.assetSource === 'indexeddb') object.src = undefined; } })); return next; };
export const listCloudPresentations = () => authRequest<CloudPresentationSummary[]>('/presentations');
export const createCloudPresentation = (title: string, document: PresentationDocument) => authRequest<CloudPresentation>('/presentations', { method: 'POST', body: JSON.stringify({ title, document: portableCloudDocument(document) }) });
export const loadCloudPresentation = (id: string) => authRequest<CloudPresentation>(path(id));
export const updateCloudPresentation = (id: string, baseRevision: number, document: PresentationDocument, title?: string) => authRequest<CloudPresentation>(path(id), { method: 'PATCH', body: JSON.stringify({ baseRevision, document: portableCloudDocument(document), ...(title ? { title } : {}) }) });
export const deleteCloudPresentation = (id: string) => authRequest<{ id: string }>(path(id), { method: 'DELETE' });
export const listCloudVersions = (id: string) => authRequest<CloudVersion[]>(path(id) + '/versions');
export const restoreCloudVersion = (id: string, revision: number, baseRevision: number) => authRequest<CloudPresentation>(path(id) + '/versions/' + revision + '/restore', { method: 'POST', body: JSON.stringify({ baseRevision }) });
export const listCloudShares = (id: string) => authRequest<CloudShare[]>(path(id) + '/shares');
export const updateCloudShare = (id: string, shareId: string, permission: 'VIEW' | 'EDIT') => authRequest<CloudShare>(path(id) + '/shares/' + encodeURIComponent(shareId), { method: 'PATCH', body: JSON.stringify({ permission }) });
export const revokeCloudShare = (id: string, shareId: string) => authRequest<{ id: string }>(path(id) + '/shares/' + encodeURIComponent(shareId), { method: 'DELETE' });
export const shareCloudPresentation = (id: string, email: string, permission: 'VIEW' | 'EDIT') => authRequest<CloudShare>(path(id) + '/shares', { method: 'POST', body: JSON.stringify({ email, permission }) });
