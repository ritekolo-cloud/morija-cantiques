import { Request, Response, NextFunction } from 'express';
import * as service from './songs.service';
import { sendSuccess } from '../../utils/response';

export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const songs = await service.getAllSongs(req.query as Record<string, unknown>);
    sendSuccess(res, songs, 'Songs retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const song = await service.getSongById(req.params.id);
    sendSuccess(res, song);
  } catch (err) {
    next(err);
  }
}

export async function getByNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug, number } = req.params;
    const song = await service.getSongByNumber(slug, Number.parseInt(number, 10));
    sendSuccess(res, song);
  } catch (err) {
    next(err);
  }
}

export async function search(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const songs = await service.searchSongs(req.query as Record<string, unknown>);
    sendSuccess(res, songs, 'Search results');
  } catch (err) {
    next(err);
  }
}

export async function getByCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params;
    const { songs, meta } = await service.getSongsByCollection(slug, req.query as Record<string, unknown>);
    sendSuccess(res, songs, 'Collection songs', 200, meta);
  } catch (err) {
    next(err);
  }
}

export async function adjacent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.getAdjacentSongs(req.params.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
