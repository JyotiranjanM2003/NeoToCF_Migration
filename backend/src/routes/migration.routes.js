const express = require('express');
const migrationController = require('../controllers/migration.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.post('/start', migrationController.start);
router.post('/start-batch', migrationController.startBatch);
router.get('/', migrationController.list);
router.get('/:id/status', migrationController.getStatus);
router.get('/:id/report', migrationController.getReport);

module.exports = router;
