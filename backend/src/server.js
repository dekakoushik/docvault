import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import vaultRoutes from './routes/vault.js';
import { initDatabase } from './db.js';
import { logAudit } from './logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically if needed
const uploadsPath = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');
app.use('/uploads', express.static(uploadsPath));

// Audit request logger for .agent tracking
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') {
    const logInfo = {
      method: req.method,
      path: req.path,
      ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1'
    };
    logAudit('HTTP_REQUEST', 'API_CLIENT', logInfo);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DocVault Authentication & Document Vault Service',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  logAudit('SERVER_ERROR', 'SYSTEM', { error: err.message });
  res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
});

// Start Server
async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`DocVault Enterprise Server running on port ${PORT}`);
      console.log(`Vault API: http://localhost:${PORT}/api/vault`);
      console.log(`Auth API:  http://localhost:${PORT}/api/auth`);
      console.log(`SQLite database connected.`);
      console.log(`Audit logs written to .agent/audit.log`);
      console.log(`===============================================`);
      logAudit('SERVER_STARTED', 'SYSTEM', { port: PORT });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    logAudit('SERVER_START_FAILED', 'SYSTEM', { error: error.message });
  }
}

start();
