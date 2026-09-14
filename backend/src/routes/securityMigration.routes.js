const express = require('express');
const securityMigrationController = require('../controllers/securityMigration.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/categories', securityMigrationController.listCategories);
router.get('/categories/:categoryKey/entries', securityMigrationController.listCategoryEntries);
router.post('/verify-alias', securityMigrationController.verifyAlias);
router.post('/migrate', securityMigrationController.migrate);

module.exports = router;