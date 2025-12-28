import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import crmRoutes from './routes/crm.routes';
import financeRoutes from './routes/finance.routes';
import templateRoutes from './routes/template.routes';
import usersRoutes from './routes/users.routes';
import tasksRoutes from './routes/tasks.routes';
import notesRoutes from './routes/notes.routes';
import chatRoutes from './routes/chat.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost',
      'http://localhost:3000',
      'http://localhost:80',
      config.cors.origin,
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for development
    }
  },
  credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/finance/templates', templateRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/chat', chatRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;

