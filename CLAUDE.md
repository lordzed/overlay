# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Start the application:**
```bash
npm start
```

**Simple start (no logging):**
```bash
run.bat
```

**Run with debugging:**
```bash
# Windows batch file
run-debug.bat

# PowerShell script  
run-debug.ps1
```

**Development workflow:**
1. Edit files in the overlay directory
2. Save changes
3. The Electron app will automatically reload (main process changes require manual restart)
4. Check app-error.log for any runtime errors

**Common debugging:**
- View logs: `app-error.log` in the root directory
- Monitor Discord connection issues via console output
- Check Steam API connectivity through game detection logs

## Code Architecture

**Main Process (main.js):**
- Electron app lifecycle management
- Window creation and positioning logic
- System statistics gathering (CPU/RAM via Node.js os module)
- GPU monitoring (name, usage, temperature via WMI and nvidia-smi)
- Configuration loading/saving
- Game detection polling (every 15s) using Steam API
- Discord integration (initialization, messaging, channel management)
- Global keyboard shortcut registration
- IPC handlers for renderer communication

**Renderer Process (renderer.js):**
- UI state management and widget system
- DOM manipulation for all widgets (stats, clock, session, game, Discord)
- Drag-and-drop widget positioning with localStorage persistence
- Real-time updates for system stats, clock, and session timer
- Game widget rendering with achievement progress and lists
- Discord widget with chat loading, sending, and auto-refresh
- Settings modal for configuration (Steam API, Discord, monitors, keybinds)
- Keybind recorder for customizing keyboard shortcuts
- Toast notification system
- Per-pixel mouse forwarding for game interaction

**UI Structure (index.html):**
- Five main widgets: System Stats, Clock, Session, Game, Discord
- Settings modal with form inputs and controls
- Toast container for transient messages
- All styling via style.css

**Preload Script (preload.js):**
- Exposes Electron IPC methods to renderer via contextBridge
- Security boundary between main and renderer processes

## Key Files to Modify

**Core functionality:**
- `main.js` - Main process logic, IPC handlers, window management
- `renderer.js` - Renderer logic, UI updates, event handlers
- `index.html` - UI structure and widget containers
- `style.css` - Visual styling for all components

**Feature-specific files:**
- `game-detector.js` - Steam API integration for game detection
- `discord-handler.js` - Discord API integration
- `diagnose.js` - Diagnostic utilities
- `config.json` - User configuration (Steam API key, Steam ID, monitor, resolution, keybinds)

**Testing/Verification:**
- No formal test suite exists; verification is manual through UI interaction
- Check `app-error.log` for runtime errors
- Verify functionality through direct observation of widgets

## Important Patterns

**Configuration System:**
- Configuration stored in `config.json` in the root directory
- Loaded via `loadConfig()` function in main.js
- Changes trigger selective window recreation (only when monitor/resolution change)
- Keybinds stored within config object

**Widget System:**
- All widgets follow similar structure: header + body
- Position persistence via localStorage with keys like `pos:widget-id`
- Dragging only enabled in config mode (toggle via Ctrl+Shift+O)
- Visibility toggles via keyboard shortcuts (Ctrl+Shift+H for overlay, Ctrl+Shift+O for config)

**Communication Flow:**
- Renderer → Main: Through `window.electron` IPC methods (exposed in preload.js)
- Main → Renderer: Through `win.webContents.send()` events
- Events include: visibility-changed, config-mode, hotkeys-registered, keybinds-updated, game-detected

**Error Handling:**
- Uncaught exceptions and unhandled rejections logged to app-error.log
- Individual try/catch blocks around IPC handlers and async operations
- Graceful degradation when services unavailable (Discord, Steam API)

## Getting Started

To make changes:
1. Identify which process owns the functionality (main vs renderer)
2. Locate the relevant file(s) listed above
3. Make changes and save
4. For main.js changes: fully restart the application
5. For renderer.js/index.html/style.css changes: changes should reflect automatically
6. Verify behavior and check for errors in app-error.log or console

## Common Tasks

**Adding a new widget:**
1. Add widget container to index.html
2. Add widget ID to state.widgets array in renderer.js
3. Create update function similar to updateStats() or updateClock()
4. Add drag setup in loadPositions()/setupDrag()
5. Add periodic update via setInterval if needed
6. Style in style.css

**Modifying keybinds:**
1. Edit DEFAULT_KEYBINDS object in main.js
2. Update corresponding recorder elements in index.html
3. Changes persist through config.saveConfig() IPC handler

**Changing update intervals:**
1. Locate setInterval calls in renderer.js (updateStats, updateClock)
2. Adjust timeout values as needed
3. Consider impact on performance/resource usage
