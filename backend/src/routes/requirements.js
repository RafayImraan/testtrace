const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParam } = require('../validators/common');
const ctrl = require('../controllers/requirementController');

router.use(authenticate);

router.get('/traceability/matrix', ctrl.matrix);
router.get('/', ctrl.list);
router.get('/:id', validate({ params: z.object({ id: idParam }) }), ctrl.get);
router.post('/', authorize('admin','lead'), validate({ body: z.object({ projectId: z.coerce.number().int().positive(), title: z.string().min(3).max(200), description: z.string().max(5000).optional(), priority: z.enum(['low','medium','high','critical']).optional() }) }), ctrl.create);
router.patch('/:id', authorize('admin','lead'), validate({ params: z.object({ id: idParam }), body: z.object({ title: z.string().min(3).max(200).optional(), description: z.string().max(5000).optional(), priority: z.enum(['low','medium','high','critical']).optional() }) }), ctrl.update);
router.delete('/:id', authorize('admin','lead'), validate({ params: z.object({ id: idParam }) }), ctrl.remove);

module.exports = router;
