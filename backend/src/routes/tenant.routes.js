const express = require('express');
const sourceTenantController = require('../controllers/sourceTenant.controller');
const targetTenantController = require('../controllers/targetTenant.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

// Source (Neo)
router.post('/source', sourceTenantController.connect);
router.get('/source', sourceTenantController.getStatus);
router.post('/source/test', sourceTenantController.testExisting);

// Target (Cloud Foundry)
router.post('/target', targetTenantController.connect);
router.get('/target', targetTenantController.getStatus);
router.post('/target/test', targetTenantController.testExisting);

module.exports = router;
