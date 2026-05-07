# Overlay

A desktop overlay application built with Electron that displays system statistics, game information, and Discord integration in a customizable, always-on-top interface.

## Features

- **System Statistics** - Real-time CPU, RAM, and GPU monitoring (usage, temperature)
- **Game Detection** - Automatic game detection via Steam API with achievement tracking
- **Discord Integration** - Discord widget with chat functionality
- **Session Timer** - Track your current session time
- **Clock Widget** - Always-visible clock display
- **Drag-and-Drop Widgets** - Position widgets anywhere on screen with persistent positions
- **Configurable** - Customize monitor, resolution, keybinds, and more
- **Keyboard Shortcuts** - Toggle overlay and config mode with global hotkeys

## Prerequisites

- Node.js (v16 or higher)
- npm
- Windows OS (primary target)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/lordzed/overlay.git
cd overlay
```

2. Install dependencies:
```bash
npm install
```

3. Configure your settings in `config.json`:
   - Add your Steam API key
   - Add your Steam ID
   - Configure Discord settings (if using Discord integration)
   - Set your preferred monitor and resolution

## Usage

### Starting the Application

**Simple start (no logging):**
```bash
run.bat
```

**Start with debugging:**
```bash
run-debug.bat
```
or
```bash
run-debug.ps1
```

**Start via npm:**
```bash
npm start
```

### Keyboard Shortcuts

- `Ctrl+Shift+H` - Toggle overlay visibility
- `Ctrl+Shift+O` - Toggle config mode (enables widget dragging)
- Custom keybinds can be configured in the settings modal

### Configuration

1. Enter config mode with `Ctrl+Shift+O`
2. Click the settings button to open the configuration modal
3. Configure:
   - Steam API key and Steam ID
   - Discord bot token and channel settings
   - Monitor selection
   - Resolution settings
   - Custom keybinds

### Widgets

The overlay includes five main widgets:
- **System Stats** - CPU, RAM, GPU usage and temperature
- **Clock** - Current time display
- **Session** - Current session duration
- **Game** - Detected game with achievement progress
- **Discord** - Discord chat integration

All widgets can be repositioned by dragging in config mode. Positions are saved automatically.

## Project Structure

```
overlay/
├── main.js              # Main Electron process
├── renderer.js          # Renderer process (UI logic)
├── preload.js           # Preload script (IPC bridge)
├── index.html           # UI structure
├── style.css            # Visual styling
├── config.js            # Configuration management
├── config.json          # User configuration
├── game-detector.js     # Steam API integration
├── discord-handler.js   # Discord API integration
├── system-stats.js      # System statistics gathering
├── gpu-stats.js         # GPU monitoring
├── window-manager.js    # Window management
├── ipc-handlers.js      # IPC communication handlers
├── logger.js            # Logging utilities
├── diagnose.js          # Diagnostic tools
└── test-*.js            # Testing utilities
```

## Development

### Making Changes

- **Renderer/UI changes** (`renderer.js`, `index.html`, `style.css`) - Changes reflect automatically
- **Main process changes** (`main.js`, `config.js`, etc.) - Requires full application restart

### Debugging

- Check `app-error.log` in the root directory for runtime errors
- Use `run-debug.bat` for detailed console output
- Monitor Discord connection issues via console output
- Check Steam API connectivity through game detection logs

## Configuration File

The `config.json` file stores user settings:
- Steam API credentials
- Discord bot configuration
- Monitor and resolution preferences
- Custom keybinds
- Window settings

## Dependencies

- **Electron** - Desktop application framework
- **discord.js** - Discord API integration
- **ws** - WebSocket support

## Troubleshooting

**Overlay not visible:**
- Check if overlay is toggled on (`Ctrl+Shift+H`)
- Verify monitor selection in config
- Check `app-error.log` for errors

**Game detection not working:**
- Verify Steam API key is valid
- Confirm Steam ID is correct
- Check internet connectivity

**Discord integration issues:**
- Verify bot token is valid
- Check bot permissions in Discord server
- Ensure channel ID is correct

## License

This project is open source. See LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
