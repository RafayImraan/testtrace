const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/auditLogController');
router.use(authenticate, authorize('admin','lead'));
router.get('/', ctrl.list);
module.exports = router;
