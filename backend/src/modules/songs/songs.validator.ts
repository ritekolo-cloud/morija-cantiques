import { z } from 'zod';

export const createSongSchema = z.object({
  songNumber: z.number().int().positive(),
  title: z.string().min(1).max(300),
  lyrics: z.string().min(1, 'Lyrics are required'),
  collectionId: z.string().min(1, 'Collection ID is required'),
  category: z.string().optional(),
  keySignature: z.string().optional(),
  language: z.string().optional(),
});

export const updateSongSchema = createSongSchema.partial().omit({ collectionId: true, songNumber: true });

export const songQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  q: z.string().optional(),
  collectionId: z.string().optional(),
  language: z.string().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  page: z.string().optional(),
  limit: z.string().optional(),
  type: z.enum(['all', 'title', 'number', 'lyrics']).optional().default('all'),
  collectionSlug: z.string().optional(),
});

export type CreateSongInput = z.infer<typeof createSongSchema>;
export type UpdateSongInput = z.infer<typeof updateSongSchema>;
export type SongQuery = z.infer<typeof songQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
