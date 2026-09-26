const { z, priority } = require('./common');

const stepSchema = z.object({
  stepNo: z.number().int().positive().optional(),
  action: z.string().trim().min(3).max(2000),
});

const createSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  title: z.string().trim().min(3).max(200),
  preconditions: z.string().max(5000).optional().nullable(),
  expectedResult: z.string().trim().min(3).max(5000),
  priority: priority.default('medium'),
  module: z.string().trim().min(2).max(80),
  requirementId: z.coerce.number().int().positive().optional().nullable(),
  isAutomated: z.coerce.boolean().optional().default(false),
  steps: z.array(stepSchema).max(50).optional(),
});

const updateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  preconditions: z.string().max(5000).optional().nullable(),
  expectedResult: z.string().trim().min(3).max(5000).optional(),
  priority: priority.optional(),
  module: z.string().trim().min(2).max(80).optional(),
  requirementId: z.coerce.number().int().positive().optional().nullable(),
  isAutomated: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  steps: z.array(stepSchema).max(50).optional(),
});

const listQuery = z.object({
  projectId: z.string().optional(),
  q: z.string().max(100).optional(),
  module: z.string().max(80).optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  assigneeId: z.string().optional(),
  isAutomated: z.string().optional(),
  requirementId: z.string().optional(),
  cycleId: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.string().optional(),
});

module.exports = { createSchema, updateSchema, listQuery };
