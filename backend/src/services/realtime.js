/**
 * Realtime gateway (socket.io).
 * The REST layer never talks to sockets directly: it calls emitToProject() /
 * emitToUser() and this module pushes the event to every connected browser.
 *
 * Rooms:
 *   project:<id>  -> everyone looking at a project (dashboard, kanban, lists)
 *   user:<id>     -> personal notifications (bell icon)
 * Clients join both on connect (see sockets/index.js).
 *
 * Events emitted:
 *   cycle_test:updated / cycle_test:assigned  -> kanban + dashboard refresh
 *   dashboard:refresh                         -> hint that stats changed
 *   automation:run                            -> run created / status changed
 *   notification:new                          -> bell icon + toast
 *   audit:new                                 -> audit page live append
 */
let io = null;

function init(serverIo) {
  io = serverIo;
  return io;
}

function getIo() {
  return io;
}

/** Emit to a project room (dashboards, kanban, lists). */
function emitToProject(projectId, event, payload) {
  if (!io || !projectId) return;
  io.to(`project:${projectId}`).emit(event, payload);
}

/** Emit to a single user (notifications). */
function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

/** Emit a change that affects dashboards to every project room. */
function emitDashboard(projectId, payload = {}) {
  emitToProject(projectId, 'dashboard:refresh', { at: new Date().toISOString(), ...payload });
}

module.exports = { init, getIo, emitToProject, emitToUser, emitDashboard };
