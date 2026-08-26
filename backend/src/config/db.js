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
};

const connParams = {
  serverNode: `${process.env.HANA_HOST}:${process.env.HANA_PORT}`,
  uid: process.env.HANA_USER,
  pwd: process.env.HANA_PASSWORD,
  currentSchema: process.env.HANA_SCHEMA,
  encrypt: process.env.HANA_ENCRYPT !== 'false',
  sslValidateCertificate: process.env.HANA_SSL_VALIDATE_CERT !== 'false',
};

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
}

module.exports = { query, pool };
