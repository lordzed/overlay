const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'app-error.log');

function logError(label, err) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${label}: ${err?.message || err}\n${err?.stack || ''}\n\n`;
  console.error(message);

  try {
    fs.appendFileSync(logFile, message, 'utf8');
  } catch (writeErr) {
    console.error('Failed to write to log file:', writeErr);
  }
}

module.exports = {
  logError
};
