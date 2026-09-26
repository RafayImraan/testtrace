const { z, CYCLE_STATES } = require('./common');

const createSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  name: z.string().trim().min(3).max(150),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(CYCLE_STATES).optional().default('planned'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  scheduleEnabled: z.coerce.boolean().optional().default(false),
  scheduleCron: z.string().max(60).optional().default('0 2 * * *'),
});

const updateSchema = z.object({
  name: z.string().trim().min(3).max(150).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(CYCLE_STATES).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  scheduleEnabled: z.coerce.boolean().optional(),
  scheduleCron: z.string().max(60).optional(),
});

const addTestsSchema = z.object({
  testCaseIds: z.array(z.coerce.number().int().positive()).min(1).max(100),
});

const assignSchema = z.object({
  cycleTestIds: z.array(z.coerce.number().int().positive()).min(1).max(100),
  assigneeId: z.coerce.number().int().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

module.exports = { createSchema, updateSchema, addTestsSchema, assignSchema };
