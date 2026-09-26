const { asyncHandler } = require('../middleware/error');
const { listForUser, markRead, remove } = require('../services/notificationService');

const list = asyncHandler(async (req, res) => {
  const { limit, unreadOnly } = req.query;
  const result = await listForUser(req.user.id, { limit: limit ? Number(limit) : 30, unreadOnly: unreadOnly === 'true' });
  res.json(result);
});

const read = asyncHandler(async (req, res) => {
  const { id } = req.body || {};
  const result = await markRead(req.user.id, id ? Number(id) : null);
  res.json(result);
});

const clear = asyncHandler(async (req, res) => {
  const { query } = require('../config/db');
  await query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);
  res.json({ message: 'Cleared' });
});

const del = asyncHandler(async (req, res) => {
  await remove(req.user.id, Number(req.params.id));
  res.json({ message: 'Deleted' });
});

module.exports = { list, read, clear, del };
