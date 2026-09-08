const express = require('express');
const numberRangeController = require('../controllers/numberRange.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);
router.get('/', numberRangeController.list);
router.get('/:name', numberRangeController.getOne);
router.post('/migrate', numberRangeController.migrate);

module.exports = router;
