/**
 * OpenAPI 3 document served at /api/docs (Swagger UI).
 * It is hand written (no code generation) so every endpoint is documented
 * exactly as implemented. Kept in one file to make the viva demo easy.
 */
const config = require('./env');

const bearer = [{ bearerAuth: [] }];

const ok = (description, schemaRef) => ({
  description,
  ...(schemaRef ? { content: { 'application/json': { schema: schemaRef } } } : {}),
});

const errorResponses = {
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  422: { $ref: '#/components/responses/ValidationError' },
};

const idParam = (name = 'id') => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'integer' },
  description: 'Numeric identifier',
});

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const arr = (name) => ({ type: 'array', items: ref(name) });

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Test Trace & Automate API',
    version: '1.0.0',
    description: `
REST API of the **Test Trace & Automate** platform.

* JWT authentication (\`Authorization: Bearer <token>\`)
* Role based access control — roles: \`admin\`, \`lead\`, \`tester\`
* Consistent error envelope: \`{ "error": { "message", "code", "details" } }\`
* Realtime updates are pushed over socket.io (rooms \`project:<id>\`, \`user:<id>\`)

**Demo credentials** — admin@tta.local / Lead@123 / Tester@123 (see README).
`.trim(),
  },
  servers: [{ url: '/', description: 'same origin' }, { url: `http://localhost:${config.port}`, description: 'local API' }],
  tags: [
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Projects' },
    { name: 'Requirements' },
    { name: 'Test cases' },
    { name: 'Cycles' },
    { name: 'Dashboard' },
    { name: 'Automation' },
    { name: 'Reports' },
    { name: 'Audit logs' },
    { name: 'Notifications' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Validation failed' },
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'lead', 'tester'] },
          isActive: { type: 'boolean' },
          avatarColor: { type: 'string', nullable: true },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          code: { type: 'string', example: 'SHOP' },
          name: { type: 'string', example: 'ShopEase Web App' },
          description: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
        },
      },
      Requirement: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          projectId: { type: 'integer' },
          code: { type: 'string', example: 'REQ-001' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          testCaseCount: { type: 'integer' },
        },
      },
      TestCaseStep: {
        type: 'object',
        properties: {
          stepNo: { type: 'integer', example: 1 },
          action: { type: 'string', example: 'Open the login page' },
        },
      },
      TestCase: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          code: { type: 'string', example: 'TC-001' },
          title: { type: 'string' },
          preconditions: { type: 'string', nullable: true },
          expectedResult: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          module: { type: 'string', example: 'Login' },
          requirementId: { type: 'integer', nullable: true },
          requirementCode: { type: 'string', nullable: true },
          isAutomated: { type: 'boolean' },
          isActive: { type: 'boolean' },
          steps: arr('TestCaseStep'),
        },
      },
      CycleTest: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          cycleId: { type: 'integer' },
          testCaseId: { type: 'integer' },
          testCaseCode: { type: 'string' },
          title: { type: 'string' },
          module: { type: 'string' },
          priority: { type: 'string' },
          isAutomated: { type: 'boolean' },
          assigneeId: { type: 'integer', nullable: true },
          assigneeName: { type: 'string', nullable: true },
          dueDate: { type: 'string', format: 'date', nullable: true },
          status: { type: 'string', enum: ['pending', 'in_progress', 'passed', 'failed', 'blocked'] },
          actualResult: { type: 'string', nullable: true },
          remarks: { type: 'string', nullable: true },
          executedAt: { type: 'string', format: 'date-time', nullable: true },
          lastExecutionType: { type: 'string', enum: ['manual', 'automated'], nullable: true },
        },
      },
      TestCycle: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          projectId: { type: 'integer' },
          name: { type: 'string', example: 'Sprint 1 Regression' },
          description: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['planned', 'active', 'completed'] },
          startDate: { type: 'string', format: 'date', nullable: true },
          endDate: { type: 'string', format: 'date', nullable: true },
          scheduleEnabled: { type: 'boolean' },
          scheduleCron: { type: 'string', example: '0 2 * * *' },
          lastScheduledAt: { type: 'string', format: 'date-time', nullable: true },
          stats: ref('StatusCounts'),
        },
      },
      StatusCounts: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          pending: { type: 'integer' },
          in_progress: { type: 'integer' },
          passed: { type: 'integer' },
          failed: { type: 'integer' },
          blocked: { type: 'integer' },
          overdue: { type: 'integer' },
          executed: { type: 'integer' },
          executedPct: { type: 'number' },
          passRate: { type: 'number' },
        },
      },
      AutomationScript: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          testCaseId: { type: 'integer' },
          testCaseCode: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['ui', 'api'] },
          filePath: { type: 'string', example: 'ui/login-valid.js' },
          timeoutMs: { type: 'integer' },
          isActive: { type: 'boolean' },
        },
      },
      AutomationRun: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          batchId: { type: 'string', format: 'uuid' },
          scriptId: { type: 'integer' },
          testCaseId: { type: 'integer' },
          testCaseCode: { type: 'string' },
          cycleId: { type: 'integer', nullable: true },
          status: { type: 'string', enum: ['queued', 'running', 'done', 'error'] },
          triggerType: { type: 'string', enum: ['manual', 'scheduled'] },
          log: { type: 'string', nullable: true },
          error: { type: 'string', nullable: true },
          screenshotPath: { type: 'string', nullable: true },
          durationMs: { type: 'integer', nullable: true },
          startedAt: { type: 'string', format: 'date-time', nullable: true },
          finishedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Execution: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          cycleTestId: { type: 'integer' },
          status: { type: 'string' },
          executionType: { type: 'string', enum: ['manual', 'automated'] },
          actualResult: { type: 'string', nullable: true },
          remarks: { type: 'string', nullable: true },
          screenshotPath: { type: 'string', nullable: true },
          durationMs: { type: 'integer', nullable: true },
          executedByName: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuditLog: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer', nullable: true },
          userName: { type: 'string', nullable: true },
          entityType: { type: 'string' },
          entityId: { type: 'integer', nullable: true },
          action: { type: 'string' },
          oldValue: { type: 'object', nullable: true },
          newValue: { type: 'object', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          message: { type: 'string', nullable: true },
          type: { type: 'string', example: 'assignment' },
          link: { type: 'string', nullable: true },
          isRead: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
    responses: {
      Unauthorized: { description: 'Missing/invalid token', content: { 'application/json': { schema: ref('Error') } } },
      Forbidden: { description: 'Role not allowed', content: { 'application/json': { schema: ref('Error') } } },
      NotFound: { description: 'Not found', content: { 'application/json': { schema: ref('Error') } } },
      ValidationError: { description: 'Validation failed', content: { 'application/json': { schema: ref('Error') } } },
    },
  },
  security: bearer,
  paths: {
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive a JWT',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
              example: { email: 'lead@tta.local', password: 'Lead@123' },
            },
          },
        },
        responses: {
          200: ok('Token + user profile', {
            type: 'object',
            properties: { token: { type: 'string' }, user: ref('User') },
          }),
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { description: 'Too many login attempts', content: { 'application/json': { schema: ref('Error') } } },
        },
      },
    },
    '/api/auth/logout': { post: { tags: ['Auth'], summary: 'Log out (audit only)', responses: { 200: ok('OK') } } },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user + personal counters',
        responses: { 200: ok('Profile', { type: 'object', properties: { user: ref('User'), stats: { type: 'object' } } }) },
      },
    },
    '/api/auth/profile': {
      patch: {
        tags: ['Auth'],
        summary: 'Update own display name / avatar colour',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { fullName: { type: 'string' }, avatarColor: { type: 'string' } } } } },
        },
        responses: { 200: ok('Updated profile', { type: 'object', properties: { user: ref('User') } }) },
      },
    },
    '/api/auth/password': {
      post: {
        tags: ['Auth'],
        summary: 'Change own password',
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 6 } } },
            },
          },
        },
        responses: { 200: ok('Password updated'), 400: { description: 'Wrong current password' } },
      },
    },
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'List users (admin/lead)',
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['admin', 'lead', 'tester'] } },
          { name: 'active', in: 'query', schema: { type: 'boolean' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: ok('Users', { type: 'object', properties: { data: arr('User'), meta: ref('Pagination') } }), ...errorResponses },
      },
      post: {
        tags: ['Users'],
        summary: 'Create a user (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'fullName', 'role'],
                properties: {
                  email: { type: 'string' }, password: { type: 'string', minLength: 6 },
                  fullName: { type: 'string' }, role: { type: 'string', enum: ['admin', 'lead', 'tester'] },
                },
              },
            },
          },
        },
        responses: { 201: ok('Created', { type: 'object', properties: { user: ref('User') } }), ...errorResponses },
      },
    },
    '/api/users/assignable': {
      get: { tags: ['Users'], summary: 'Light list of users that can own work', responses: { 200: ok('Users', { type: 'object', properties: { data: arr('User') } }) } },
    },
    '/api/users/{id}': {
      get: { tags: ['Users'], summary: 'Get user', parameters: [idParam()], responses: { 200: ok('User', { type: 'object', properties: { user: ref('User') } }), 404: { $ref: '#/components/responses/NotFound' } } },
      patch: {
        tags: ['Users'],
        summary: 'Update user (admin only)',
        parameters: [idParam()],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { fullName: { type: 'string' }, role: { type: 'string' }, isActive: { type: 'boolean' }, password: { type: 'string' }, email: { type: 'string' } } } } },
        },
        responses: { 200: ok('Updated', { type: 'object', properties: { user: ref('User') } }), ...errorResponses },
      },
      delete: { tags: ['Users'], summary: 'Deactivate a user (admin only)', parameters: [idParam()], responses: { 200: ok('Deactivated'), ...errorResponses } },
    },
    '/api/projects': {
      get: { tags: ['Projects'], summary: 'List projects', responses: { 200: ok('Projects', { type: 'object', properties: { data: arr('Project') } }) } },
      post: {
        tags: ['Projects'], summary: 'Create a project (admin/lead)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code', 'name'], properties: { code: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' } } } } } },
        responses: { 201: ok('Created', { type: 'object', properties: { project: ref('Project') } }), ...errorResponses },
      },
    },
    '/api/projects/{id}': {
      get: { tags: ['Projects'], summary: 'Get a project', parameters: [idParam()], responses: { 200: ok('Project', { type: 'object', properties: { project: ref('Project') } }) } },
      patch: { tags: ['Projects'], summary: 'Update a project (admin/lead)', parameters: [idParam()], responses: { 200: ok('Updated'), ...errorResponses } },
    },
    '/api/requirements': {
      get: {
        tags: ['Requirements'], summary: 'List requirements',
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'integer' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: ok('Requirements', { type: 'object', properties: { data: arr('Requirement'), meta: ref('Pagination') } }) },
      },
      post: {
        tags: ['Requirements'], summary: 'Create a requirement (admin/lead)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['projectId', 'title'], properties: { projectId: { type: 'integer' }, title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string' } } } } } },
        responses: { 201: ok('Created', { type: 'object', properties: { requirement: ref('Requirement') } }), ...errorResponses },
      },
    },
    '/api/requirements/{id}': {
      get: { tags: ['Requirements'], summary: 'Get a requirement', parameters: [idParam()], responses: { 200: ok('Requirement') } },
      patch: { tags: ['Requirements'], summary: 'Update (admin/lead)', parameters: [idParam()], responses: { 200: ok('Updated') } },
      delete: { tags: ['Requirements'], summary: 'Delete (admin/lead)', parameters: [idParam()], responses: { 200: ok('Deleted') } },
    },
    '/api/requirements/traceability/matrix': {
      get: {
        tags: ['Requirements'], summary: 'Traceability matrix (requirement x test case x latest result)',
        parameters: [{ name: 'projectId', in: 'query', schema: { type: 'integer' } }, { name: 'cycleId', in: 'query', schema: { type: 'integer' } }],
        responses: { 200: ok('Matrix', { type: 'object', properties: { data: { type: 'array' }, summary: { type: 'object' } } }) },
      },
    },
    '/api/test-cases': {
      get: {
        tags: ['Test cases'], summary: 'Search / filter / paginate test cases',
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'integer' } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'code or title' },
          { name: 'module', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'assigneeId', in: 'query', schema: { type: 'integer' } },
          { name: 'isAutomated', in: 'query', schema: { type: 'boolean' } },
          { name: 'requirementId', in: 'query', schema: { type: 'integer' } },
          { name: 'cycleId', in: 'query', schema: { type: 'integer' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: ok('Test cases', { type: 'object', properties: { data: arr('TestCase'), meta: ref('Pagination') } }) },
      },
      post: {
        tags: ['Test cases'], summary: 'Create a test case (admin/lead)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['projectId', 'title', 'expectedResult', 'module'],
                properties: {
                  projectId: { type: 'integer' }, title: { type: 'string' }, preconditions: { type: 'string' },
                  expectedResult: { type: 'string' }, priority: { type: 'string' }, module: { type: 'string' },
                  requirementId: { type: 'integer', nullable: true }, isAutomated: { type: 'boolean' },
                  steps: arr('TestCaseStep'),
                },
              },
            },
          },
        },
        responses: { 201: ok('Created', { type: 'object', properties: { testCase: ref('TestCase') } }), ...errorResponses },
      },
    },
    '/api/test-cases/{id}': {
      get: { tags: ['Test cases'], summary: 'Test case detail (steps, executions, cycles)', parameters: [idParam()], responses: { 200: ok('Detail'), 404: { $ref: '#/components/responses/NotFound' } } },
      patch: { tags: ['Test cases'], summary: 'Update (admin/lead)', parameters: [idParam()], responses: { 200: ok('Updated'), ...errorResponses } },
      delete: { tags: ['Test cases'], summary: 'Soft delete (admin/lead)', parameters: [idParam()], responses: { 200: ok('Deactivated') } },
    },
    '/api/test-cases/meta/modules': { get: { tags: ['Test cases'], summary: 'Distinct module names for filters', responses: { 200: ok('Modules') } } },
    '/api/cycles': {
      get: { tags: ['Cycles'], summary: 'List cycles with progress stats', parameters: [{ name: 'projectId', in: 'query', schema: { type: 'integer' } }], responses: { 200: ok('Cycles', { type: 'object', properties: { data: arr('TestCycle') } }) } },
      post: { tags: ['Cycles'], summary: 'Create a cycle (admin/lead)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['projectId', 'name'], properties: { projectId: { type: 'integer' }, name: { type: 'string' }, description: { type: 'string' }, status: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' } } } } } }, responses: { 201: ok('Created'), ...errorResponses } },
    },
    '/api/cycles/{id}': {
      get: { tags: ['Cycles'], summary: 'Cycle detail + its cycle_tests + stats', parameters: [idParam()], responses: { 200: ok('Detail') } },
      patch: { tags: ['Cycles'], summary: 'Update cycle / nightly schedule (admin/lead)', parameters: [idParam()], responses: { 200: ok('Updated') } },
      delete: { tags: ['Cycles'], summary: 'Delete cycle (admin/lead)', parameters: [idParam()], responses: { 200: ok('Deleted') } },
    },
    '/api/cycles/{id}/tests': {
      post: { tags: ['Cycles'], summary: 'Add test cases to a cycle (admin/lead)', parameters: [idParam()], responses: { 201: ok('Added') } },
      delete: { tags: ['Cycles'], summary: 'Remove a test case from a cycle (admin/lead)', parameters: [idParam()], responses: { 200: ok('Removed') } },
    },
    '/api/cycles/{id}/kanban': { get: { tags: ['Cycles'], summary: 'Kanban board data for a cycle', parameters: [idParam()], responses: { 200: ok('Board') } } },
    '/api/cycles/{id}/assign': {
      post: { tags: ['Cycles'], summary: 'Assign one/many cycle tests to a user with a due date (admin/lead)', parameters: [idParam()], responses: { 200: ok('Assigned') } },
    },
    '/api/cycle-tests/my-tasks': { get: { tags: ['Cycles'], summary: 'Tasks assigned to the current user', responses: { 200: ok('Tasks', { type: 'object', properties: { data: arr('CycleTest') } }) } } },
    '/api/cycle-tests/{id}/status': {
      patch: { tags: ['Cycles'], summary: 'Change status (testers: only their own assigned tests)', parameters: [idParam()], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['pending', 'in_progress', 'passed', 'failed', 'blocked'] }, actualResult: { type: 'string' }, remarks: { type: 'string' } } } } } }, responses: { 200: ok('Updated'), ...errorResponses } },
    },
    '/api/cycle-tests/{id}/execute': {
      post: { tags: ['Cycles'], summary: 'Execute with screenshot upload (multipart/form-data)', parameters: [idParam()], responses: { 200: ok('Execution recorded'), ...errorResponses } },
    },
    '/api/cycle-tests/{id}/executions': { get: { tags: ['Cycles'], summary: 'Execution history of a cycle test', parameters: [idParam()], responses: { 200: ok('History', { type: 'object', properties: { data: arr('Execution') } }) } } },
    '/api/dashboard/stats': {
      get: {
        tags: ['Dashboard'], summary: 'Live dashboard cards + charts for a cycle (or the whole project)',
        parameters: [{ name: 'cycleId', in: 'query', schema: { type: 'integer' } }, { name: 'projectId', in: 'query', schema: { type: 'integer' } }],
        responses: { 200: ok('Stats') },
      },
    },
    '/api/automation/scripts': {
      get: { tags: ['Automation'], summary: 'List automation scripts (+ linked test case)', responses: { 200: ok('Scripts', { type: 'object', properties: { data: arr('AutomationScript') } }) } },
      post: { tags: ['Automation'], summary: 'Register a script for a test case (admin/lead)', responses: { 201: ok('Created'), ...errorResponses } },
    },
    '/api/automation/scripts/{id}': {
      patch: { tags: ['Automation'], summary: 'Update a script (admin/lead)', parameters: [idParam()], responses: { 200: ok('Updated') } },
      delete: { tags: ['Automation'], summary: 'Delete a script (admin/lead)', parameters: [idParam()], responses: { 200: ok('Deleted') } },
    },
    '/api/automation/health': { get: { tags: ['Automation'], summary: 'Queue depth + worker liveness', responses: { 200: ok('Health') } } },
    '/api/automation/runs': {
      get: {
        tags: ['Automation'], summary: 'Run history with filters',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['queued', 'running', 'done', 'error'] } },
          { name: 'cycleId', in: 'query', schema: { type: 'integer' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: ok('Runs', { type: 'object', properties: { data: arr('AutomationRun'), meta: ref('Pagination') } }) },
      },
    },
    '/api/automation/runs/{id}': { get: { tags: ['Automation'], summary: 'Run detail (log, error, screenshot)', parameters: [idParam()], responses: { 200: ok('Run', { type: 'object', properties: { run: ref('AutomationRun') } }) } } },
    '/api/automation/run': {
      post: {
        tags: ['Automation'], summary: 'Queue automation for test cases / a whole cycle',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  testCaseIds: { type: 'array', items: { type: 'integer' } },
                  cycleId: { type: 'integer' },
                  cycleTestIds: { type: 'array', items: { type: 'integer' } },
                },
              },
            },
          },
        },
        responses: { 202: ok('Queued', { type: 'object', properties: { batchId: { type: 'string' }, queued: { type: 'integer' } } }), ...errorResponses },
      },
    },
    '/api/automation/claim': { post: { tags: ['Automation'], summary: 'Worker-only: atomically claim up to N queued runs (FOR UPDATE SKIP LOCKED)', responses: { 200: ok('Claimed runs') } } },
    '/api/automation/runs/{id}/result': { post: { tags: ['Automation'], summary: 'Worker-only: post the outcome (PASSED/FAILED + log + screenshot)', parameters: [idParam()], responses: { 200: ok('Ingested'), ...errorResponses } } },
    '/api/automation/schedules': {
      get: { tags: ['Automation'], summary: 'List cycles with nightly scheduling state', responses: { 200: ok('Schedules') } },
      post: { tags: ['Automation'], summary: 'Enable/disable the nightly run for a cycle (admin/lead)', responses: { 200: ok('Saved'), ...errorResponses } },
    },
    '/api/reports/cycle/{id}.pdf': { get: { tags: ['Reports'], summary: 'Download the cycle report as PDF', parameters: [idParam()], responses: { 200: { description: 'PDF file', content: { 'application/pdf': {} } } } } },
    '/api/reports/cycle/{id}.xlsx': { get: { tags: ['Reports'], summary: 'Download the cycle report as Excel', parameters: [idParam()], responses: { 200: { description: 'XLSX file', content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {} } } } } },
    '/api/reports/summary': { get: { tags: ['Reports'], summary: 'Report preview data (JSON)', responses: { 200: ok('Summary') } } },
    '/api/audit-logs': {
      get: {
        tags: ['Audit logs'], summary: 'Audit trail (admin/lead)',
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'integer' } },
          { name: 'entityType', in: 'query', schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: ok('Logs', { type: 'object', properties: { data: arr('AuditLog'), meta: ref('Pagination') } }), ...errorResponses },
      },
    },
    '/api/notifications': {
      get: { tags: ['Notifications'], summary: 'My notifications + unread count', responses: { 200: ok('Notifications', { type: 'object', properties: { data: arr('Notification'), unread: { type: 'integer' } } }) } },
      delete: { tags: ['Notifications'], summary: 'Clear all my notifications', responses: { 200: ok('Cleared') } },
    },
    '/api/notifications/read': { post: { tags: ['Notifications'], summary: 'Mark one (or all) notifications as read', responses: { 200: ok('Marked') } } },
  },
};

module.exports = { spec };
