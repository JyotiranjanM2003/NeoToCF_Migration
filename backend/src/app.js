const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const tenantRoutes = require('./routes/tenant.routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

app.use(helmet({
  // Disable helmet's default CSP — the frontend is a separate CF app served
  // from its own origin, so CSP must be configured per-deployment rather
  // than via a blanket default that blocks legitimate same-app resources.
  contentSecurityPolicy: false,
}));

// Allow requests from all configured client origins. CLIENT_ORIGIN can be a
// comma-separated list so multiple frontends (local dev + CF deployments) can
// be allowed at once, e.g.:
//   CLIENT_ORIGIN=http://localhost:3000,https://neo-cf-migration-frontend.cfapps.us10-004.hana.ondemand.com
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'https://neo-cf-migration-frontend.cfapps.eu10-004.hana.ondemand.com')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))  // strip any trailing slash — browsers never include one in Origin
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, same-origin server calls)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Return false (not an Error) so cors sends a plain response without
      // the ACAO header — avoids a 500 from Express's error handler.
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/packages', require('./routes/package.routes'));
app.use('/api/iflows', require('./routes/iflow.routes'));
app.use('/api/validation', require('./routes/validation.routes'));
app.use('/api/migration', require('./routes/migration.routes'));
app.use('/api/transform-rules', require('./routes/transformRule.routes'));

app.use('/api/variables', require('./routes/variableMigration.routes'));

app.use('/api/datastores', require('./routes/datastoreMigration.routes'));

app.use('/api/number-ranges', require('./routes/numberRange.routes'));
// Phase 3+ (Data Stores, Variables, Custom Tags, Number Ranges, Access
// Policies, Security Artifacts, Value Mapping Values) mount here, following
// the same service/controller/route pattern as packages & iflows above.
app.use('/api/security-artifacts', require('./routes/securityMigration.routes'));
// Phase 3+ (Custom Tags, Access Policies, Value Mapping Values) mount here,
// following the same service/controller/route pattern as packages & iflows above.
app.use('/api/migration-report', require('./routes/migrationReport.routes'));



app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
