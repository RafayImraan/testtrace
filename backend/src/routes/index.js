/**
 * Route index: everything under /api.
 * Modules are mounted here so app.js stays a 3-line wiring file.
 */
const router = require('express').Router();

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/projects', require('./projects'));
router.use('/requirements', require('./requirements'));
router.use('/test-cases', require('./testCases'));
router.use('/cycles', require('./cycles'));
router.use('/cycle-tests', require('./cycleTests'));
router.use('/dashboard', require('./dashboard'));
router.use('/automation', require('./automation'));
router.use('/reports', require('./reports'));
router.use('/audit-logs', require('./auditLogs'));
router.use('/notifications', require('./notifications'));

module.exports = router;
