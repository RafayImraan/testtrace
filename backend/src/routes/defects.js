const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParam } = require('../validators/common');
const ctrl = require('../controllers/defectController');

router.use(authenticate);
router.get('/', validate({ query: z.object({ projectId: z.coerce.number().int().positive(), status: z.enum(['open','confirmed','fixed','closed']).optional(), severity: z.enum(['minor','major','critical','blocker']).optional() }) }), ctrl.list);
router.post('/', validate({ body: z.object({ projectId: z.coerce.number().int().positive(), requirementId: z.coerce.number().int().positive(), testCaseId: z.coerce.number().int().positive(), cycleTestId: z.coerce.number().int().positive().optional(), title: z.string().trim().min(3).max(200), description: z.string().trim().min(3).max(10000), severity: z.enum(['minor','major','critical','blocker']).optional() }) }), ctrl.create);
router.patch('/:id', authorize('admin','lead'), validate({ params: z.object({ id: idParam }), body: z.object({ status: z.enum(['open','confirmed','fixed','closed']).optional(), severity: z.enum(['minor','major','critical','blocker']).optional(), assignedTo: z.coerce.number().int().positive().optional() }).refine((v) => Object.keys(v).length > 0, 'At least one field is required') }), ctrl.update);

module.exports = router;
