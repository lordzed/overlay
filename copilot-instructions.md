# Copilot Instructions for Overlay

This is a transparent in-game overlay built with Electron that displays system stats and Steam game achievements.

## Running and Building

**Start the app:**
```bash
npm start
```

This launches the Electron application in development mode. The overlay window will be transparent, frameless, and positioned above all applications including fullscreen games.

**Requirements:**
- Node.js 14+
- Electron 26.0.0
- Windows (uses Windows-specific APIs for process detection and window management)

## Architecture Overview

### Main Process (`main.js`)
- **Window Management**: Creates a transparent, always-on-top, non-interactive window (1920×1080) that stays above fullscreen DirectX/Vulkan games via the `screen-saver` Z-order level
- **IPC Handlers**: Exposes functions to renderer via context-isolated bridge
  - `get-system-stats`: CPU/memory metrics computed from `os` module
  - `get-config` / `save-config`: Manages persistent `config.json` with Steam API credentials
  - `get-keybinds`: Returns active keybinds (defaults + overrides from config)
- **Global Shortcuts**: Registers Ctrl+Shift+H (toggle visibility) and Ctrl+Shift+O (toggle config mode)
- **Game Detection Loop**: Polls every 15 seconds via `detectGame()` and broadcasts results to renderer
- **Mouse Forwarding**: Intelligently forwards mouse events to games when cursor is not over widgets (pixel-perfect hit detection in renderer)

### Preload Script (`preload.js`)
- Establishes context-isolated bridge between renderer and main process
- Exposes `window.electron` API with ipcRenderer invoke/on methods
- No direct Node.js access in renderer; all system calls go through this bridge

### Renderer (`renderer.js`)
- **Widget State**: Manages four draggable widgets (stats, clock, session, game) with localStorage persistence
- **Game Detection**: Listens for `game-detected` events and updates UI with achievements
- **Mouse Tracking**: Per-pixel detection of widget hover state; calls `setIgnoreMouse()` to toggle game interaction
- **Keybind Recorder**: UI for capturing keyboard shortcuts, validates no conflicts between keybinds
- **Tabs & Filtering**: Achievement list with filters (all/locked/unlocked), recent achievements display
- **Toast Notifications**: Status messages for overlay visibility, config mode, game detection
- **Config Panel**: Form to save Steam API key/ID and customize keybinds

### Game Detection (`game-detector.js`)
Three-stage matching strategy:
1. **Known Games**: Hardcoded EXE→appId mapping (e.g., `cs2.exe` → Counter-Strike 2)
2. **Owned Games**: Query Steam API for user's owned games, match by process name fuzzy matching
3. **Window Title**: Fallback match against foreground window title

Once a game is matched by appId, fetches achievements via Steam Web API (schema + player status), merges to get locked/unlocked state and unlock timestamps.

## Key Conventions

### Event Flow (IPC)
- **Renderer → Main**: `ipcRenderer.invoke()` for req/response, `ipcRenderer.send()` for fire-and-forget
- **Main → Renderer**: `webContents.send()` broadcasts to listening handlers (`onXxx` methods in renderer)
- All sensitive data (API keys, Steam IDs) stored in `config.json` on disk, never exposed to renderer directly

### Configuration
- `config.json` contains `steamApiKey`, `steamId`, `keybinds` object
- Keybinds use Electron accelerator format: `"Control+Shift+H"`, `"Alt+F4"`, etc.
- Missing config file defaults to empty credentials; users must configure via UI before detection works

### Widget Positioning
- Draggable widgets stored in `localStorage` as `pos:{id}` with `{top, left}` pixel values
- In config mode, widgets are fully draggable and mouse events captured
- Normal mode: widgets forward mouse events when cursor outside widget boundaries

### Steam API
- Requires valid Steam Web API key (https://steamcommunity.com/dev/apikey)
- Schema endpoint: `GetSchemaForGame` (all achievements with metadata)
- Player endpoint: `GetPlayerAchievements` (which achievements player unlocked + timestamps)
- Errors caught silently; returns `null` if API calls fail, UI hides widget

### Window Properties
- `transparent: true` + `frame: false` for overlay appearance
- `focusable: false` initially, toggled only in config mode
- `ignoreMouseEvents(true, { forward: true })` passes clicks through to game
- `setAlwaysOnTop(..., 'screen-saver')` uses special Z-order to appear above fullscreen games
- `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` for multi-monitor and fullscreen game visibility

### Styling
- `style.css` uses flexbox for layout
- Widgets styled with `position: absolute` for drag positioning
- `config-mode` class on root toggles visual feedback (borders, dragging cursor)
- Bars use `warn` (≥70%) and `crit` (≥90%) threshold classes for color coding

## Common Tasks

**Adding a new game to detection:**
1. Find the EXE name (e.g., `myGame.exe`) and Steam app ID
2. Add entry to `KNOWN_GAMES` array in `game-detector.js`: `{ exe: 'myGame.exe', appId: 123456, name: 'My Game' }`
3. Restart `npm start`

**Adding a new widget:**
1. Add `<div id="my-widget" class="widget" style="top:...;left:...;">` to `index.html`
2. Initialize in `renderer.js`: add `'my-widget'` to `state.widgets` array, call `setupDrag()` in `loadPositions()`
3. Implement update function to populate data

**Customizing keybinds:**
- Edit `DEFAULT_KEYBINDS` in `main.js` or users change via UI config panel
- Keybinds persisted in `config.json` and re-registered on save
- Use Electron accelerator format: modifier keys (Control, Alt, Shift, Super) + key name

**Adding IPC handlers:**
1. In `main.js`: `ipcMain.handle('my-handler', ...)` or `ipcMain.on(...)`
2. In `preload.js`: expose via `contextBridge.exposeInMainWorld('electron', { myHandler: ... })`
3. In `renderer.js`: call via `window.electron.myHandler()`

## Security Notes

- Context isolation enabled (`contextIsolation: true`) prevents renderer from accessing Node.js
- No `nodeIntegration` in renderer
- CSP restricts resource loading; allows Steam API and font CDNs only
- Steam API key stored in `config.json` (user-configured); not committed to repo
- Preload script is the only bridge to system APIs; keep it minimal
