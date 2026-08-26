const express = require('express');
const iflowController = require('../controllers/iflow.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/:id', iflowController.getDetail);
router.get('/:id/configuration', iflowController.getConfiguration);
router.get('/:id/download', iflowController.download);

module.exports = router;
