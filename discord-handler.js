'use strict';
const https = require('https');

let userToken = null;
let isConnected = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeDiscordRequest(endpoint, method = 'GET', body = null, retries = 0) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'discord.com',
      path: `/api/v10${endpoint}`,
      method: method,
      headers: {
        'Authorization': `${userToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    };

    const req = https.request(options, async (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        // Handle rate limiting
        if (res.statusCode === 429) {
          const retryAfter = parseFloat(res.headers['retry-after'] || '1');
          if (retries < 3) {
            console.log(`Rate limited, retrying after ${retryAfter}s...`);
            await sleep(retryAfter * 1000 + 100);
            return makeDiscordRequest(endpoint, method, body, retries + 1).then(resolve).catch(reject);
          }
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`Discord API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let myUserId = null;

async function initDiscord(token) {
  if (!token || token === 'YOUR_DISCORD_TOKEN') {
    console.log('Discord token not configured');
    return false;
  }

  try {
    userToken = token;
    console.log('Testing Discord token...');
    
    // Test the token by fetching current user
    const user = await makeDiscordRequest('/users/@me');
    console.log(`Discord connected as ${user.username}#${user.discriminator}`);
    myUserId = user.id;
    isConnected = true;
    return true;
  } catch (e) {
    console.error('Discord login failed:', e.message);
    userToken = null;
    myUserId = null;
    isConnected = false;
    return false;
  }
}

async function getChats() {
  if (!isConnected) return { dms: [] };

  try {
    const dms = [];

    // Fetch all DM channels
    const dmList = await makeDiscordRequest('/users/@me/channels');
    for (const dm of dmList) {
      if (dm.type === 1) { // DM
        const recipient = dm.recipients[0];
        dms.push({
          id: dm.id,
          name: recipient?.username || 'Unknown',
          recipient: recipient?.id,
        });
      }
    }

    return { dms };
  } catch (e) {
    console.error('Failed to get chats:', e.message);
    return { dms: [] };
  }
}

async function getMessages(channelId, limit = 20) {
  if (!isConnected) return [];

  try {
    const msgs = await makeDiscordRequest(`/channels/${channelId}/messages?limit=${limit}`);
    if (!Array.isArray(msgs)) return [];

    return msgs
      .reverse()
      .map(m => ({
        id: m.id,
        author: m.author.username,
        authorId: m.author.id,
        content: m.content,
        timestamp: new Date(m.timestamp).getTime(),
        isOwn: m.author.id === myUserId,
      }));
  } catch (e) {
    console.error('Failed to fetch messages:', e.message);
    return [];
  }
}

async function sendMessage(channelId, content) {
  if (!isConnected) return false;

  try {
    await makeDiscordRequest(`/channels/${channelId}/messages`, 'POST', {
      content: content
    });
    return true;
  } catch (e) {
    console.error('Failed to send message:', e.message);
    return false;
  }
}

function disconnect() {
  userToken = null;
  isConnected = false;
}

module.exports = { initDiscord, getChats, getMessages, sendMessage, disconnect };
