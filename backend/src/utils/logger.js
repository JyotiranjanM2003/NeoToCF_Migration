/* Minimal structured console logger. Swap for winston/pino later if needed. */
function timestamp() {
  return new Date().toISOString();
}

module.exports = {
  info: (msg, meta = {}) => console.log(`[INFO]  ${timestamp()} ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`[WARN]  ${timestamp()} ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`[ERROR] ${timestamp()} ${msg}`, meta),
};
