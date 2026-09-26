/**
 * Socket.io setup.
 * The browser connects with the same JWT it uses for the REST API:
 *   io(SOCKET_URL, { auth: { token } })
 * Every socket joins `user:<id>` (personal notifications) and, once the client
 * tells us which project it is viewing, `project:<id>` (dashboard/kanban feed).
 */
const { Server } = require('socket.io');
const config = require('../config/env');
const { verifyToken } = require('../middleware/auth');
const { pool } = require('../config/db');

function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    path: '/socket.io',
  });

  // Reject unauthenticated sockets before they can join any room.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('missing token'));
      const payload = verifyToken(token);
      const { rows } = await pool.query('SELECT id, role, is_active FROM users WHERE id = $1', [payload.sub]);
      if (!rows[0] || !rows[0].is_active) return next(new Error('unauthorized'));
      socket.user = rows[0];
      return next();
    } catch (err) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);

    // The client announces the active project so it receives project events.
    socket.on('project:join', async (projectId) => {
      const id = Number(projectId);
      if (!Number.isInteger(id) || id <= 0) return;
      Array.from(socket.rooms)
        .filter((r) => r.startsWith('project:'))
        .forEach((r) => socket.leave(r));
      socket.join(`project:${id}`);
      socket.emit('project:joined', { projectId: id });
    });

    socket.on('project:leave', (projectId) => socket.leave(`project:${projectId}`));
    socket.on('disconnect', () => { /* rooms are cleaned up automatically */ });
  });

  return io;
}

module.exports = { attachSockets };
