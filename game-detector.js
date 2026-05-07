'use strict';
const { exec } = require('child_process');
const https    = require('https');
const fs       = require('fs');
const path     = require('path');

// ── process cache ──────────────────────────────────────────────────────────
let processCache = [];
let lastProcessCheck = 0;
const PROCESS_CACHE_MS = 1000; // cache for 1 second

// ── helpers ──────────────────────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ── process list (Windows) - optimized with caching ────────────────────────
function getRunningProcesses() {
  return new Promise(resolve => {
    const now = Date.now();
    
    // Return cached result if still fresh
    if (processCache.length > 0 && (now - lastProcessCheck) < PROCESS_CACHE_MS) {
      return resolve(processCache);
    }
    
    // Use WMI via PowerShell for faster process listing
    const ps = `Get-Process -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName | ForEach-Object { $_.ToLower() }`;
    exec(`powershell -NoProfile -Command "${ps}"`, { timeout: 2000 }, (err, stdout) => {
      if (err) {
        console.error('Process detection error, falling back to tasklist');
        // Fallback to tasklist
        exec('tasklist /nh', { timeout: 2000 }, (err2, stdout2) => {
          if (!err2) {
            processCache = stdout2.split('\n')
              .map(l => l.trim().toLowerCase().split(/\s+/)[0])
              .filter(Boolean);
          }
          lastProcessCheck = Date.now();
          resolve(processCache);
        });
        return;
      }
      
      processCache = stdout.split('\n')
        .map(l => l.trim() + '.exe')
        .filter(l => l.length > 4 && l !== '.exe');
      
      lastProcessCheck = Date.now();
      resolve(processCache);
    });
  });
}

// foreground window title via PowerShell (lightweight)
function getForegroundTitle() {
  return new Promise(resolve => {
    const ps = `Add-Type @"
using System;using System.Runtime.InteropServices;
public class Win32{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")]public static extern int GetWindowText(IntPtr h,System.Text.StringBuilder s,int n);
public static string Title(){var s=new System.Text.StringBuilder(256);GetWindowText(GetForegroundWindow(),s,256);return s.ToString();}}
"@; [Win32]::Title()`;
    exec(`powershell -NoProfile -Command "${ps.replace(/\n/g,' ')}"`, { timeout: 2000 }, (err, out) => {
      resolve(err ? '' : out.trim());
    });
  });
}

// ── known-games list (process → Steam appId + friendly name) ─────────────────
// Users can extend this. appId is the Steam App ID.
const KNOWN_GAMES = [
  
  { exe: 'DOOMTheDarkAges.exe', appId: 3017860, name: 'DOOM The Dark Ages' }, 
  { exe: 're9.exe', appId: 3764200, name: 'Resident Evil Requiem' }, 
  { exe: 'DyingLightGame_TheBeast_x64_rwdi.exe', appId: 3008130, name: 'Dying Light: The Beast Restored Land' },
  { exe: 'horizonzerodawn.exe', appId: 1151640, name: 'Horizon Zero Dawn' },
  { exe: 'deadcells.exe',       appId: 588650, name: 'Dead Cells' },
  { exe: 'cs2.exe',             appId: 730,    name: 'Counter-Strike 2' },
  { exe: 'csgo.exe',            appId: 730,    name: 'CS:GO' },
  { exe: 'dota2.exe',           appId: 570,    name: 'Dota 2' },
  { exe: 'hl2.exe',             appId: 220,    name: 'Half-Life 2' },
  { exe: 'destiny2.exe',        appId: 1085660,name: 'Destiny 2' },
  { exe: 'eldenring.exe',       appId: 1245620,name: 'Elden Ring' },
  { exe: 'witcher3.exe',        appId: 292030, name: 'The Witcher 3' },
  { exe: 'gta5.exe',            appId: 271590, name: 'GTA V' },
  { exe: 'cyberpunk2077.exe',   appId: 1091500,name: 'Cyberpunk 2077' },
  { exe: 'rocketleague.exe',    appId: 252950, name: 'Rocket League' },
  { exe: 'valheim.exe',         appId: 892970, name: 'Valheim' },
  { exe: 'rust.exe',            appId: 252490, name: 'Rust' },
  { exe: 'battlefront2.exe',    appId: 1237950,name: 'Battlefront II' },
  { exe: 'NMS.exe',             appId: 275850, name: 'No Man\'s Sky' },
  { exe: 'sh2.exe',             appId: 2105510, name: 'Silent Hill 2' },
  { exe: 'shf.exe',             appId: 2105530, name: 'Silent Hill f' },
  { exe: 'Cronos.exe',          appId: 2180190, name: 'Cronos: The New Dawn' },
  { exe: 'ClairObscure.exe',    appId: 2358720, name: 'Clair Obscure: Expedition 33' },
  { exe: 'DeathStranding2.exe', appId: 2151230, name: 'Death Stranding 2' },
  { exe: 'TLOU-II.exe',          appId: 3060430, name: 'The Last of Us Part II Remaster' },
  { exe: 'gylt.exe',            appId: 1071980, name: 'GYLT' },
  { exe: 'HorizonFW.exe',       appId: 1589280, name: 'Horizon Forbidden West' },
  { exe: 'LiesOfP.exe',         appId: 1627620, name: 'Lies of P' },
  { exe: 'RDR2.exe',            appId: 1174180, name: 'Red Dead Redemption II' },
  { exe: 'stalker2.exe',        appId: 2465790, name: 'S.T.A.L.K.E.R. 2: Heart of Chornobyl' },
  { exe: 'Stray.exe',           appId: 1332010, name: 'Stray' },
  { exe: 'MOM.exe',             appId: 939850,  name: 'The Dark Pictures: Man of Medan' },
  { exe: 'LittleHope.exe',      appId: 1084010, name: 'The Dark Pictures: Little Hope' },
  { exe: 'HouseOfAshes.exe',    appId: 1179040, name: 'The Dark Pictures: House of Ashes' },
  { exe: 'Wraithless.exe',      appId: 1475410, name: 'The Dark Pictures: The Devil in Me' },
  { exe: 'minecraft.exe',       appId: null,   name: 'Minecraft' },
  { exe: 'fortnite.exe',        appId: null,   name: 'Fortnite' },
  { exe: 'overwatch.exe',       appId: null,   name: 'Overwatch' },
  { exe: 'r5apex.exe',          appId: 1172470,name: 'Apex Legends' },
  { exe: 'cod.exe',             appId: null,   name: 'Call of Duty' },
  { exe: 'starcraft2.exe',      appId: null,   name: 'StarCraft II' },
  { exe: 'leagueoflegends.exe', appId: null,   name: 'League of Legends' },
];

// ── Steam API ─────────────────────────────────────────────────────────────────
async function fetchAchievements(apiKey, steamId, appId) {
  if (!appId || !apiKey || apiKey === 'YOUR_STEAM_API_KEY') {
    console.log(`[STEAM] Skipped - missing API key or appId (appId: ${appId})`);
    return null;
  }
  try {
    console.log(`[STEAM] Fetching achievements for app ${appId}...`);
    const [schemaRes, playerRes] = await Promise.race([
      Promise.all([
        httpsGet(`https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=${appId}`),
        httpsGet(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${apiKey}&steamid=${steamId}&appid=${appId}`)
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout')), 5000))
    ]);

    const schema  = schemaRes?.game?.availableGameStats?.achievements || [];
    const player  = playerRes?.playerstats?.achievements || [];

    if (!schema.length) {
      console.log('[STEAM] No achievements found in schema');
      return null;
    }

    // merge schema + player status
    const playerMap = {};
    player.forEach(a => { playerMap[a.apiname] = a; });

    const list = schema.map(s => ({
      apiname:     s.name,  // Store the API name for matching with GSE
      name:        s.displayName || s.name,  // Display name for showing to user
      description: s.description || '',
      icon:        s.icon || '',
      iconGray:    s.icongray || '',
      achieved:    playerMap[s.name]?.achieved === 1,
      unlockTime:  playerMap[s.name]?.unlocktime || 0,
      hidden:      s.hidden === 1,
    }));

    const achieved = list.filter(a => a.achieved).length;
    console.log(`[STEAM] ✓ Loaded ${achieved}/${list.length} achievements from Steam API`);
    return { list, achieved, total: list.length };
  } catch (e) {
    console.error('[STEAM] API error:', e.message);
    return null;
  }
}

// ── GSE Saves (local achievements) ────────────────────────────────────────────
function readGSESaves(appId) {
  try {
    const gseDir = path.join(process.env.APPDATA, 'GSE Saves', String(appId));
    const achievementsPath = path.join(gseDir, 'achievements.json');
    
    console.log(`[GSE] Reading achievements for app ${appId} from: ${achievementsPath}`);
    
    if (!fs.existsSync(achievementsPath)) {
      console.log(`[GSE] File not found: ${achievementsPath}`);
      return null;
    }
    
    const data = JSON.parse(fs.readFileSync(achievementsPath, 'utf8'));
    const list = Object.entries(data).map(([apiname, obj]) => ({
      apiname:     apiname,  // Store the API name for matching with Steam
      name:        apiname,
      description: '',
      icon:        '',
      iconGray:    '',
      achieved:    obj.earned === true,
      unlockTime:  obj.earned_time || 0,
      hidden:      false,
    }));
    
    const achieved = list.filter(a => a.achieved).length;
    console.log(`[GSE] ✓ Loaded ${achieved}/${list.length} achievements from GSE Saves`);
    return { list, achieved, total: list.length };
  } catch (e) {
    console.error('[GSE] Error reading achievements:', e.message);
    return null;
  }
}

// ── merge achievements from GSE and Steam API ─────────────────────────────────
function mergeAchievements(gseData, steamData) {
  if (!gseData && !steamData) {
    console.log('[MERGE] No achievement data from either source');
    return null;
  }
  if (!gseData) {
    console.log('[MERGE] Using Steam API data only');
    return steamData;
  }
  if (!steamData) {
    console.log('[MERGE] Using GSE data only (no Steam metadata available)');
    return gseData;
  }
  
  // If Steam has no achievements in schema, use GSE
  if (!steamData.list || steamData.list.length === 0) {
    console.log('[MERGE] Steam API returned no achievements, using GSE data');
    return gseData;
  }
  
  // If GSE has no achievements, use Steam
  if (!gseData.list || gseData.list.length === 0) {
    console.log('[MERGE] GSE has no achievements, using Steam API data');
    return steamData;
  }
  
  // Build a map of GSE achievements by API name for matching
  const gseMap = {};
  gseData.list.forEach(a => { 
    gseMap[a.apiname] = a; 
  });
  
  console.log(`[MERGE] Matching: GSE has ${Object.keys(gseMap).length} entries, Steam has ${steamData.list.length} entries`);
  
  // Take Steam's full list as base (has all metadata), override unlock status from GSE by apiname match
  let matchCount = 0;
  const merged = steamData.list.map(steamAch => {
    const gseAch = gseMap[steamAch.apiname];  // Match by API name, not display name
    if (gseAch?.achieved) {
      matchCount++;
      console.log(`[MERGE] ✓ Matched unlock: ${steamAch.apiname} (${steamAch.name})`);
    }
    return {
      ...steamAch,
      // Override achieved status and unlock time from GSE if we have a match
      achieved:   gseAch?.achieved ?? steamAch.achieved,
      unlockTime: gseAch?.unlockTime ?? steamAch.unlockTime,
    };
  });
  
  const achieved = merged.filter(a => a.achieved).length;
  console.log(`[MERGE] ✓ Merged using Steam metadata + GSE unlock status → ${achieved}/${merged.length} total (${matchCount} GSE matches found)`);
  return { list: merged, achieved, total: merged.length };
}

// ── also try to auto-detect via owned games list ──────────────────────────────
async function getOwnedGames(apiKey, steamId) {
  if (!apiKey || apiKey === 'YOUR_STEAM_API_KEY') return [];
  try {
    const res = await Promise.race([
      httpsGet(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout')), 5000))
    ]);
    return res?.response?.games || [];
  } catch { return []; }
}

// ── main detect function ──────────────────────────────────────────────────────
async function detectGame(apiKey, steamId) {
  const [procs, title, ownedGames] = await Promise.all([
    getRunningProcesses(),
    getForegroundTitle(),
    getOwnedGames(apiKey, steamId),
  ]);

  const titleLower = title.toLowerCase();
  console.log(`[DETECT] Running processes: ${procs.slice(0, 5).join(', ')}${procs.length > 5 ? '...' : ''}`);

  // 1. match by known exe list (hardcoded games)
  const procs_lower = procs.map(p => p.toLowerCase());
  let match = KNOWN_GAMES.find(g => procs_lower.includes(g.exe.toLowerCase()));
  if (match) {
    console.log(`[DETECT] ✓ Found known game: ${match.name} (appId: ${match.appId})`);
    const steamAch = await fetchAchievements(apiKey, steamId, match.appId);
    const gseAch = readGSESaves(match.appId);
    const achievements = mergeAchievements(gseAch, steamAch) || gseAch;
    return { name: match.name, appId: match.appId, achievements };
  }

  console.log('[DETECT] No known game found, checking owned games...');

  // 2. if not found, try matching owned Steam games by process name
  if (ownedGames.length) {
    console.log(`[DETECT] Checking ${ownedGames.length} owned games against processes...`);
    for (const game of ownedGames) {
      const exeName = game.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.exe';
      const found = procs.find(p => p.toLowerCase().replace(/[^a-z0-9.]/g, '') === exeName);
      if (found) {
        console.log(`[DETECT] ✓ Found owned game by process: ${game.name} (appId: ${game.appid})`);
        const steamAch = await fetchAchievements(apiKey, steamId, game.appid);
        const gseAch = readGSESaves(game.appid);
        const achievements = mergeAchievements(gseAch, steamAch) || gseAch;
        return { name: game.name, appId: game.appid, achievements };
      }
    }
  }

  console.log('[DETECT] No game found by process, checking window title...');

  // 3. fallback: match foreground window title against owned games
  if (ownedGames.length && titleLower) {
    console.log(`[DETECT] Window title: "${title}"`);
    const byTitle = ownedGames.find(g =>
      titleLower.includes(g.name.toLowerCase()) ||
      g.name.toLowerCase().includes(titleLower)
    );
    if (byTitle) {
      console.log(`[DETECT] ✓ Found game by window title: ${byTitle.name} (appId: ${byTitle.appid})`);
      const steamAch = await fetchAchievements(apiKey, steamId, byTitle.appid);
      const gseAch = readGSESaves(byTitle.appid);
      const achievements = mergeAchievements(gseAch, steamAch) || gseAch;
      return { name: byTitle.name, appId: byTitle.appid, achievements };
    }
  }

  console.log('[DETECT] ✗ No game detected');
  return null;
}

module.exports = { detectGame };
