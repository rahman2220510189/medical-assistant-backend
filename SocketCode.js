const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// ── Room tracking ──
const rooms = {}; // roomId -> { doctor: socketId, patient: socketId }

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Join room
  socket.on('join-room', ({ roomId, role, userName }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = {};
    rooms[roomId][role] = socket.id;
    rooms[roomId][`${role}Name`] = userName;

    // Notify other user
    socket.to(roomId).emit('user-joined', { role, userName, socketId: socket.id });
    console.log(`${role} (${userName}) joined room ${roomId}`);
  });

  // WebRTC Signaling
  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Chat
  socket.on('chat-message', ({ roomId, message, sender, time }) => {
    io.to(roomId).emit('chat-message', { message, sender, time });
  });

  // End call
  socket.on('end-call', ({ roomId }) => {
    socket.to(roomId).emit('call-ended');
    delete rooms[roomId];
  });

  // Disconnect
  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.doctor === socket.id || room.patient === socket.id) {
        socket.to(roomId).emit('call-ended');
        delete rooms[roomId];
      }
    }
    console.log('Socket disconnected:', socket.id);
  });
});
