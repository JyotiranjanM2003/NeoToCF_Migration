const express = require('express');
const packageController = require('../controllers/package.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/', packageController.list);
router.get('/:packageId/artifacts', packageController.listArtifacts);
router.get('/:packageId/download', packageController.download);

module.exports = router;
