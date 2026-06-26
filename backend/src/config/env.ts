import * as dotenv from 'dotenv';
import * as path from 'path';
import { z } from 'zod';

// Load env from the monorepo root and from backend/.env. These paths work
// both from src/ during development and dist/ after compilation.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default('Morija-Cantiques <noreply@morijacantiques.com>'),
  BCRYPT_ROUNDS: z.string().default('12'),
  ADMIN_NAME: z.string().default('Administrator'),
  ADMIN_EMAIL: z.string().default('admin@morijacantiques.com'),
  ADMIN_PASSWORD: z.string().default('Admin@123456'),
  UPLOAD_DIR: z.string().default('uploads'),
  LOG_LEVEL: z.string().default('debug'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parseInt(parsed.data.PORT, 10),
  databaseUrl: parsed.data.DATABASE_URL,
  jwt: {
    secret: parsed.data.JWT_SECRET,
    refreshSecret: parsed.data.JWT_REFRESH_SECRET,
    expiresIn: parsed.data.JWT_EXPIRES_IN,
    refreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
  },
  clientUrl: parsed.data.CLIENT_URL,
  smtp: {
    host: parsed.data.SMTP_HOST,
    port: parseInt(parsed.data.SMTP_PORT, 10),
    user: parsed.data.SMTP_USER,
    pass: parsed.data.SMTP_PASS,
    from: parsed.data.EMAIL_FROM,
  },
  bcryptRounds: parseInt(parsed.data.BCRYPT_ROUNDS, 10),
  admin: {
    name: parsed.data.ADMIN_NAME,
    email: parsed.data.ADMIN_EMAIL,
    password: parsed.data.ADMIN_PASSWORD,
  },
  uploadDir: parsed.data.UPLOAD_DIR,
  logLevel: parsed.data.LOG_LEVEL,
  rateLimit: {
    windowMs: parseInt(parsed.data.RATE_LIMIT_WINDOW_MS, 10),
    max: parseInt(parsed.data.RATE_LIMIT_MAX_REQUESTS, 10),
  },
  corsOrigin: parsed.data.CORS_ORIGIN,
  corsOrigins: parsed.data.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
};
