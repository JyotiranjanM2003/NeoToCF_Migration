/**
 * SAP HANA connection pool.
 * Uses @sap/hana-client. Exposes a small promise-based query helper so the
 * rest of the app never touches the raw driver callback API.
 */
const hana = require('@sap/hana-client');
const logger = require('../utils/logger');

const poolParams = {
  poolSize: 10,
  connectTimeout: 15000,
  /*
   * How long (ms) a connection can sit idle in the pool before it is
   * proactively closed and replaced.  Set below HANA's own idle-timeout
   * (default 600 s = 10 min) so the pool never hands out a stale connection.
   */
  idleTimeout: 300000,          // 5 minutes
  /*
   * Automatically re-establish a connection when it is found to be broken
   * on checkout.
   */
  reconnect: true,
  /*
   * Ping the server before returning a connection from the pool.
   * Adds a tiny round-trip but eliminates "connection not connected" errors.
   */
  pingCheck: true,
};

const connParams = {
  serverNode: `${process.env.HANA_HOST}:${process.env.HANA_PORT}`,
  uid: process.env.HANA_USER,
  pwd: process.env.HANA_PASSWORD,
  encrypt: process.env.HANA_ENCRYPT !== 'false',
  sslValidateCertificate: process.env.HANA_SSL_VALIDATE_CERT !== 'false',
};

const SCHEMA = process.env.HANA_SCHEMA;

const pool = hana.createPool(connParams, poolParams);

/**
 * Run a parameterized SQL statement against HANA.
 * @param {string} sql - SQL with ? placeholders
 * @param {Array} params
 * @returns {Promise<Array<object>>}
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.getConnection((connErr, conn) => {
      if (connErr) {
        logger.error('HANA connection error', connErr);
        return reject(connErr);
      }
      conn.exec(`SET SCHEMA "${SCHEMA}"`, [], (schemaErr) => {
        if (schemaErr) {
          conn.close();
          logger.error('HANA set schema error', schemaErr);
          return reject(schemaErr);
        }
        conn.exec(sql, params, (execErr, rows) => {
          conn.close();
          if (execErr) {
            logger.error('HANA query error', { sql, execErr });
            return reject(execErr);
          }
          resolve(rows);
        });
      });
    });
  });
}

module.exports = { query, pool };