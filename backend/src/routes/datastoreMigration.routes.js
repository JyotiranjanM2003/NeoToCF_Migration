const express = require('express');
const datastoreMigrationController = require('../controllers/datastoreMigration.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

// List all source data stores
router.get('/list', datastoreMigrationController.list);

// Validate a specific data store exists on source (+ retention preview)
router.get('/lookup', datastoreMigrationController.lookup);

// Start a data store migration (returns migrationId; caller polls /api/migration/:id/status)
router.post('/migrate', datastoreMigrationController.migrateStart);

module.exports = router;