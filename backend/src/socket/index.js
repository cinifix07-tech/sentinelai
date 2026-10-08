let io;

function initSocket(server, corsOptions) {
  const { Server } = require('socket.io');
  io = new Server(server, { cors: corsOptions });
  io.on('connection', (socket) => {
    socket.emit('connected', { message: 'Smart security realtime channel ready' });
  });
  return io;
}

function emit(event, payload) {
  if (io) io.emit(event, payload);
}

module.exports = { initSocket, emit };
