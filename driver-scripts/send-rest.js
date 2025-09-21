// node driver-scripts/send-rest.js <serverOrigin> <token> <busId>
// Example: node send-rest.js http://localhost:3000 <TOKEN> bus101

const fetch = require('node-fetch'); // npm i node-fetch@2
const [,, server, token, busId] = process.argv;
if (!server || !token || !busId) {
  console.error('Usage: node send-rest.js <server> <token> <busId>');
  process.exit(1);
}

// Simulate movement in small increments
let lat = 28.6139; // start lat
let lng = 77.2090; // start lng

async function send() {
  lat += (Math.random()-0.5)*0.001;
  lng += (Math.random()-0.5)*0.001;
  const res = await fetch(`${server}/api/driver/update`, {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ lat, lng, timestamp: Date.now() })
  });
  console.log('sent', await res.json());
}

setInterval(send, 3000); // every 3s
send();
