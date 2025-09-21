// node driver-scripts/send-socket.js <serverOrigin> <token> <busId>
// Example: node send-socket.js http://localhost:3000 <TOKEN> bus101

const { io } = require("socket.io-client");

const [,, server, token, busId] = process.argv;
if (!server || !token || !busId) {
  console.error('Usage: node send-socket.js <server> <token> <busId>');
  process.exit(1);
}

const socket = io(`${server}/drivers`, {
  query: { token },
  reconnectionAttempts: 5
});

socket.on('connect', () => {
  console.log('connected as driver for', busId);
  // emit position periodically
  let lat = 28.6139, lng = 77.2090;
  setInterval(() => {
    lat += (Math.random()-0.5)*0.001;
    lng += (Math.random()-0.5)*0.001;
    socket.emit('position', { lat, lng, ts: Date.now() });
    console.log('emitted', lat, lng);
  }, 3000);
});

socket.on('connect_error', (err) => {
  console.error('connect_error', err.message);
});
