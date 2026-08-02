const metrics = require('../services/metrics');

const SKIP_PREFIXES = ['/api/health', '/api/analytics'];

function shouldSkip(path) {
  return SKIP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Normalize dynamic segments so /api/f1/logo/foo collapses to /api/f1/logo/:id */
function normalizePath(rawPath) {
  if (!rawPath) return '';
  const pathOnly = String(rawPath).split('?')[0];
  return pathOnly
    .replace(/\/api\/f1\/logo\/[^/]+/i, '/api/f1/logo/:constructorId')
    .replace(/\/api\/f1\/circuit\/[^/]+/i, '/api/f1/circuit/:circuitId')
    .replace(/\/api\/f1\/flag\/[^/]+/i, '/api/f1/flag/:country');
}

function metricsMiddleware(req, res, next) {
  if (!req.path.startsWith('/api') || shouldSkip(req.path)) {
    return next();
  }

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    metrics.record({
      type: 'api',
      path: normalizePath(req.originalUrl || req.url),
      method: req.method,
      status: res.statusCode,
      duration_ms: Math.round(durationMs),
    });
  });

  next();
}

module.exports = {
  metricsMiddleware,
  normalizePath,
  shouldSkip,
};
