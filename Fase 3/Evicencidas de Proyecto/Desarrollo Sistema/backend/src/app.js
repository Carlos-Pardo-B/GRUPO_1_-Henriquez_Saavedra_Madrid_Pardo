import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import orgRoutes from './routes/orgRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import cemeteryRoutes from './routes/cemeteryRoutes.js';
import deceasedRoutes from './routes/deceasedRoutes.js';
import funeralRoutes from './routes/funeralRoutes.js';
import userPortalRoutes from './routes/userPortalRoutes.js';
import funeralLeadsRoutes from './routes/funeralLeadsRoutes.js';
import cemeteryLeadsRoutes from './routes/cemeteryLeadsRoutes.js';
import memorialRoutes from './routes/memorialRoutes.js';
import marketplaceOrgRoutes from './routes/marketplaceOrgRoutes.js';
import marketplacePublicRoutes from './routes/marketplacePublicRoutes.js';
import marketplaceLeadsRoutes from './routes/marketplaceLeadsRoutes.js';
import { authRequired, orgContextRequired } from './middleware/authMiddleware.js';
import { siteContextRequired } from './middleware/siteMiddleware.js';
import { superAdminRequired } from './middleware/adminMiddleware.js';

const app = express();

// Middlewares
app.use(express.json());

// CORS: allow any origin
const corsOptions = {
  origin: (origin, callback) => callback(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};
app.use(cors(corsOptions));

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'MemorialConnect API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/auth',
      public: '/public',
      org: '/org',
      admin: '/admin'
    }
  });
});

// Auth routes
app.use('/auth', authRoutes);

// Public routes
app.use('/public', publicRoutes);
app.use('/public/marketplace', marketplacePublicRoutes);

// Organization routes (require auth)
app.use('/org', authRequired, orgRoutes);
app.use(
  '/org/marketplace',
  authRequired,
  orgContextRequired,
  marketplaceOrgRoutes
);

// Admin routes (superadmin only)
app.use('/admin', authRequired, superAdminRequired, adminRoutes);

// Cemetery structure routes (org + site context required)
app.use(
  '/org/cemetery',
  authRequired,
  orgContextRequired,
  siteContextRequired,
  cemeteryRoutes
);

// Deceased records routes
app.use(
  '/org/deceased',
  authRequired,
  orgContextRequired,
  siteContextRequired,
  deceasedRoutes
);

// Funeraria routes
app.use(
  '/org/funeral',
  authRequired,
  orgContextRequired,
  funeralRoutes
);

app.use(
  '/org/funeral/leads',
  authRequired,
  orgContextRequired,
  funeralLeadsRoutes
);

app.use(
  '/org/cemetery/leads',
  authRequired,
  orgContextRequired,
  cemeteryLeadsRoutes
);

// End-user portal
app.use('/user', authRequired, userPortalRoutes);
app.use('/user/memorials', authRequired, memorialRoutes.userRouter);
app.use('/public/memorials', memorialRoutes.publicRouter);
app.use('/user/marketplace/leads', authRequired, marketplaceLeadsRoutes.userRouter);
app.use('/org/marketplace/leads', authRequired, orgContextRequired, marketplaceLeadsRoutes.orgRouter);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  const statusCode = err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;
