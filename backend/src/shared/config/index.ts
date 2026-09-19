import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  mongoUri: string;
  jwtSecret: string;
  nodeEnv: string;
  mockEduPort: number;
  mockEmpPort: number;
  isProduction: boolean;
  cloudinaryConfigured: boolean;
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

const config = {
  server: {
    port: Number(process.env.PORT) || 5003,
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },

  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/sih_demo',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-sih-jwt-secret-key-1234567890',
    expiresIn: '1h',
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_GENERAL_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_GENERAL_MAX) || 500,
    authWindowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000,
    authMax: Number(process.env.RATE_LIMIT_AUTH_MAX) || 10000,
    verifyWindowMs: Number(process.env.RATE_LIMIT_VERIFY_WINDOW_MS) || 15 * 60 * 1000,
    verifyMax: Number(process.env.RATE_LIMIT_VERIFY_MAX) || 60,
  },

  mock: {
    eduPort: Number(process.env.MOCK_EDU_PORT) || 4001,
    empPort: Number(process.env.MOCK_EMP_PORT) || 4002,
  },

  cloudinary: {
    configured: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  consent: {
    expiryCheckIntervalMs: Number(process.env.CONSENT_EXPIRY_CHECK_INTERVAL_MS) || 60_000,
  },

  verification: {
    confidenceThreshold: 0.85,
  },
};

/**
 * Validates and loads config (throws in production if critical vars missing).
 */
export function validateConfig(): void {
  const isProduction = config.server.isProduction;

  if (isProduction) {
    if (!process.env.MONGODB_URI) {
      throw new Error('FATAL: MONGODB_URI must be configured in production');
    }
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'replace-this-with-a-long-random-secret' || secret.length < 16) {
      throw new Error('FATAL: A secure JWT_SECRET of at least 16 characters must be configured in production');
    }
    if (!config.cloudinary.configured) {
      throw new Error('FATAL: Cloudinary credentials must be configured in production');
    }
  } else {
    if (!process.env.MONGODB_URI) {
      console.warn('WARN: MONGODB_URI not set. Using fallback: mongodb://127.0.0.1:27018/sih_demo');
    }
    if (!process.env.JWT_SECRET) {
      console.warn('WARN: JWT_SECRET not set. Using dev default.');
    }
  }
}

export default config;
