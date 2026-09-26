/** User routes: /api/users/*  (admin manages accounts; lead may read) */
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParam, email, password, ROLES } = require('../validators/common');
const ctrl = require('../controllers/userController');

const createSchema = z.object({
  email,
  password,
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(ROLES),
  avatarColor: z.string().max(9).optional(),
});

const updateSchema = z.object({
  email: email.optional(),
  password: password.optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.coerce.boolean().optional(),
  avatarColor: z.string().max(9).optional(),
});

const listQuery = z.object({
  role: z.enum(ROLES).optional(),
  active: z.coerce.boolean().optional(),
  q: z.string().max(80).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

router.get('/', authenticate, authorize('admin', 'lead'), validate({ query: listQuery }), ctrl.listUsers);
router.get('/assignable', authenticate, authorize('admin', 'lead'), ctrl.assignableUsers);
router.get('/:id', authenticate, authorize('admin', 'lead'), validate({ params: z.object({ id: idParam }) }), ctrl.getUser);
router.post('/', authenticate, authorize('admin'), validate({ body: createSchema }), ctrl.createUser);
router.patch('/:id', authenticate, authorize('admin'), validate({ params: z.object({ id: idParam }), body: updateSchema }), ctrl.updateUser);
router.delete('/:id', authenticate, authorize('admin'), validate({ params: z.object({ id: idParam }) }), ctrl.deactivateUser);

module.exports = router;
