import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../config/jwt';
import { AppError } from './error.middleware';
export function requireAuth(request: Request, _response: Response, next: NextFunction): void {
  const header = request.get('authorization'); const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) { next(new AppError('Authentication required', 401)); return; }
  try { request.user = verifyAccessToken(token); next(); } catch { next(new AppError('Invalid or expired access token', 401)); }
}
export function requireRole(...roles: string[]) { return (request: Request, _response: Response, next: NextFunction): void => { if (!request.user || !roles.includes(request.user.role)) { next(new AppError('Forbidden', 403)); return; } next(); }; }
