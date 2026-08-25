import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { startScheduler } from './services/campaignScheduler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for Vercel previews (or specify exact domains)
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// API routes
app.use('/api', routes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'ProSource API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// Start server only if not running on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║   🚀 ProSource API Server               ║
  ║   Powered by Protype                     ║
  ║                                          ║
  ║   Port:  ${PORT}                            ║
  ║   Mode:  ${process.env.NODE_ENV || 'development'}                  ║
  ║                                          ║
  ╚══════════════════════════════════════════╝
  `);

    // Start the campaign scheduler
    startScheduler();
  });
}

export default app;
