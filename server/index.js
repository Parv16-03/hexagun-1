// server/index.js
// Node.js + Express + Socket.IO server for real-time bus tracking.
// Accepts driver updates via REST or via a driver Socket.IO namespace,
// verifies JWT driver token, and broadcasts updates to passenger clients.

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { verifyDriverToken, createDriverToken } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // restrict in production to your frontend domain
    methods: ['GET','POST']
  },
  // with long polling fallback; you can tune transports if needed
});

// In-memory store for last known positions (optional; replace with Redis/Mongo)
const lastPositions = {}; // { busId: { lat, lng, ts } }

// ---------- REST endpoint for driver reports (simple) ----------
app.post('/api/driver/update', (req, res) => {
  // Expect Authorization: Bearer <JWT_TOKEN>
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const payload = verifyDriverToken(token);
  if (!payload || !payload.busId) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { busId } = payload;
  const { lat, lng, timestamp } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng required as numbers' });
  }

  const ts = timestamp || Date.now();
  const position = { lat, lng, ts };

  // store last-known
  lastPositions[busId] = position;

  // broadcast to passengers in room `bus_<busId>`
  io.to(`bus_${busId}`).emit('locationUpdate', { busId, ...position });

  return res.json({ ok: true });
});

// ---------- Admin/dev endpoint to mint tokens (demo only) ----------
app.post('/api/token/driver', (req, res) => {
  // DANGEROUS: In production, issue tokens via secure auth flow.
  // This endpoint is for testing or admin use only.

  const { busId, driverId } = req.body;
  if (!busId) return res.status(400).json({ error: 'busId required' });

  const token = createDriverToken({ busId, driverId: driverId || 'demo' });
  return res.json({ token });
});

// ---------- Passenger HTTP helper (get last position) ----------
app.get('/api/bus/:busId/last', (req, res) => {
  const busId = req.params.busId;
  if (!lastPositions[busId]) return res.status(404).json({ error: 'Not found' });
  return res.json({ busId, ...lastPositions[busId] });
});

// ---------- Socket.IO setup ----------
// Passenger namespace (default '/')
io.on('connection', (socket) => {
  // Passenger will join a room to receive updates for a bus
  // expect: socket.emit('subscribe', { busId: 'abcd' })
  socket.on('subscribe', ({ busId }) => {
    if (!busId) return;
    socket.join(`bus_${busId}`);
    // optional: send last-known location right away
    if (lastPositions[busId]) {
      socket.emit('locationUpdate', { busId, ...lastPositions[busId] });
    }
  });

  socket.on('unsubscribe', ({ busId }) => {
    socket.leave(`bus_${busId}`);
  });
});

// Driver namespace using token authentication via query param or handshake
// Drivers connect to /drivers namespace with ?token=<JWT>
const drivers = io.of('/drivers');

drivers.use((socket, next) => {
  const token = socket.handshake.query?.token;
  const payload = verifyDriverToken(token);
  if (!payload || !payload.busId) {
    return next(new Error('unauthorized'));
  }
  socket.driverInfo = payload; // attach for later
  next();
});

drivers.on('connection', (socket) => {
  const { busId } = socket.driverInfo;
  console.log(`Driver connected for bus ${busId}`);

  // driver will emit 'position' events
  socket.on('position', (data) => {
    const { lat, lng, ts } = data;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    const tsFinal = ts || Date.now();
    lastPositions[busId] = { lat, lng, ts: tsFinal };
    // broadcast to passengers
    io.to(`bus_${busId}`).emit('locationUpdate', { busId, lat, lng, ts: tsFinal });
  });

  socket.on('disconnect', (reason) => {
    console.log(`Driver for ${busId} disconnected: ${reason}`);
    // Optionally broadcast offline status
    io.to(`bus_${busId}`).emit('driverDisconnected', { busId, ts: Date.now() });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
