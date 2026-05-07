const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG = {
  steamApiKey: '',
  steamId: '',
  keybinds: {}
};

const DEFAULT_RESOLUTIONS = [
  { label: '1920 x 1080', value: '1920x1080' },
  { label: '1440 x 900', value: '1440x900' },
  { label: '1280 x 720', value: '1280x720' },
  { label: '1600 x 1024', value: '1600x1024' },
  { label: '1360 x 768', value: '1360x768' },
  { label: '1024 x 768', value: '1024x768' }
];

function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfigFile(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = {
  DEFAULT_CONFIG,
  DEFAULT_RESOLUTIONS,
  loadConfig,
  saveConfigFile
};
