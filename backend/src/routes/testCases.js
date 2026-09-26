const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParam } = require('../validators/common');
const { createSchema, updateSchema, listQuery } = require('../validators/testCase');
const ctrl = require('../controllers/testCaseController');

router.use(authenticate);

router.get('/meta/modules', validate({ query: z.object({ projectId: z.string().optional() }) }), ctrl.modules);
router.get('/', validate({ query: listQuery }), ctrl.list);
router.get('/:id', validate({ params: z.object({ id: idParam }) }), ctrl.get);
router.post('/', authorize('admin','lead'), validate({ body: createSchema }), ctrl.create);
router.patch('/:id', authorize('admin','lead'), validate({ params: z.object({ id: idParam }), body: updateSchema }), ctrl.update);
router.delete('/:id', authorize('admin','lead'), validate({ params: z.object({ id: idParam }) }), ctrl.remove);

module.exports = router;
