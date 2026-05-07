function registerIpcHandlers({
  ipcMain,
  getSystemStats,
  loadConfig,
  getMonitors,
  getAvailableResolutions,
  initDiscord,
  getChats,
  getMessages,
  sendMessage,
  isDiscordReady,
  markDiscordReady,
  saveConfig,
  getKeybinds,
  onSetIgnoreMouse
}) {
  ipcMain.handle('get-system-stats', () => getSystemStats());
  ipcMain.handle('get-config', () => loadConfig());
  ipcMain.handle('get-monitors', () => getMonitors());
  ipcMain.handle('get-available-resolutions', () => getAvailableResolutions());
  ipcMain.handle('get-keybinds', () => getKeybinds());
  ipcMain.handle('save-config', (_event, cfg) => saveConfig(cfg));

  ipcMain.handle('discord-init', async (_event, token) => {
    const success = await initDiscord(token);
    if (success) {
      markDiscordReady(true);
    }
    return success;
  });

  ipcMain.handle('discord-get-chats', async () => {
    if (!isDiscordReady()) {
      return { dms: [], channels: [] };
    }
    return getChats();
  });

  ipcMain.handle('discord-get-messages', async (_event, channelId, limit = 20) => {
    if (!isDiscordReady()) {
      return [];
    }
    return getMessages(channelId, limit);
  });

  ipcMain.handle('discord-send-message', async (_event, channelId, content) => {
    if (!isDiscordReady()) {
      return false;
    }
    return sendMessage(channelId, content);
  });

  ipcMain.on('set-ignore-mouse', (_event, ignore) => onSetIgnoreMouse(ignore));
}

module.exports = {
  registerIpcHandlers
};
