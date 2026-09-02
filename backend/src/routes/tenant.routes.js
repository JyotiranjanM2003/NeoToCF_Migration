// const express = require('express');
// const sourceTenantController = require('../controllers/sourceTenant.controller');
// const targetTenantController = require('../controllers/targetTenant.controller');
// const { requireAuth } = require('../middleware/auth.middleware');

// const router = express.Router();

// router.use(requireAuth);

// // Source (Neo)
// router.post('/source', sourceTenantController.connect);
// router.get('/source', sourceTenantController.getStatus);
// router.post('/source/test', sourceTenantController.testExisting);

// // Target (Cloud Foundry)
// router.post('/target', targetTenantController.connect);
// router.get('/target', targetTenantController.getStatus);
// router.post('/target/test', targetTenantController.testExisting);

// module.exports = router;


const express = require('express');
const sourceTenantController = require('../controllers/sourceTenant.controller');
const targetTenantController = require('../controllers/targetTenant.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

// Source (Neo) — multiple tenants per user
router.get('/source', sourceTenantController.list);
router.post('/source', sourceTenantController.create);
router.get('/source/:id', sourceTenantController.getOne);
router.put('/source/:id', sourceTenantController.update);
router.post('/source/:id/test', sourceTenantController.test);
router.post('/source/:id/select', sourceTenantController.select);
router.delete('/source/:id', sourceTenantController.remove);

// Target (Cloud Foundry) — multiple tenants per user
router.get('/target', targetTenantController.list);
router.post('/target', targetTenantController.create);
router.get('/target/:id', targetTenantController.getOne);
router.put('/target/:id', targetTenantController.update);
router.post('/target/:id/test', targetTenantController.test);
router.post('/target/:id/select', targetTenantController.select);
router.delete('/target/:id', targetTenantController.remove); 

module.exports = router;