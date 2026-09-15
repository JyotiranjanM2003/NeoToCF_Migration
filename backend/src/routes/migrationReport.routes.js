const express = require('express');
const migrationReportController = require('../controllers/migrationReport.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/', migrationReportController.getReport);

module.exports = router;