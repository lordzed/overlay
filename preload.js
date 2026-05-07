const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getSystemStats:       ()   => ipcRenderer.invoke('get-system-stats'),
  getConfig:            ()   => ipcRenderer.invoke('get-config'),
  saveConfig:           (c)  => ipcRenderer.invoke('save-config', c),
  getKeybinds:          ()   => ipcRenderer.invoke('get-keybinds'),
  getMonitors:          ()   => ipcRenderer.invoke('get-monitors'),
  getAvailableResolutions: () => ipcRenderer.invoke('get-available-resolutions'),
  onConfigMode:         (fn) => ipcRenderer.on('config-mode',        (_e, v) => fn(v)),
  onVisibilityChanged:  (fn) => ipcRenderer.on('visibility-changed', (_e, v) => fn(v)),
  onHotkeysRegistered:  (fn) => ipcRenderer.on('hotkeys-registered', (_e, v) => fn(v)),
  onGameDetected:       (fn) => ipcRenderer.on('game-detected',      (_e, v) => fn(v)),
  onKeybindsUpdated:    (fn) => ipcRenderer.on('keybinds-updated',   (_e, v) => fn(v)),
  setIgnoreMouse:       (v)  => ipcRenderer.send('set-ignore-mouse', v),
  discordInit:          (t)  => ipcRenderer.invoke('discord-init', t),
  discordGetChats:      ()   => ipcRenderer.invoke('discord-get-chats'),
  discordGetMessages:   (id, limit) => ipcRenderer.invoke('discord-get-messages', id, limit),
  discordSendMessage:   (id, msg) => ipcRenderer.invoke('discord-send-message', id, msg),
});
