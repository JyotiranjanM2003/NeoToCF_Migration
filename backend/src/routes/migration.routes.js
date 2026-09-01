// const express = require('express');
// const migrationController = require('../controllers/migration.controller');
// const { requireAuth } = require('../middleware/auth.middleware');

// const router = express.Router();
// router.use(requireAuth);

// router.post('/start', migrationController.start);
// router.get('/', migrationController.list);
// router.get('/:id/status', migrationController.getStatus);
// router.get('/:id/report', migrationController.getReport);

// module.exports = router;


const express = require('express');
const migrationController = require('../controllers/migration.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

// Batch routes first — distinct path shapes from the single-migration routes
// below, but grouped here for readability.
router.post('/batch/start', migrationController.startBatch);
router.get('/batch/active', migrationController.getActiveBatch);
router.get('/batch/:batchId/status', migrationController.getBatchStatus);
router.get('/batch/:batchId/report', migrationController.getBatchReport);

router.post('/start', migrationController.start);
router.get('/', migrationController.list);
router.get('/:id/status', migrationController.getStatus);
router.get('/:id/report', migrationController.getReport);

module.exports = router;