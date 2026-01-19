/**
 * Manuscript Service
 * Main entry point - Express server with Socket.io for real-time job status
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import healthRouter from './routes/health';
import manuscriptRouter from './routes/manuscripts';
import artifactRouter from './routes/artifacts';
import { initializeQueue, getQueue } from './queues/manuscript.queue';
import { getRedisConnection } from './redis';

const PORT = process.env.PORT || 3003;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

async function main() {
  const app = express();
  const httpServer = createServer(app);

  // Socket.io for real-time job status updates
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
  });

  // Middleware
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json({ limit: '50mb' })); // Large limit for manuscript content

  // Routes
  app.use('/health', healthRouter);
  app.use('/api/manuscripts', manuscriptRouter);
  app.use('/api/artifacts', artifactRouter);

  // Initialize BullMQ queue
  await initializeQueue();
  const queue = getQueue();

  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log('[Socket.io] Client connected:', socket.id);

    // Allow clients to subscribe to specific job updates
    socket.on('subscribe:job', (jobId: string) => {
      socket.join(`job:${jobId}`);
      console.log(`[Socket.io] Client ${socket.id} subscribed to job:${jobId}`);
    });

    socket.on('unsubscribe:job', (jobId: string) => {
      socket.leave(`job:${jobId}`);
    });

    // Allow clients to subscribe to manuscript updates
    socket.on('subscribe:manuscript', (manuscriptId: string) => {
      socket.join(`manuscript:${manuscriptId}`);
      console.log(`[Socket.io] Client ${socket.id} subscribed to manuscript:${manuscriptId}`);
    });

    socket.on('unsubscribe:manuscript', (manuscriptId: string) => {
      socket.leave(`manuscript:${manuscriptId}`);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Client disconnected:', socket.id);
    });
  });

  // BullMQ event listeners for real-time updates
  queue.on('progress', (job, progress) => {
    io.to(`job:${job.id}`).emit('job:progress', {
      jobId: job.id,
      progress,
      timestamp: new Date().toISOString(),
    });

    // Also emit to manuscript room if job has manuscriptId
    if (job.data.manuscriptId) {
      io.to(`manuscript:${job.data.manuscriptId}`).emit('manuscript:job:progress', {
        jobId: job.id,
        jobType: job.data.type,
        progress,
        timestamp: new Date().toISOString(),
      });
    }
  });

  queue.on('completed', (job, result) => {
    // GOVERNANCE: Sanitize result before emitting
    // The handlers already sanitize, but this is defense in depth
    const safeResult = {
      jobId: job.id,
      status: 'completed',
      completedAt: new Date().toISOString(),
      // Only include non-PHI metadata
      resultSummary: result?.summary || 'Job completed successfully',
    };

    io.to(`job:${job.id}`).emit('job:completed', safeResult);

    if (job.data.manuscriptId) {
      io.to(`manuscript:${job.data.manuscriptId}`).emit('manuscript:job:completed', {
        ...safeResult,
        jobType: job.data.type,
      });
    }
  });

  queue.on('failed', (job, error) => {
    const safeError = {
      jobId: job?.id,
      status: 'failed',
      failedAt: new Date().toISOString(),
      error: error.message, // Only message, not stack trace
    };

    if (job?.id) {
      io.to(`job:${job.id}`).emit('job:failed', safeError);
    }

    if (job?.data?.manuscriptId) {
      io.to(`manuscript:${job.data.manuscriptId}`).emit('manuscript:job:failed', {
        ...safeError,
        jobType: job.data.type,
      });
    }
  });

  // Global error handling
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Manuscript Service] Unhandled error:', err);

    // GOVERNANCE: Never expose internal error details
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
    });
  });

  // Start server
  httpServer.listen(PORT, () => {
    console.log(`[Manuscript Service] Running on port ${PORT}`);
    console.log(`[Manuscript Service] Socket.io enabled for real-time updates`);
    console.log(`[Manuscript Service] CORS origin: ${CORS_ORIGIN}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Manuscript Service] Shutting down...');

    // Close Socket.io connections
    io.close();

    // Close Redis connection
    const redis = getRedisConnection();
    await redis.quit();

    // Close HTTP server
    httpServer.close(() => {
      console.log('[Manuscript Service] Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('[Manuscript Service] Fatal error:', error);
  process.exit(1);
});
