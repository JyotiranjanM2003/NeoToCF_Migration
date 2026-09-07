const express = require('express');
const variableMigrationController = require('../controllers/variableMigration.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

// List all source variables
router.get('/list', variableMigrationController.list);

// Validate a specific variable exists on source
router.get('/lookup', variableMigrationController.lookup);

// Start a variable migration (returns migrationId; caller polls /api/migration/:id/status)
router.post('/migrate', variableMigrationController.migrateStart);

module.exports = router;
