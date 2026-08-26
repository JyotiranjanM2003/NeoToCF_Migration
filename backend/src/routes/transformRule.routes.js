const express = require('express');
const transformRuleController = require('../controllers/transformRule.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);

router.get('/', transformRuleController.list);
router.post('/', transformRuleController.create);
router.delete('/:id', transformRuleController.remove);

module.exports = router;
