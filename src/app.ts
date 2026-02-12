import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { morganStream } from './config/logger';
import routes from './routes';
// import {
//   errorConverter,
//   errorHandler,
//   notFoundHandler,
// } from './middlewares/error.middleware';

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// HTTP request logging
if (config.env !== 'test') {
  app.use(morgan(config.logging.format, { stream: morganStream }));
}

// API routes
app.use(`/api/${config.apiVersion}`, routes);

// Error handling
// app.use(notFoundHandler);
// app.use(errorConverter);
// app.use(errorHandler);

export default app;