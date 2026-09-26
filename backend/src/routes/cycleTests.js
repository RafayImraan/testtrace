const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParam } = require('../validators/common');
const { statusSchema } = require('../validators/cycleTest');
const ctrl = require('../controllers/cycleTestController');

router.use(authenticate);

router.get('/my-tasks', ctrl.myTasks);
router.get('/:id/executions', validate({ params: z.object({ id: idParam }) }), ctrl.executions);
router.patch('/:id/status', validate({ params: z.object({ id: idParam }), body: statusSchema }), ctrl.changeStatus);
router.post('/:id/execute', validate({ params: z.object({ id: idParam }) }), ...ctrl.execute);

module.exports = router;
