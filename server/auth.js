// server/auth.js
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-please-change';

// Create JWT for driver with limited TTL (e.g., 6 hours)
function createDriverToken(payload) {
  // payload must contain busId
  return jwt.sign(payload, SECRET, { expiresIn: process.env.DRIVER_TOKEN_TTL || '6h' });
}

function verifyDriverToken(token) {
  try {
    const p = jwt.verify(token, SECRET);
    return p;
  } catch (e) {
    return null;
  }
}

module.exports = { createDriverToken, verifyDriverToken };
