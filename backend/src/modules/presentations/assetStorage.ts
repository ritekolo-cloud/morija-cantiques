export type StoredAsset = { body: Buffer; contentType: string; name: string };
export interface PresentationAssetStorage {
  put(key: string, body: Buffer, contentType: string, name: string): Promise<void>;
  get(key: string): Promise<StoredAsset | null>;
  delete(key: string): Promise<void>;
}
export class AssetStorageUnavailableError extends Error { constructor() { super('Durable media storage is not configured.'); this.name = 'AssetStorageUnavailableError'; } }
class UnconfiguredAssetStorage implements PresentationAssetStorage {
  async put(): Promise<void> { throw new AssetStorageUnavailableError(); }
  async get(): Promise<StoredAsset | null> { throw new AssetStorageUnavailableError(); }
  async delete(): Promise<void> { throw new AssetStorageUnavailableError(); }
}
export const presentationAssetStorage: PresentationAssetStorage = new UnconfiguredAssetStorage();