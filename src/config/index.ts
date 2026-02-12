import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion:  process.env.API_VERSION || 'v1',
  
  // mongodb: {
  //   uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp',
  //   options: {
  //     maxPoolSize: 10,
  //     serverSelectionTimeoutMS: 5000,
  //     socketTimeoutMS: 45000,
  //   },
  // },
  
  // jwt: {
  //   secret: process.env.JWT_SECRET || 'default-secret-change-me',
  //   expiresIn:  process.env.JWT_EXPIRES_IN || '7d',
  // },
  
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'dev',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },

  // baseUrl: {
  //   url: process.env.BASE_URL || `http://localhost:${process.env.PORT || '3000'}`,
  // },
  
  // rateLimit: {
  //   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  //   max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  // },
} as const;

// Validate required environment variables in production
if (config.env === 'production') {
  const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Environment variable ${envVar} is required in production`);
    }
  }
}