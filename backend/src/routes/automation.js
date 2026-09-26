const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParam } = require('../validators/common');
const ctrl = require('../controllers/automationController');

router.use(authenticate);

router.get('/health', ctrl.health);
router.get('/scripts', ctrl.listScripts);
router.post('/scripts', authorize('admin','lead'), validate({ body: z.object({ testCaseId: z.coerce.number().int().positive(), name: z.string().min(3).max(120), type: z.enum(['ui','api']), filePath: z.string().min(3).max(255), description: z.string().max(2000).optional(), timeoutMs: z.coerce.number().int().min(1000).max(600000).optional() }) }), ctrl.createScript);
router.patch('/scripts/:id', authorize('admin','lead'), validate({ params: z.object({ id: idParam }), body: z.object({ name: z.string().min(3).max(120).optional(), type: z.enum(['ui','api']).optional(), filePath: z.string().min(3).max(255).optional(), description: z.string().max(2000).optional(), timeoutMs: z.coerce.number().int().min(1000).max(600000).optional(), isActive: z.coerce.boolean().optional() }) }), ctrl.updateScript);
router.delete('/scripts/:id', authorize('admin','lead'), validate({ params: z.object({ id: idParam }) }), ctrl.deleteScript);

router.get('/runs', ctrl.listRuns);
router.get('/runs/:id', validate({ params: z.object({ id: idParam }) }), ctrl.getRun);
router.post('/run', validate({ body: z.object({ testCaseIds: z.array(z.coerce.number().int().positive()).optional(), cycleId: z.coerce.number().int().positive().optional(), cycleTestIds: z.array(z.coerce.number().int().positive()).optional() }) }), ctrl.triggerRun);

router.post('/claim', validate({ body: z.object({ limit: z.coerce.number().int().min(1).max(20).optional(), workerId: z.string().max(80).optional() }) }), ctrl.claim);
router.post('/runs/:id/result', validate({ params: z.object({ id: idParam }), body: z.object({ status: z.enum(['PASSED','FAILED']), log: z.string().max(20000).optional(), error: z.string().max(10000).optional(), screenshotPath: z.string().max(500).optional(), durationMs: z.coerce.number().int().optional(), workerId: z.string().max(80).optional() }) }), ctrl.ingest);

router.get('/schedules', ctrl.listSchedules);
router.post('/schedules', authorize('admin','lead'), validate({ body: z.object({ cycleId: z.coerce.number().int().positive(), enabled: z.coerce.boolean(), cron: z.string().max(60).optional() }) }), ctrl.saveSchedule);

module.exports = router;
