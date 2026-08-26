const express = require('express');
const validationController = require('../controllers/validation.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.post('/run', validationController.run);

module.exports = router;
