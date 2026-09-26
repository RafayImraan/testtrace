const { z, TEST_STATUSES } = require('./common');

const statusSchema = z.object({
  status: z.enum(TEST_STATUSES),
  actualResult: z.string().max(5000).optional().nullable(),
  remarks: z.string().max(5000).optional().nullable(),
});

const executeSchema = z.object({
  status: z.enum(TEST_STATUSES),
  actualResult: z.string().max(5000).optional().nullable(),
  remarks: z.string().max(5000).optional().nullable(),
});

module.exports = { statusSchema, executeSchema };
