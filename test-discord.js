const https = require('https');

const token = "YOUR_DISCORD_BOT_TOKEN_HERE";

function makeDiscordRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'discord.com',
      path: `/api/v10${endpoint}`,
      method: method,
      headers: {
        'Authorization': `${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers:`, res.headers);
        console.log(`Body:`, data.substring(0, 500));
        resolve();
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function test() {
  console.log("Testing token...");
  await makeDiscordRequest('/users/@me/channels');
}

test();
