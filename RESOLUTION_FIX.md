# Resolution Fix - Window Size Now Matches Selected Resolution

## What Was Fixed

The window size is now **properly dynamic** and matches the resolution you select in settings.

### Previous Behavior
- Window always created at 1920x1080 regardless of selection
- Resolution dropdown existed but didn't actually affect window size

### Current Behavior
- Window size **matches** the resolution you select in settings
- When you select 1280x720, window becomes 1280x720
- When you select 1440x900, window becomes 1440x900
- When you save, console shows parsing and sizing details

## How It Works

### 1. Resolution Selection
- Open settings (⚙ button)
- Select resolution from dropdown:
  - 1920 x 1080
  - 1440 x 900
  - 1280 x 720
  - 1600 x 1024
  - 1360 x 768
  - 1024 x 768

### 2. Auto-Detect (Optional)
- Click "Auto-Detect" to get your monitor's native resolution
- Falls back to closest available option if exact match not found

### 3. Save and Apply
- Click "Save & Apply"
- Status shows: "Saved! Resizing to 1280x720..." (or your selection)
- Window recreates with new dimensions
- Window repositions centered on selected monitor

## Verification in Console

When you save with a new resolution, look for:

```
Saving config... {
  oldResolution: '1920x1080',
  newResolution: '1280x720',
  oldMonitor: '2779098405',
  newMonitor: '2779098405',
  monitorChanged: false,
  resolutionChanged: true,
  windowNeedsRecreation: true
}
Config saved successfully
Monitor or resolution changed - recreating window...
```

Then in createWindow():

```
Resolution from config: 1280x720
Parsed resolution: { parsedWidth: 1280, parsedHeight: 720 }
Window size (after constraints): { width: 1280, height: 720, monitorBounds: {...} }
```

## Test Cases

### Test 1: Basic Resolution Change
1. Start app
2. Open Settings ⚙
3. Change resolution from 1920x1080 to 1280x720
4. Click "Save & Apply"
5. ✓ Window shrinks to 1280x720
6. ✓ Console shows "resolutionChanged: true"

### Test 2: Auto-Detect
1. Open Settings ⚙
2. Select your primary monitor
3. Click "Auto-Detect" button
4. Resolution dropdown updates to native resolution
5. Click "Save & Apply"
6. ✓ Window resizes to monitor's native resolution
7. ✓ Check console for "resolutionChanged: true"

### Test 3: Monitor Change
1. Open Settings ⚙
2. Change monitor selection
3. Resolution auto-updates (auto-detect feature)
4. Click "Save & Apply"
5. ✓ Window moves to new monitor and resizes
6. ✓ Console shows both "monitorChanged: true" and "resolutionChanged: true"

### Test 4: Other Settings Don't Trigger Resize
1. Open Settings ⚙
2. Change Discord Token, Steam API Key, or Steam ID (NOT monitor/resolution)
3. Click "Save & Apply"
4. ✓ Window stays open without resizing
5. ✓ Console shows "windowNeedsRecreation: false"
6. ✓ Settings are saved instantly

### Test 5: Persistent Configuration
1. Set resolution to 1280x720
2. Save and Apply
3. Close app
4. Start app again
5. ✓ Window reopens at 1280x720 (not 1920x1080)
6. ✓ Settings modal shows your selection
7. ✓ Check config.json shows: "resolution": "1280x720"

## Technical Details

### Window Size Calculation (main.js, lines 67-85)

```javascript
// Get resolution from config, fallback to 1920x1080
const resolutionStr = cfg.resolution || '1920x1080';
console.log('Resolution from config:', resolutionStr);
const parts = resolutionStr.split('x');

// Parse width and height
let width = parseInt(parts[0]) || 1920;
let height = parseInt(parts[1]) || 1080;
console.log('Parsed resolution:', { parsedWidth: width, parsedHeight: height });

// Apply constraints (minimum 800x600, maximum monitor bounds)
width = Math.max(800, Math.min(width, targetMonitor.bounds.width));
height = Math.max(600, Math.min(height, targetMonitor.bounds.height));
console.log('Window size (after constraints):', { width, height, monitorBounds: targetMonitor.bounds });
```

### Configuration Save Detection (main.js, lines 319-332)

```javascript
ipcMain.handle('save-config', (_e, cfg) => {
  // ...
  const oldCfg = loadConfig();
  const monitorChanged = oldCfg.monitorId !== cfg.monitorId;
  const resolutionChanged = oldCfg.resolution !== cfg.resolution;
  const windowNeedsRecreation = monitorChanged || resolutionChanged;
  
  console.log('Saving config...', {
    oldResolution: oldCfg.resolution,
    newResolution: cfg.resolution,
    oldMonitor: oldCfg.monitorId,
    newMonitor: cfg.monitorId,
    monitorChanged,
    resolutionChanged,
    windowNeedsRecreation
  });
  
  // Only recreate window if resolution or monitor changed
  if (windowNeedsRecreation) {
    // ... destroy and recreate window with new config
  }
});
```

## Constraints

- **Minimum size**: 800x600 (enforced for usability)
- **Maximum size**: Monitor's native resolution (won't exceed screen bounds)
- **Aspect ratio**: Any ratio supported (not locked)
- **Presets**: 6 preset resolutions available (easily expandable)
- **Monitor bounds**: Window respects monitor boundaries and offsets

## Adding New Resolutions

To add more resolution presets, edit `main.js` line 175-189:

```javascript
ipcMain.handle('get-available-resolutions', () => {
  try {
    return [
      { label: '1920 x 1080', value: '1920x1080' },
      { label: '1440 x 900', value: '1440x900' },
      { label: '1280 x 720', value: '1280x720' },
      { label: '1600 x 1024', value: '1600x1024' },
      { label: '1360 x 768', value: '1360x768' },
      { label: '1024 x 768', value: '1024x768' },
      // Add new resolutions here:
      // { label: '2560 x 1440', value: '2560x1440' },
      // { label: '1024 x 600', value: '1024x600' },
    ];
  } catch (err) {
    console.error('get-available-resolutions error:', err);
    return [{ label: '1920 x 1080', value: '1920x1080' }];
  }
});
```

## Troubleshooting

### Window Doesn't Resize After Save
1. Check console for error messages
2. Verify resolution format is "WIDTHxHEIGHT" (e.g., "1280x720")
3. Check config.json to confirm resolution was saved
4. Verify monitor bounds are larger than selected resolution

### Resolution Dropdown Shows Empty
1. Ensure Electron.js is loaded (check console for errors)
2. Verify `window.electron.getAvailableResolutions()` is exposed in preload.js
3. Check browser console for IPC errors

### Wrong Size on Startup
1. Delete config.json to reset to defaults
2. Start app and set resolution again
3. Verify config.json contains correct resolution value

---

**Status**: ✅ Complete - Window size now properly matches selected resolution
