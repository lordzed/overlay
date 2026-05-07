const path = require('path');

function parseResolution(resolution, fallbackWidth, fallbackHeight) {
  const parts = String(resolution || `${fallbackWidth}x${fallbackHeight}`).split('x');
  if (parts.length !== 2) {
    return { width: fallbackWidth, height: fallbackHeight };
  }

  return {
    width: parseInt(parts[0], 10) || fallbackWidth,
    height: parseInt(parts[1], 10) || fallbackHeight
  };
}

function createWindowManager({ BrowserWindow, screen, baseDir, loadConfig, logError, onClosed }) {
  function getMonitorInfo() {
    const monitors = screen.getAllDisplays();
    if (!monitors || monitors.length === 0) {
      throw new Error('No monitors found');
    }

    return monitors;
  }

  function createWindow() {
    try {
      console.log('createWindow() starting...');
      const cfg = loadConfig();
      const monitors = getMonitorInfo();
      const targetMonitor = monitors.find((monitor) => monitor.id === Number(cfg.monitorId)) || monitors[0];
      const parsed = parseResolution(cfg.resolution, targetMonitor.bounds.width, targetMonitor.bounds.height);

      const width = Math.min(parsed.width, targetMonitor.bounds.width);
      const height = Math.min(parsed.height, targetMonitor.bounds.height);
      const windowX = targetMonitor.bounds.x + Math.max(0, (targetMonitor.bounds.width - width) / 2);
      const windowY = targetMonitor.bounds.y + Math.max(0, (targetMonitor.bounds.height - height) / 2);

      const win = new BrowserWindow({
        width,
        height,
        x: Math.round(windowX),
        y: Math.round(windowY),
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: false,
        show: false,
        webPreferences: {
          preload: path.join(baseDir, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false
        }
      });

      win.setIgnoreMouseEvents(true, { forward: true });
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.loadFile(path.join(baseDir, 'index.html'));
      win.on('closed', () => onClosed?.());

      console.log('createWindow() completed successfully');
      return win;
    } catch (err) {
      console.error('createWindow error:', err);
      logError('CREATE_WINDOW', err);
      return null;
    }
  }

  function recreateWindowWithUpdatedSettings({ getWindow, setWindow, wasVisible }) {
    const currentWindow = getWindow();
    if (!currentWindow || currentWindow.isDestroyed()) {
      return;
    }

    try {
      console.log('Destroying old window...');
      currentWindow.destroy();
      setTimeout(() => {
        console.log('Creating new window with updated settings...');
        const nextWindow = createWindow();
        setWindow(nextWindow);

        if (nextWindow && !nextWindow.isDestroyed()) {
          nextWindow.webContents.once('did-finish-load', () => {
            if (wasVisible && !nextWindow.isDestroyed()) {
              nextWindow.show();
            }
          });
        }
      }, 100);
    } catch (err) {
      console.error('Error recreating window:', err);
      logError('WINDOW_RECREATE', err);
      const nextWindow = createWindow();
      setWindow(nextWindow);
    }
  }

  function getMonitors() {
    try {
      return getMonitorInfo().map((display) => ({
        id: display.id,
        label: display.label || `Display ${display.id}`,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor,
        isPrimary: display.bounds.x === 0 && display.bounds.y === 0
      }));
    } catch (err) {
      console.error('get-monitors error:', err);
      return [];
    }
  }

  return {
    createWindow,
    recreateWindowWithUpdatedSettings,
    getMonitors
  };
}

module.exports = {
  createWindowManager
};
