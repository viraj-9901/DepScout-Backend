import 'module-alias/register';
import app from './app';
import { config } from './config';
// import { connectDatabase } from './config/database';
import { logger } from './config/logger';

const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    // await connectDatabase();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config. port} in ${config.env} mode`);
      logger.info(`📚 API available at http://localhost:${config.port}/api/${config.apiVersion}`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string): void => {
      logger.info(`${signal} received.  Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Close database connections
        // const mongoose = await import('mongoose');
        // await mongoose.connection. close();
        // logger.info('MongoDB connection closed');
        
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger. error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();