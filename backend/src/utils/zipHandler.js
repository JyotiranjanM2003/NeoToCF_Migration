/**
 * Streams a binary zip buffer (from a Neo $value download) back to the
 * browser with the right headers, so the frontend Download buttons can
 * trigger a normal file save.
 */
function sendZip(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(Buffer.from(buffer));
}

module.exports = { sendZip };
