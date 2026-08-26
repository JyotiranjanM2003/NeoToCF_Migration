const TransformRuleModel = require('../models/TransformRule.model');

async function list(req, res, next) {
  try {
    const rules = await TransformRuleModel.listActiveForUser(req.user.userId);
    res.json({ rules });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { ruleName, findValue, replaceValue, parameterScope } = req.body;
    if (!findValue || !replaceValue) {
      return res.status(400).json({ message: 'findValue and replaceValue are required' });
    }
    const id = await TransformRuleModel.create({
      userId: req.user.userId,
      ruleName,
      findValue,
      replaceValue,
      parameterScope,
    });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await TransformRuleModel.remove(req.params.id, req.user.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, remove };
