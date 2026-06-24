import jwt from 'jsonwebtoken';
import { env } from './env';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshPayload {
  userId: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.secret) as JwtPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as RefreshPayload;
}
