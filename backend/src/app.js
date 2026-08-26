const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const tenantRoutes = require('./routes/tenant.routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/packages', require('./routes/package.routes'));
app.use('/api/iflows', require('./routes/iflow.routes'));
app.use('/api/validation', require('./routes/validation.routes'));
app.use('/api/migration', require('./routes/migration.routes'));
app.use('/api/transform-rules', require('./routes/transformRule.routes'));

// Phase 3+ (Data Stores, Variables, Custom Tags, Number Ranges, Access
// Policies, Security Artifacts, Value Mapping Values) mount here, following
// the same service/controller/route pattern as packages & iflows above.

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
