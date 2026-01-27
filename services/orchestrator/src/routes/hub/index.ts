/**
 * Planning Hub API Routes
 *
 * Main entry point for Hub routes. Aggregates all sub-routes
 * for pages, databases, tasks, goals, and projections.
 */

import { Router } from 'express';
import pagesRoutes from './pages';
import databasesRoutes from './databases';
import tasksRoutes from './tasks';
import goalsRoutes from './goals';
import projectionsRoutes from './projections';

const router = Router();

// Register sub-routes
router.use('/pages', pagesRoutes);
router.use('/databases', databasesRoutes);
router.use('/tasks', tasksRoutes);
router.use('/goals', goalsRoutes);
router.use('/projections', projectionsRoutes);

// Health check for hub API
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'planning-hub',
    timestamp: new Date().toISOString(),
  });
});

export default router;
