const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParam } = require('../validators/common');
const { createSchema, updateSchema, addTestsSchema, assignSchema } = require('../validators/cycle');
const ctrl = require('../controllers/cycleController');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', validate({ params: z.object({ id: idParam }) }), ctrl.get);
router.get('/:id/kanban', validate({ params: z.object({ id: idParam }) }), ctrl.kanban);
router.post('/', authorize('admin','lead'), validate({ body: createSchema }), ctrl.create);
router.patch('/:id', authorize('admin','lead'), validate({ params: z.object({ id: idParam }), body: updateSchema }), ctrl.update);
router.delete('/:id', authorize('admin','lead'), validate({ params: z.object({ id: idParam }) }), ctrl.remove);

router.post('/:id/tests', authorize('admin','lead'), validate({ params: z.object({ id: idParam }), body: addTestsSchema }), ctrl.addTests);
router.delete('/:id/tests', authorize('admin','lead'), validate({ params: z.object({ id: idParam }), query: z.object({ testCaseId: z.coerce.number().int().positive() }) }), ctrl.removeTest);

router.post('/:id/assign', authorize('admin','lead'), validate({ params: z.object({ id: idParam }), body: assignSchema }), ctrl.assign);

module.exports = router;
