/** Deliberately raises an exception to verify that the worker records failures. */
module.exports = async ({ log, run }) => {
  log(`Run ${run.id}: raising the planned worker error-handling exception`);
  throw new Error('Intentional worker crash test: expected controlled failure');
};
