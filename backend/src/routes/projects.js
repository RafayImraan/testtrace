/** Project routes: /api/projects/* */
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParam } = require('../validators/common');
const ctrl = require('../controllers/projectController');

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, validate({ params: z.object({ id: idParam }) }), ctrl.get);
router.post(
  '/',
  authenticate,
  authorize('admin', 'lead'),
  validate({
    body: z.object({
      code: z.string().trim().min(2).max(20),
      name: z.string().trim().min(3).max(120),
      description: z.string().max(2000).optional(),
    }),
  }),
  ctrl.create
);
router.patch(
  '/:id',
  authenticate,
  authorize('admin', 'lead'),
  validate({
    params: z.object({ id: idParam }),
    body: z.object({
      name: z.string().trim().min(3).max(120).optional(),
      description: z.string().max(2000).optional(),
      isActive: z.coerce.boolean().optional(),
    }),
  }),
  ctrl.update
);

module.exports = router;
