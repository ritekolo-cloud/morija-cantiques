// All TypeScript types for Morija Cantiques

// ─── Auth Types ───────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
  confirmPassword: string;
}

// ─── Song / Hymn Types ────────────────────────────────────────
export type SectionType = 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'refrain';

export interface SongSection {
  id?: number;
  type: SectionType;
  label: string;
  content: string;
  lines: string[];
  order: number;
}

export interface Song {
  id: string;
  songNumber: number;
  title: string;
  subtitle?: string;
  language?: string;
  category?: string;
  keySignature?: string;
  collectionId: string;
  collection?: Collection;
  sections?: SongSection[];
  lyrics: string;
  author?: string;
  composer?: string;
  year?: number;
  tags?: string[];
  isFavorited?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Language = 'English' | 'French' | 'Kiswahili';

// ─── Collection Types ─────────────────────────────────────────
export interface Collection {
  id: string;
  slug: string;
  name: string;
  subtitle?: string;
  language: string;
  description?: string;
  songCount?: number;
  coverImage?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export const COLLECTIONS_DATA: CollectionMeta[] = [
  { slug: 'only-believe', name: 'Only Believe', language: 'English', number: 1 },
  { slug: 'crois-seulement', name: 'Crois Seulement', language: 'French', number: 2 },
  { slug: 'hosanna', name: 'Hosanna', language: 'English', number: 3 },
  { slug: 'autres-cantiques', name: 'Autres Cantiques', language: 'French', number: 4 },
  { slug: 'collection-de-cantiques', name: 'Collection de Cantiques', language: 'French', number: 5 },
  { slug: 'chant-de-victoire', name: 'Chant de Victoire', language: 'French', number: 6 },
  { slug: 'nyimbo-za-mungu', name: 'Nyimbo za Mungu', language: 'Kiswahili', number: 7 },
  { slug: 'nyimbo-za-wokovu', name: 'Nyimbo za Wokovu', language: 'Kiswahili', number: 8 },
  { slug: 'roc-seculaire', name: 'Roc Séculaire', language: 'French', number: 9 },
  { slug: 'quel-temps-glorieux', name: 'Quel Temps Glorieux', language: 'French', number: 10 },
  { slug: 'sacred-songs-and-solos', name: 'Sacred Songs and Solos', language: 'English', number: 11 },
  { slug: 'only-believe-2', name: 'Only Believe-2', language: 'English', number: 12 },
  { slug: 'roc-seculaire-paris-2', name: 'Roc Séculaire (Paris-2)', language: 'French', number: 13 },
];

export interface CollectionMeta {
  slug: string;
  name: string;
  language: Language;
  number: number;
}

// ─── Category Types ───────────────────────────────────────────
export interface Category {
  id: number;
  name: string;
  collectionId: number;
}

// ─── Favorite Types ───────────────────────────────────────────
export interface Favorite {
  id: number;
  userId: number;
  songId: number;
  song?: Song;
  createdAt: string;
}

// ─── Playlist Types ───────────────────────────────────────────
export interface Playlist {
  id: number;
  name: string;
  description?: string;
  userId: number;
  songs: Song[];
  songCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistCreateData {
  name: string;
  description?: string;
  isPublic?: boolean;
}

// ─── Search Types ─────────────────────────────────────────────
export type SearchScope = 'all' | 'title' | 'number' | 'lyrics';

export interface SearchResult {
  song: Song;
  matchType: 'title' | 'number' | 'lyrics';
  matchPreview?: string;
  score: number;
}

export interface SearchParams {
  q: string;
  scope?: SearchScope;
  collectionId?: number;
  language?: Language;
  page?: number;
  limit?: number;
}

// ─── API Response Types ───────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T = unknown> extends PaginationMeta {
  data: T[];
}

export interface PaginatedApiResponse<T = unknown> {
  success: boolean;
  data: PaginatedResponse<T>;
  message?: string;
}

// ─── Filter / Query Params ────────────────────────────────────
export interface SongQueryParams {
  page?: number;
  limit?: number;
  collectionId?: number;
  language?: Language;
  search?: string;
  sortBy?: 'number' | 'title' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// ─── Recent History ───────────────────────────────────────────
export interface RecentItem {
  songId: number;
  collectionId: number;
  title: string;
  number: string;
  collectionName: string;
  viewedAt: string;
}

// ─── Settings ─────────────────────────────────────────────────
export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type AppLanguage = 'en' | 'fr' | 'sw';

export interface AppSettings {
  theme: Theme;
  fontSize: FontSize;
  language: AppLanguage;
  offlineMode: boolean;
  projectorMode: boolean;
  autoScrollSpeed: number;
}

// ─── Admin Types ──────────────────────────────────────────────
export interface AdminStats {
  totalSongs: number;
  totalUsers: number;
  totalCollections: number;
  totalFavorites: number;
  newUsersThisWeek: number;
  activeUsersToday: number;
}

export interface ImportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileName: string;
  totalSongs: number;
  importedSongs: number;
  errors: string[];
  createdAt: string;
}

// ─── Offline Cache ────────────────────────────────────────────
export interface CachedSong extends Song {
  cachedAt: string;
}
