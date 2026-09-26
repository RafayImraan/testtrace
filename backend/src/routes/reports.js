const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParam } = require('../validators/common');
const ctrl = require('../controllers/reportController');

router.use(authenticate);
router.get('/summary', ctrl.summary);
router.get('/cycle/:id.pdf', validate({ params: z.object({ id: idParam }) }), ctrl.pdf);
router.get('/cycle/:id.xlsx', validate({ params: z.object({ id: idParam }) }), ctrl.excel);

module.exports = router;
