/**
 * Request validation with zod.
 *   validate({ body: schema, query: schema, params: schema })
 * Replaces req.body/query/params with the parsed (and coerced) values so
 * controllers can trust their inputs. Errors are returned as 422 with a
 * field-by-field details array.
 */
const { ApiError } = require('./error');

function runSchema(schema, value, where) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const details = result.error.issues.map((i) => ({
    field: `${where}.${i.path.join('.')}`,
    message: i.message,
  }));
  throw new ApiError(422, 'Validation failed', { code: 'VALIDATION_ERROR', details });
}

function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.params) req.params = runSchema(schemas.params, req.params, 'params');
      if (schemas.query) req.validatedQuery = runSchema(schemas.query, req.query, 'query');
      if (schemas.body) req.body = runSchema(schemas.body, req.body, 'body');
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validate };
