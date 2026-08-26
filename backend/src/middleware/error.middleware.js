const logger = require('../utils/logger');

function notFoundHandler(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });

  // Surface a clean message for known upstream (Neo/CF) API failures.
  if (err.response && err.response.data) {
    return res.status(err.response.status || 502).json({
      message: 'Upstream tenant API error',
      detail: err.response.data,
    });
  }

  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
}

module.exports = { notFoundHandler, errorHandler };
