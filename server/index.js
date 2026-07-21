const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('./config');
require('./db'); // initialize schema

const { authenticate, notFound, errorHandler } = require('./middleware/core');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      scriptSrc: ["'self'"],
    },
  },
}));

if (config.corsOrigins.length) app.use(cors({ origin: config.corsOrigins }));

app.use(express.json({ limit: '256kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));

// Everything below requires a valid access token; each route enforces its own permission.
app.use('/api', authenticate);
app.use('/api/users', require('./routes/users'));
app.use('/api/opportunities', require('./routes/opportunities'));
app.use('/api/bids', require('./routes/bids'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api', require('./routes/meta'));

app.use('/api', notFound);

// Static SPA
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.use(errorHandler);

if (config.seedOnBoot) require('./seed');

app.listen(config.port, () => {
  console.log(`ODG Operations Platform listening on http://localhost:${config.port} (${config.isProd ? 'production' : 'development'})`);
});
