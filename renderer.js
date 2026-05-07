'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  configMode:   false,
  startTime:    Date.now(),
  widgets:      ['stats-widget', 'clock-widget', 'session-widget', 'game-widget', 'discord-widget'],
  toastTimer:   null,
  achFilter:    'all',
  activeTab:    'progress',
  currentGame:  null,
  discordConnected: false,
  discordCurrentChannel: null,
  discordChats: { dms: [], channels: [] },
};

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const dom = {
  root: $('root'),
  toast: $('toast'),
  settingsBtn: $('settings-btn'),
  settingsModal: $('settings-modal'),
  settingsModalClose: $('settings-modal-close'),
  cpuValue: $('cpu-value'),
  cpuBar: $('cpu-bar'),
  memValue: $('mem-value'),
  memBar: $('mem-bar'),
  memText: $('mem-text'),
  gpuName: $('gpu-name'),
  gpuUsage: $('gpu-usage'),
  gpuBar: $('gpu-bar'),
  gpuTemp: $('gpu-temp'),
  clockTime: $('clock-time'),
  clockDate: $('clock-date'),
  sessionTime: $('session-time'),
  gameWidget: $('game-widget'),
  gameTabs: $('game-tabs'),
  gameNoAchievements: $('game-no-ach'),
  gameName: $('game-name'),
  achievementCount: $('ach-count'),
  achievementBar: $('ach-bar'),
  achievementList: $('ach-list'),
  recentAchievements: $('ach-recent'),
  apiKeyInput: $('cfg-api-key'),
  steamIdInput: $('cfg-steam-id'),
  monitorSelect: $('cfg-monitor'),
  resolutionSelect: $('cfg-resolution'),
  configStatus: $('cfg-status'),
  saveConfigButton: $('cfg-save-btn'),
  autoResolutionButton: $('cfg-auto-resolution-btn'),
  discordTokenInput: $('settings-discord-token'),
  discordConnectButton: $('settings-discord-connect-btn'),
  discordChannelSelect: $('discord-channel-select'),
  discordMessages: $('discord-messages'),
  discordMessageInput: $('discord-message-input'),
  discordSendButton: $('discord-send-btn'),
  discordRefreshButton: $('discord-refresh-btn')
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, variant = '') {
  dom.toast.textContent = msg;
  dom.toast.className = 'visible' + (variant ? ' ' + variant : '');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => dom.toast.classList.remove('visible'), 2800);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(name) {
  state.activeTab = name;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('hidden', c.id !== 'tab-' + name);
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Settings Modal ────────────────────────────────────────────────
function openSettingsModal() {
  dom.settingsModal.classList.remove('hidden');
  dom.settingsModal.classList.add('visible');
  dom.settingsBtn.classList.add('hidden');
}

function closeSettingsModal() {
  dom.settingsModal.classList.remove('visible');
  dom.settingsModal.classList.add('hidden');
  dom.settingsBtn.classList.remove('hidden');
}

dom.settingsBtn.addEventListener('click', openSettingsModal);
dom.settingsModalClose.addEventListener('click', closeSettingsModal);

// Close modal when clicking outside
dom.settingsModal.addEventListener('click', (e) => {
  if (e.target.id === 'settings-modal') closeSettingsModal();
});

// ── Achievement filter ────────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.achFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    if (state.currentGame) renderAchList(state.currentGame.achievements);
  });
});

// ── Widget positioning ────────────────────────────────────────────────────────
function loadPositions() {
  state.widgets.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const saved = localStorage.getItem('pos:' + id);
      if (saved) {
        const { top, left } = JSON.parse(saved);
        el.style.top = top; el.style.left = left; el.style.transform = 'none';
      }
    } catch (_) {}
    setupDrag(el);
  });
}

function savePosition(el) {
  localStorage.setItem('pos:' + el.id, JSON.stringify({ top: el.style.top, left: el.style.left }));
}

function setupDrag(el) {
  let dragging = false, ox = 0, oy = 0;
  el.addEventListener('mousedown', e => {
    if (!state.configMode) return;
    e.preventDefault();
    dragging = true;
    if (el.style.transform && el.style.transform !== 'none') {
      const r = el.getBoundingClientRect();
      el.style.transform = 'none';
      el.style.left = r.left + 'px'; el.style.top = r.top + 'px';
    }
    const r = el.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    el.style.transition = 'none';
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    el.style.left = Math.max(0, e.clientX - ox) + 'px';
    el.style.top  = Math.max(0, e.clientY - oy) + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false; el.style.transition = ''; savePosition(el);
  });
}

// ── System stats ──────────────────────────────────────────────────────────────
function barClass(pct) { return pct >= 90 ? 'crit' : pct >= 70 ? 'warn' : ''; }

function formatGpuLabel(gpu) {
  const gpuModel = gpu.model || gpu.name;
  return gpu.vendor && gpu.vendor !== 'Unknown' && !gpuModel.toLowerCase().startsWith(gpu.vendor.toLowerCase())
    ? `${gpu.vendor} ${gpuModel}`
    : gpuModel;
}

function updateBar(el, pct) {
  el.style.width = pct + '%';
  el.className = 'bar-fill ' + barClass(pct);
}

async function updateStats() {
  try {
    const s = await window.electron.getSystemStats();
    dom.cpuValue.textContent = s.cpu + '%';
    updateBar(dom.cpuBar, s.cpu);
    dom.memValue.textContent = s.mem + '%';
    updateBar(dom.memBar, s.mem);
    dom.memText.textContent = s.memText;

    // Update GPU stats if available
    if (s.gpu) {
      const gpuModel = s.gpu.model || s.gpu.name;
      const gpuLabel = s.gpu.vendor && s.gpu.vendor !== 'Unknown' && !gpuModel.toLowerCase().startsWith(s.gpu.vendor.toLowerCase())
        ? `${s.gpu.vendor} ${gpuModel}`
        : gpuModel;
      dom.gpuName.textContent = formatGpuLabel(s.gpu);
      dom.gpuUsage.textContent = s.gpu.usage + '%';
      updateBar(dom.gpuBar, s.gpu.usage);
      dom.gpuTemp.textContent = Number.isFinite(s.gpu.temp) ? `${s.gpu.temp}°C` : 'N/A';
    }
  } catch (e) { console.error('Stats error:', e); }
}

// ── Clock & session ───────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');

function updateClock() {
  const now = new Date();
  dom.clockTime.textContent = now.toLocaleTimeString([], { hour12: false });
  dom.clockDate.textContent = now.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric'
  });
  const d = Date.now() - state.startTime;
  dom.sessionTime.textContent =
    `${pad(Math.floor(d/3600000))}:${pad(Math.floor((d%3600000)/60000))}:${pad(Math.floor((d%60000)/1000))}`;
}

// ── Game widget rendering ─────────────────────────────────────────────────────
function renderAchList(ach) {
  if (!ach) {
    console.log('[RENDER] No achievements data');
    return;
  }
  console.log('[RENDER] All achievements:', ach.list.length, 'Filter:', state.achFilter);
  const list = ach.list.filter(a => {
    if (state.achFilter === 'locked')   return !a.achieved;
    if (state.achFilter === 'unlocked') return  a.achieved;
    return true;
  });
  console.log('[RENDER] Filtered list:', list.length, 'items');
  console.log('[RENDER] Sample items:', list.slice(0, 2));
  const container = dom.achievementList;
  container.innerHTML = list.map(a => `
    <div class="ach-item ${a.achieved ? 'unlocked' : 'locked'}">
      ${a.icon ? `<img src="${a.achieved ? a.icon : a.iconGray || a.icon}" alt="">` : ''}
      <div class="ach-item-text">
        <div class="ach-item-name">${a.name}</div>
        ${a.description ? `<div class="ach-item-desc">${a.description}</div>` : ''}
      </div>
      <span class="ach-check">${a.achieved ? '✓' : ''}</span>
    </div>
  `).join('');
  console.log('[RENDER] ✓ Rendered', list.length, 'achievements');
}

function renderRecentAchievements(ach) {
  const container = dom.recentAchievements;
  if (!ach || !ach.list.length) { container.innerHTML = ''; return; }

  const recent = ach.list
    .filter(a => a.achieved && a.unlockTime > 0)
    .sort((a, b) => b.unlockTime - a.unlockTime)
    .slice(0, 3);

  if (!recent.length) { container.innerHTML = ''; return; }
  container.innerHTML = `<div class="ach-recent-label">Recently unlocked</div>` +
    recent.map(a => `
      <div class="ach-recent-item">
        ${a.icon ? `<img src="${a.icon}" alt="">` : ''}
        <div>
          <div class="ach-item-name">${a.name}</div>
          ${a.description ? `<div class="ach-item-desc">${a.description}</div>` : ''}
        </div>
      </div>
    `).join('');
}

function updateGameWidget(data) {
  const widget  = dom.gameWidget;
  const tabs    = dom.gameTabs;
  const noAch   = dom.gameNoAchievements;
  const prevName = state.currentGame ? state.currentGame.name : null;

  console.log('[WIDGET] updateGameWidget called with:', data);

  if (!data) {
    console.log('[WIDGET] No game data, hiding widget');
    widget.classList.add('hidden');
    state.currentGame = null;
    return;
  }

  state.currentGame = data;
  widget.classList.remove('hidden');
  dom.gameName.textContent = data.name;

  if (prevName !== data.name) {
    showToast(`🎮 Now playing: ${data.name}`, 'game');
  }

  const ach = data.achievements;
  console.log('[WIDGET] Achievements data:', ach);
  
  if (!ach || !ach.total) {
    console.log('[WIDGET] No achievements for this game');
    tabs.classList.add('hidden');
    noAch.style.display = '';
    return;
  }

  noAch.style.display = 'none';
  tabs.classList.remove('hidden');

  // Progress tab
  dom.achievementCount.textContent = `${ach.achieved} / ${ach.total}`;
  const pct = Math.round((ach.achieved / ach.total) * 100);
  dom.achievementBar.style.width = pct + '%';
  console.log(`[WIDGET] Progress: ${ach.achieved}/${ach.total} (${pct}%)`);
  renderRecentAchievements(ach);

  // List tab
  console.log('[WIDGET] Rendering achievement list with filter:', state.achFilter);
  renderAchList(ach);
}

// ── Keybind recorder ──────────────────────────────────────────────────────────
// Converts a KeyboardEvent into an Electron accelerator string e.g. "Control+Shift+F5"
function eventToAccelerator(e) {
  const parts = [];
  if (e.ctrlKey)  parts.push('Control');
  if (e.altKey)   parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey)  parts.push('Super');

  const ignored = new Set(['Control','Alt','Shift','Meta','OS']);
  if (!ignored.has(e.key)) {
    // Normalise key name to Electron accelerator format
    let key = e.key;
    if (key === ' ')  key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    // Map F-keys and specials correctly (already correct from e.key)
    parts.push(key);
  }

  return parts.length > 1 ? parts.join('+') : null; // require at least one modifier
}

// Track pending keybind values (not saved yet)
const pendingKeybinds = {};

function initKeybindRecorders() {
  document.querySelectorAll('.keybind-recorder').forEach(el => {
    el.addEventListener('click', () => startRecording(el));
    el.addEventListener('keydown', e => {
      if (!el.classList.contains('recording')) return;
      e.preventDefault();
      e.stopPropagation();
      const accel = eventToAccelerator(e);
      if (!accel) return;

      // Check for conflict with sibling recorder
      const key = el.dataset.key;
      const conflict = [...document.querySelectorAll('.keybind-recorder')]
        .find(other => other !== el && (pendingKeybinds[other.dataset.key] || other.textContent) === accel);

      stopRecording(el);

      if (conflict) {
        el.textContent = accel;
        el.classList.add('conflict');
        setTimeout(() => el.classList.remove('conflict'), 1500);
        return;
      }

      el.textContent = accel;
      pendingKeybinds[key] = accel;
    });
    el.addEventListener('blur', () => stopRecording(el));
  });

  document.querySelectorAll('.keybind-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      target.textContent = '—';
      delete pendingKeybinds[target.dataset.key];
      target.classList.remove('conflict', 'recording');
    });
  });
}

function startRecording(el) {
  // Stop any other recorder
  document.querySelectorAll('.keybind-recorder.recording').forEach(r => stopRecording(r));
  el.classList.add('recording');
  el.textContent = 'Press keys…';
  el.focus();
}

function stopRecording(el) {
  el.classList.remove('recording');
}

function populateKeybindRecorders(kb) {
  const map = {
    toggleVisibility: 'kb-visibility',
    toggleConfig:     'kb-config',
  };
  for (const [key, elId] of Object.entries(map)) {
    const el = document.getElementById(elId);
    if (el && kb[key]) {
      el.textContent = kb[key];
      pendingKeybinds[key] = kb[key];
    }
  }
}

window.electron.onKeybindsUpdated(kb => populateKeybindRecorders(kb));


async function loadConfigIntoForm() {
  try {
    const cfg = await window.electron.getConfig();
    if (cfg.steamApiKey && cfg.steamApiKey !== 'YOUR_STEAM_API_KEY') {
      dom.apiKeyInput.value = cfg.steamApiKey;
    }
    if (cfg.steamId && cfg.steamId !== 'YOUR_STEAM_ID_64') {
      dom.steamIdInput.value = cfg.steamId;
    }
    
    // Load monitors & resolutions
    const monitors = await window.electron.getMonitors();
    const monitorSelect = dom.monitorSelect;
    const resolutionSelect = dom.resolutionSelect;
    let resolutions = await window.electron.getAvailableResolutions() || [];
    
    if (monitors && monitors.length > 0) {
      monitorSelect.innerHTML = monitors.map(m => 
        `<option value="${m.id}">${m.label} (${m.bounds.width}x${m.bounds.height})${m.isPrimary ? ' - Primary' : ''}</option>`
      ).join('');
      
      // Inject native resolutions into the options list
      monitors.forEach(m => {
        const nativeRes = `${m.bounds.width}x${m.bounds.height}`;
        if (!resolutions.find(r => r.value === nativeRes)) {
          resolutions.unshift({ label: `${m.bounds.width} x ${m.bounds.height} (Native)`, value: nativeRes });
        } else {
          const r = resolutions.find(r => r.value === nativeRes);
          if (!r.label.includes('(Native)')) r.label = `${r.label} (Native)`;
        }
      });
      
      if (cfg.monitorId) {
        monitorSelect.value = cfg.monitorId;
      } else {
        monitorSelect.value = monitors[0].id.toString();
      }
      
      // Auto-detect resolution when monitor changes
      monitorSelect.addEventListener('change', () => {
        const selectedMonitorId = monitorSelect.value;
        const selectedMonitor = monitors.find(m => m.id.toString() === selectedMonitorId);
        if (selectedMonitor) {
          const nativeResolution = `${selectedMonitor.bounds.width}x${selectedMonitor.bounds.height}`;
          resolutionSelect.value = nativeResolution;
        }
      });
    } else {
      monitorSelect.innerHTML = '<option value="">No monitors found</option>';
    }
    
    if (resolutions.length > 0) {
      resolutionSelect.innerHTML = resolutions.map(r => 
        `<option value="${r.value}">${r.label}</option>`
      ).join('');
      
      // Auto pick resolution on load
      const selectedMonitor = monitors ? monitors.find(m => m.id.toString() === monitorSelect.value) : null;
      const nativeResolution = selectedMonitor ? `${selectedMonitor.bounds.width}x${selectedMonitor.bounds.height}` : null;
      
      // Always auto-pick native resolution by default to ensure it maps perfectly
      if (nativeResolution) {
        resolutionSelect.value = nativeResolution;
      } else if (cfg.resolution && cfg.resolution !== 'auto') {
        resolutionSelect.value = cfg.resolution;
      }
    } else {
      resolutionSelect.innerHTML = '<option value="1920x1080">1920 x 1080</option>';
    }
  } catch (err) {
    console.error('loadConfigIntoForm error:', err);
    showToast('Error loading settings', 'warn');
  }
}

dom.saveConfigButton.addEventListener('click', async () => {
  try {
    const key = dom.apiKeyInput.value.trim();
    const id = dom.steamIdInput.value.trim();
    const status = dom.configStatus;
    if (!key || !id) { status.textContent = 'Steam API key and ID are required.'; return; }

    const oldCfg = await window.electron.getConfig();
    const cfg = { ...oldCfg };
    cfg.steamApiKey = key;
    cfg.steamId     = id;
    cfg.monitorId = dom.monitorSelect.value || undefined;
    cfg.resolution = dom.resolutionSelect.value || '1920x1080';
    cfg.keybinds    = Object.assign({}, cfg.keybinds || {}, pendingKeybinds);

    const ok = await window.electron.saveConfig(cfg);
    if (ok) {
      if (oldCfg.resolution !== cfg.resolution || oldCfg.monitorId !== cfg.monitorId) {
        status.textContent = 'Saved! Resizing to ' + cfg.resolution + '...';
      } else {
        status.textContent = 'Saved!';
      }
    } else {
      status.textContent = 'Save failed.';
    }
    setTimeout(() => { status.textContent = ''; }, 3000);
  } catch (err) {
    console.error('Save config error:', err);
    dom.configStatus.textContent = 'Error saving config';
  }
});

dom.discordConnectButton.addEventListener('click', discordConnect);

// ── Auto-detect resolution button ─────────────────────────────────────────────
dom.autoResolutionButton.addEventListener('click', async () => {
  try {
    const monitorSelect = dom.monitorSelect;
    const selectedMonitorId = monitorSelect.value;
    
    if (!selectedMonitorId) {
      showToast('Select a monitor first', 'warn');
      return;
    }
    
    // Get all monitors
    const monitors = await window.electron.getMonitors();
    const selectedMonitor = monitors.find(m => m.id.toString() === selectedMonitorId);
    
    if (!selectedMonitor) {
      showToast('Monitor not found', 'warn');
      return;
    }
    
    // Set resolution to monitor's native resolution
    const nativeResolution = `${selectedMonitor.bounds.width}x${selectedMonitor.bounds.height}`;
    const resolutionSelect = dom.resolutionSelect;
    
    // If native resolution exists in dropdown, select it
    let found = false;
    for (const option of resolutionSelect.options) {
      if (option.value === nativeResolution) {
        resolutionSelect.value = nativeResolution;
        found = true;
        break;
      }
    }
    
    if (found) {
      showToast(`Auto-detected: ${selectedMonitor.bounds.width}x${selectedMonitor.bounds.height}`, 'info');
    } else {
      // If native resolution not in dropdown, just show it as info
      showToast(`Monitor native: ${selectedMonitor.bounds.width}x${selectedMonitor.bounds.height}\nClosest available selected`, 'info');
    }
  } catch (err) {
    console.error('Auto-detect error:', err);
    showToast('Auto-detect failed', 'warn');
  }
});

window.electron.onConfigMode(enabled => {
  state.configMode = enabled;
  dom.root.classList.toggle('config-mode', enabled);
  showToast(enabled
    ? 'Config mode — drag widgets  •  Ctrl+Shift+O to exit'
    : 'Layout saved', enabled ? 'cfg' : '');
});

window.electron.onVisibilityChanged(visible => {
  if (visible) showToast('Overlay visible  •  Ctrl+Shift+H to hide');
});

window.electron.onHotkeysRegistered(({ visibility, config }) => {
  if (!visibility || !config)
    showToast('⚠ Hotkey registration failed — try running as admin');
});

window.electron.onGameDetected(data => updateGameWidget(data));

// ── Per-pixel mouse forwarding ────────────────────────────────────────────────
// Widgets have pointer-events:auto; background is transparent.
// We track whether the cursor is over any widget and tell main process
// to stop forwarding (so clicks hit the widget) or resume forwarding
// (so clicks pass through to the game).
let _overWidget = false;

document.addEventListener('mousemove', e => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overWidget = !!el && el.id !== 'root' && el.tagName !== 'BODY' && el.tagName !== 'HTML';
  if (overWidget !== _overWidget) {
    _overWidget = overWidget;
    window.electron.setIgnoreMouse(!overWidget);
  }
});

// When mouse leaves the window entirely, resume forwarding
document.addEventListener('mouseleave', () => {
  _overWidget = false;
  window.electron.setIgnoreMouse(true);
});


// ── Discord Widget ────────────────────────────────────────────────────────────
async function discordConnect() {
  try {
    const token = dom.discordTokenInput.value.trim();
    
    if (!token) {
      showToast('Discord token required', 'warn');
      return;
    }
    
    showToast('Connecting to Discord…', 'info');
    const success = await window.electron.discordInit(token);
    
    if (success) {
      showToast('Discord connected!', 'success');
      state.discordConnected = true;
      
      // Save token to config
      const cfg = await window.electron.getConfig();
      cfg.discordToken = token;
      await window.electron.saveConfig(cfg);
      
      discordLoadChats();
    } else {
      showToast('Discord connection failed - check token', 'warn');
    }
  } catch (err) {
    console.error('Discord connect error:', err);
    showToast('Error connecting to Discord', 'warn');
  }
}

async function discordLoadChats() {
  const chats = await window.electron.discordGetChats();
  state.discordChats = chats;
  
  const select = dom.discordChannelSelect;
  select.innerHTML = '<option value="">Select a chat…</option>';
  
  if (chats.dms.length > 0) {
    chats.dms.forEach(dm => {
      const opt = document.createElement('option');
      opt.value = dm.id;
      opt.textContent = `@${dm.name}`;
      select.appendChild(opt);
    });
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No DMs yet';
    select.appendChild(opt);
  }
  
  select.removeEventListener('change', discordSelectChannel);
  select.addEventListener('change', discordSelectChannel);
}

async function discordSelectChannel(e) {
  const channelId = e.target.value;
  if (!channelId) return;
  
  state.discordCurrentChannel = channelId;
  await discordLoadMessages();
  
  // Start auto-refresh when a channel is selected
  startDiscordAutoRefresh();
}

async function discordLoadMessages() {
  if (!state.discordCurrentChannel) return;
  
  const messages = await window.electron.discordGetMessages(state.discordCurrentChannel, 30);
  const container = dom.discordMessages;
  container.innerHTML = messages.map(m => `
    <div class="discord-message ${m.isOwn ? 'own' : ''}">
      <div class="discord-message-author">${m.author}</div>
      <div>${escapeHtml(m.content)}</div>
      <div class="discord-message-time">${new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
    </div>
  `).join('');
  
  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function discordSendMessage() {
  if (!state.discordCurrentChannel) return;
  
  const input = dom.discordMessageInput;
  const content = input.value.trim();
  
  if (!content) return;
  
  const success = await window.electron.discordSendMessage(state.discordCurrentChannel, content);
  
  if (success) {
    input.value = '';
    setTimeout(() => discordLoadMessages(), 500);
  } else {
    showToast('Failed to send message', 'warn');
  }
}

// Discord event listeners
let discordRefreshInterval = null;

function setupDiscordListeners() {
  const sendBtn = dom.discordSendButton;
  const messageInput = dom.discordMessageInput;
  const refreshBtn = dom.discordRefreshButton;

  if (sendBtn) sendBtn.addEventListener('click', () => {
    console.log('Send button clicked');
    discordSendMessage();
  });
  if (messageInput) messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      discordSendMessage();
    }
  });
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    if (state.discordCurrentChannel) discordLoadMessages();
  });
}

// Auto-refresh Discord messages every 3 seconds when a channel is selected
function startDiscordAutoRefresh() {
  if (discordRefreshInterval) clearInterval(discordRefreshInterval);
  discordRefreshInterval = setInterval(() => {
    if (state.discordCurrentChannel) {
      discordLoadMessages();
    }
  }, 3000);
}

// Stop auto-refresh
function stopDiscordAutoRefresh() {
  if (discordRefreshInterval) {
    clearInterval(discordRefreshInterval);
    discordRefreshInterval = null;
  }
}

// Load Discord token from config if available and auto-connect
async function discordInitFromConfig() {
  try {
    const cfg = await window.electron.getConfig();
    if (cfg.discordToken && !state.discordConnected) {
      const tokenInput = dom.discordTokenInput;
      if (tokenInput) {
        tokenInput.value = cfg.discordToken;
      }
      console.log('Auto-connecting to Discord...');
      await discordConnect();
    }
  } catch (err) {
    console.error('Discord auto-init error:', err);
  }
}

function initApp() {
  loadPositions();
  loadConfigIntoForm();
  initKeybindRecorders();
  setupDiscordListeners();

  setTimeout(() => {
    discordInitFromConfig().catch(err => {
      console.error('Discord init failed:', err);
    });
  }, 500);

  window.electron.getKeybinds().then(kb => populateKeybindRecorders(kb));
  updateClock();
  updateStats();
  setInterval(updateClock, 1000);
  setInterval(updateStats, 2000);
}

initApp();
