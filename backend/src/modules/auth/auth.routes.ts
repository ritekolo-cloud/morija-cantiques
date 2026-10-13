import { Router, type Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../config/jwt';
import { comparePassword, hashPassword } from '../../utils/hash';
import { AppError } from '../../middleware/error.middleware';
import { authLimiter } from '../../middleware/rateLimit.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
const router = Router();
const credentials = z.object({ email: z.string().trim().email().max(320), password: z.string().min(8).max(128), displayName: z.string().trim().min(1).max(120).optional() });
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const safeUser = (u: { id: number; email: string; displayName: string; role: string }) => ({ id: u.id, email: u.email, displayName: u.displayName, role: u.role });
function cookie(res: Response, value: string) { res.cookie('morija_refresh', value, { httpOnly: true, secure: env.isProd, sameSite: 'lax', maxAge: 604800000, path: '/api/auth' }); }
async function tokens(u: { id: number; email: string; displayName: string; role: string }, res: Response) { const accessToken = signAccessToken({ userId: String(u.id), email: u.email, role: u.role }); const refreshToken = signRefreshToken({ userId: String(u.id) }); await prisma.refreshToken.create({ data: { tokenHash: digest(refreshToken), userId: u.id, expiresAt: new Date(Date.now() + 604800000) } }); cookie(res, refreshToken); return { accessToken, user: safeUser(u) }; }
router.post('/register', authLimiter, async (req, res, next) => { try { const parsed = credentials.safeParse(req.body); if (!parsed.success || !parsed.data.displayName) throw new AppError('Valid email, password, and display name are required', 422); const email = parsed.data.email.toLowerCase(); if (await prisma.user.findUnique({ where: { email } })) throw new AppError('Unable to create account with those details', 409); const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(parsed.data.password), displayName: parsed.data.displayName } }); res.status(201).json({ success: true, data: await tokens(user, res) }); } catch (e) { next(e); } });
router.post('/login', authLimiter, async (req, res, next) => { try { const parsed = credentials.pick({ email: true, password: true }).safeParse(req.body); if (!parsed.success) throw new AppError('Invalid email or password', 401); const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } }); if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) throw new AppError('Invalid email or password', 401); res.json({ success: true, data: await tokens(user, res) }); } catch (e) { next(e); } });
router.post('/refresh', authLimiter, async (req, res, next) => { try { const value = req.cookies?.morija_refresh; if (!value) throw new AppError('Refresh token required', 401); const payload = verifyRefreshToken(value); const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: digest(value) }, include: { user: true } }); if (!stored || stored.userId !== Number(payload.userId) || stored.revokedAt || stored.expiresAt <= new Date()) throw new AppError('Invalid refresh token', 401); await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }); res.json({ success: true, data: await tokens(stored.user, res) }); } catch (e) { next(e); } });
router.post('/logout', requireAuth, async (req, res, next) => { try { const value = req.cookies?.morija_refresh; if (value) await prisma.refreshToken.updateMany({ where: { tokenHash: digest(value), userId: Number(req.user!.userId), revokedAt: null }, data: { revokedAt: new Date() } }); res.clearCookie('morija_refresh', { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/api/auth' }); res.json({ success: true, message: 'Logged out' }); } catch (e) { next(e); } });
router.get('/me', requireAuth, async (req, res, next) => { try { const user = await prisma.user.findUnique({ where: { id: Number(req.user!.userId) } }); if (!user) throw new AppError('User not found', 404); res.json({ success: true, data: safeUser(user) }); } catch (e) { next(e); } });
export default router;
