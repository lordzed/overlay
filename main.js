const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');

const { detectGame } = require('./game-detector');
const { initDiscord, getChats, getMessages, sendMessage, disconnect: disconnectDiscord } = require('./discord-handler');
const configStore = require('./config');
const { logError } = require('./logger');
const { createGpuStatsService } = require('./gpu-stats');
const { createSystemStatsService } = require('./system-stats');
const { createWindowManager } = require('./window-manager');
const { registerIpcHandlers } = require('./ipc-handlers');

const state = {
  win: null,
  isVisible: false,
  isConfigMode: false,
  gameInterval: null,
  discordReady: false,
  lastGameName: null
};

const DEFAULT_KEYBINDS = {
  toggleVisibility: 'Control+Shift+H',
  toggleConfig: 'Control+Shift+O'
};

process.on('uncaughtException', (err) => {
  logError('UNCAUGHT EXCEPTION', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logError('UNHANDLED REJECTION', new Error(String(reason)));
});

const gpuStatsService = createGpuStatsService({ logError });
const systemStatsService = createSystemStatsService({
  getGPUStats: () => gpuStatsService.getGPUStats()
});
const windowManager = createWindowManager({
  BrowserWindow,
  screen,
  baseDir: __dirname,
  loadConfig: () => configStore.loadConfig(),
  logError,
  onClosed: () => {
    state.win = null;
  }
});

function getWindow() {
  return state.win;
}

function setWindow(win) {
  state.win = win;
}

function setInteractive(enable) {
  const win = getWindow();
  if (!win) return;

  if (enable) {
    win.setFocusable(true);
    win.setIgnoreMouseEvents(false);
    win.focus();
    return;
  }

  win.setFocusable(true);
  win.setIgnoreMouseEvents(true, { forward: true });
}

function getKeybinds() {
  const cfg = configStore.loadConfig();
  return { ...DEFAULT_KEYBINDS, ...(cfg.keybinds || {}) };
}

function registerKeybinds() {
  globalShortcut.unregisterAll();
  const keybinds = getKeybinds();
  const results = {};

  results.visibility = globalShortcut.register(keybinds.toggleVisibility, () => {
    const win = getWindow();
    if (!win) return;

    state.isVisible = !state.isVisible;
    if (state.isVisible) {
      win.show();
      setInteractive(state.isConfigMode);
    } else {
      if (state.isConfigMode) {
        state.isConfigMode = false;
        win.webContents.send('config-mode', false);
      }
      win.hide();
      setInteractive(false);
    }

    win.webContents.send('visibility-changed', state.isVisible);
  });

  results.config = globalShortcut.register(keybinds.toggleConfig, () => {
    const win = getWindow();
    if (!win) return;

    if (!state.isVisible) {
      state.isVisible = true;
      win.show();
      win.webContents.send('visibility-changed', true);
    }

    state.isConfigMode = !state.isConfigMode;
    setInteractive(state.isConfigMode);
    win.webContents.send('config-mode', state.isConfigMode);
  });

  if (getWindow()?.webContents) {
    getWindow().webContents.send('hotkeys-registered', results);
    getWindow().webContents.send('keybinds-updated', keybinds);
  }

  return results;
}

async function runGameDetect() {
  const win = getWindow();
  if (!win) return;

  const cfg = configStore.loadConfig();
  try {
    const result = await detectGame(cfg.steamApiKey, cfg.steamId);
    const name = result ? result.name : null;

    if (name !== state.lastGameName) {
      state.lastGameName = name;
      win.webContents.send('game-detected', result);
    } else if (result) {
      win.webContents.send('game-detected', result);
    }
  } catch (err) {
    console.error('Game detect error:', err);
  }
}

function restartGameDetection() {
  if (state.gameInterval) {
    clearInterval(state.gameInterval);
  }
  runGameDetect();
  state.gameInterval = setInterval(runGameDetect, 15000);
}

function saveConfig(cfg) {
  try {
    const oldCfg = configStore.loadConfig();
    const monitorChanged = oldCfg.monitorId !== cfg.monitorId;
    const resolutionChanged = oldCfg.resolution !== cfg.resolution;
    const windowNeedsRecreation = monitorChanged || resolutionChanged;

    configStore.saveConfigFile(cfg);
    registerKeybinds();
    restartGameDetection();

    if (windowNeedsRecreation) {
      windowManager.recreateWindowWithUpdatedSettings({
        getWindow,
        setWindow,
        wasVisible: state.isVisible
      });
    }

    return true;
  } catch (err) {
    console.error('save-config error:', err);
    logError('SAVE_CONFIG', err);
    return false;
  }
}

function createWindow() {
  const win = windowManager.createWindow();
  setWindow(win);
  return win;
}

registerIpcHandlers({
  ipcMain,
  getSystemStats: () => systemStatsService.getSystemStats(),
  loadConfig: () => configStore.loadConfig(),
  getMonitors: () => windowManager.getMonitors(),
  getAvailableResolutions: () => configStore.DEFAULT_RESOLUTIONS,
  initDiscord,
  getChats,
  getMessages,
  sendMessage,
  isDiscordReady: () => state.discordReady,
  markDiscordReady: (ready) => {
    state.discordReady = ready;
  },
  saveConfig,
  getKeybinds,
  onSetIgnoreMouse: (ignore) => {
    const win = getWindow();
    if (!win || state.isConfigMode) return;

    if (ignore) {
      win.setIgnoreMouseEvents(true, { forward: true });
    } else {
      win.setIgnoreMouseEvents(false);
    }
  }
});

app.whenReady().then(() => {
  console.log('App ready, creating window...');
  const win = createWindow();

  if (!win?.webContents) {
    logError('STARTUP', 'Window creation failed - win is null or webContents unavailable');
    return;
  }

  win.webContents.once('did-finish-load', () => {
    const results = registerKeybinds();
    const activeWindow = getWindow();
    if (!activeWindow?.webContents) {
      return;
    }

    activeWindow.webContents.send('hotkeys-registered', results);
    activeWindow.webContents.send('keybinds-updated', getKeybinds());
    activeWindow.show();
    state.isVisible = true;
    restartGameDetection();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  logError('APP_READY', err);
  process.exit(1);
});

app.on('will-quit', () => {
  if (state.gameInterval) {
    clearInterval(state.gameInterval);
  }
  globalShortcut.unregisterAll();
  disconnectDiscord();
});

app.on('error', (err) => {
  logError('APP_ERROR', err);
  process.exit(1);
});
