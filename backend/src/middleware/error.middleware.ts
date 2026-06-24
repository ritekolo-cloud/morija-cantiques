import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { logger } from '../utils/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  logger.error({
    message: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
    url: req.url,
    method: req.method,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const key = e.path.join('.');
      if (!errors[key]) errors[key] = [];
      errors[key].push(e.message);
    });
    res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
    return;
  }

  // Prisma unique constraint
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[])?.join(', ') ?? 'field';
      res.status(409).json({
        success: false,
        message: `${fields} already exists`,
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Record not found' });
      return;
    }
    res.status(400).json({ success: false, message: 'Database error' });
    return;
  }

  // JWT errors
  if (err instanceof TokenExpiredError) {
    res.status(401).json({ success: false, message: 'Token expired' });
    return;
  }
  if (err instanceof JsonWebTokenError) {
    res.status(401).json({ success: false, message: 'Invalid token' });
    return;
  }

  // Custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Generic
  const statusCode = err instanceof Error && 'statusCode' in err
    ? (err as AppError).statusCode
    : 500;

  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : (err instanceof Error ? err.message : 'Unknown error'),
  });
}

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
  });
}
