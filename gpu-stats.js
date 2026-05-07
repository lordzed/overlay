const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DXDIAG_PATH = path.join(__dirname, 'dxdiag_gpu.txt');
const UNKNOWN_GPU = { name: 'Unknown GPU', vendor: 'Unknown', model: 'Unknown GPU', dedicatedMemoryMb: 0 };

function normalizeGpuVendor(name = '', adapterCompatibility = '') {
  const combined = `${name} ${adapterCompatibility}`.toLowerCase();

  if (combined.includes('nvidia')) return 'NVIDIA';
  if (combined.includes('amd') || combined.includes('radeon') || combined.includes('advanced micro devices')) return 'AMD';
  if (combined.includes('intel')) return 'Intel';
  return 'Unknown';
}

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { windowsHide: true, maxBuffer: 1024 * 1024 * 4 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || stdout || err.message));
        return;
      }

      resolve(stdout);
    });
  });
}

function parseDxdiagDisplayDevices(report) {
  const devices = [];
  const lines = report.split(/\r?\n/);
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('Card name:')) {
      if (current?.name) devices.push(current);
      current = { name: line.split(':').slice(1).join(':').trim() };
      continue;
    }

    if (!current) continue;

    if (line.startsWith('Manufacturer:')) {
      current.manufacturer = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Dedicated Memory:')) {
      const match = line.match(/(\d+)\s*MB/i);
      current.dedicatedMemoryMb = match ? parseInt(match[1], 10) : 0;
    } else if (line.startsWith('Display Memory:')) {
      const match = line.match(/(\d+)\s*MB/i);
      current.displayMemoryMb = match ? parseInt(match[1], 10) : 0;
    } else if (line.startsWith('Current Mode:')) {
      current.currentMode = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Device Type:')) {
      current.deviceType = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Vendor ID:')) {
      current.vendorId = line.split(':').slice(1).join(':').trim();
    }
  }

  if (current?.name) devices.push(current);

  return devices.map((gpu) => ({
    name: gpu.name,
    vendor: normalizeGpuVendor(gpu.name, gpu.manufacturer),
    model: gpu.name,
    dedicatedMemoryMb: gpu.dedicatedMemoryMb || 0,
    displayMemoryMb: gpu.displayMemoryMb || 0,
    currentMode: gpu.currentMode || '',
    deviceType: gpu.deviceType || '',
    vendorId: gpu.vendorId || ''
  }));
}

function pickPreferredGpu(gpus) {
  if (!gpus.length) {
    return { ...UNKNOWN_GPU };
  }

  const scored = [...gpus].sort((a, b) => {
    const vendorScore = (gpu) => gpu.vendor === 'NVIDIA' || gpu.vendor === 'AMD' ? 2 : gpu.vendor !== 'Unknown' ? 1 : 0;
    const activeScore = (gpu) => gpu.currentMode && gpu.currentMode !== 'Unknown' ? 1 : 0;

    return (
      (vendorScore(b) - vendorScore(a))
      || (activeScore(b) - activeScore(a))
      || ((b.dedicatedMemoryMb || 0) - (a.dedicatedMemoryMb || 0))
      || ((b.displayMemoryMb || 0) - (a.displayMemoryMb || 0))
    );
  });

  const preferred = scored[0];

  return {
    name: preferred.name,
    vendor: preferred.vendor,
    model: preferred.name,
    dedicatedMemoryMb: preferred.dedicatedMemoryMb || 0
  };
}

function getNvidiaStats() {
  return new Promise((resolve) => {
    exec('"C:\\Windows\\System32\\nvidia-smi.exe" --query-gpu=utilization.gpu,temperature.gpu --format=csv,noheader,nounits', { windowsHide: true }, (err, stdout) => {
      if (err) { resolve(null); return; }
      const parts = stdout.trim().split(',');
      if (parts.length >= 2) {
        resolve({
          usage: parseInt(parts[0], 10) || 0,
          temp: parseInt(parts[1], 10) || 0
        });
      } else {
        resolve(null);
      }
    });
  });
}

function parseCsvLine(line) {
  const values = [];
  const matches = line.match(/"([^"]*)"/g) || [];

  for (const match of matches) {
    values.push(match.slice(1, -1));
  }

  return values;
}

function createGpuStatsService({ logError }) {
  let cachedGpuInfo = null;
  let cachedGpuInfoAt = 0;

  async function getPrimaryGpu() {
    const now = Date.now();
    if (cachedGpuInfo && (now - cachedGpuInfoAt) < 5 * 60 * 1000) {
      return cachedGpuInfo;
    }

    try {
      await execCommand(`dxdiag /whql:off /t "${DXDIAG_PATH}"`);
      const report = fs.readFileSync(DXDIAG_PATH, 'utf8');
      const gpus = parseDxdiagDisplayDevices(report);
      const gpu = pickPreferredGpu(gpus);
      cachedGpuInfo = gpu;
      cachedGpuInfoAt = now;
      return gpu;
    } catch (err) {
      logError('GPU_DETECT', err);
      return { ...UNKNOWN_GPU };
    }
  }

  async function getWindowsGpuUsage() {
    try {
      const stdout = await execCommand('typeperf "\\GPU Engine(*)\\Utilization Percentage" -sc 1');
      const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) return 0;

      const headers = parseCsvLine(lines[0]);
      const values = parseCsvLine(lines[1]);
      const usageByLuid = new Map();

      for (let i = 1; i < Math.min(headers.length, values.length); i++) {
        const header = headers[i];
        const value = parseFloat(values[i]);
        if (!Number.isFinite(value)) continue;

        const luidMatch = header.match(/luid_[^_]+_[^_]+/i);
        const luid = luidMatch ? luidMatch[0].toLowerCase() : 'all';
        usageByLuid.set(luid, (usageByLuid.get(luid) || 0) + value);
      }

      const usage = Math.max(0, ...usageByLuid.values(), 0);
      return Math.min(100, Math.round(usage));
    } catch (err) {
      logError('GPU_USAGE', err);
      return 0;
    }
  }

  async function getGPUStats() {
    try {
      const gpuInfo = await getPrimaryGpu();
      const [nvidia, usage] = await Promise.all([
        gpuInfo.vendor === 'NVIDIA' ? getNvidiaStats() : Promise.resolve(null),
        getWindowsGpuUsage()
      ]);

      return {
        name: gpuInfo.name,
        vendor: gpuInfo.vendor,
        model: gpuInfo.model,
        usage: nvidia ? nvidia.usage : usage,
        temp: nvidia ? nvidia.temp : null,
        hasNvidia: !!nvidia
      };
    } catch (err) {
      logError('GPU_STATS', err);
      return { ...UNKNOWN_GPU, usage: 0, temp: null, hasNvidia: false };
    }
  }

  return {
    getGPUStats
  };
}

module.exports = {
  createGpuStatsService
};
