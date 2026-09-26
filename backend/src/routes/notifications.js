const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParam } = require('../validators/common');
const ctrl = require('../controllers/notificationController');

router.use(authenticate);
router.get('/', ctrl.list);
router.post('/read', validate({ body: z.object({ id: z.coerce.number().int().positive().optional() }) }), ctrl.read);
router.delete('/', ctrl.clear);
router.delete('/:id', validate({ params: z.object({ id: idParam }) }), ctrl.del);

module.exports = router;
