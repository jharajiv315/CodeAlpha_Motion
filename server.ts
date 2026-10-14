import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { runMigrations } from './server/db/migrate.ts';
import { seedDatabase } from './server/db/seed.ts';
import { initSocketIO } from './server/realtime/socket.ts';
import { authenticate } from './server/middleware/auth.ts';

// Routes
import { authRouter } from './server/routes/auth.ts';
import { workspaceRouter } from './server/routes/workspaces.ts';
import { projectRouter } from './server/routes/projects.ts';
import { taskRouter } from './server/routes/tasks.ts';
import { blockerRouter } from './server/routes/blockers.ts';
import { decisionRouter } from './server/routes/decisions.ts';
import { commentRouter } from './server/routes/comments.ts';
import { notificationRouter } from './server/routes/notifications.ts';
import { digestRouter } from './server/routes/digests.ts';
import { dailyDigestWorker } from './server/cron/dailyDigestWorker.ts';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Initialize Socket.IO on the same HTTP server
  initSocketIO(server);

  // Common middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(authenticate);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'MOTION Collaborative Work Platform',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API modules
  app.use('/api/auth', authRouter);
  app.use('/api/workspaces', workspaceRouter);
  app.use('/api/projects', projectRouter);
  app.use('/api', taskRouter);
  app.use('/api', blockerRouter);
  app.use('/api', decisionRouter);
  app.use('/api', commentRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/digests', digestRouter);

  // Database initialization & seeding
  try {
    await runMigrations();
    await seedDatabase();

    // Start Daily Digest background task worker
    dailyDigestWorker.start();
  } catch (err) {
    console.error('[Startup] Database initialization error:', err);
  }

  // Frontend integration (Vite dev middleware or static production build)
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[MOTION] Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[MOTION] Fatal startup error:', err);
  process.exit(1);
});
