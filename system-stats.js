const os = require('os');

function createSystemStatsService({ getGPUStats }) {
  async function getSystemStats() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuAvg = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      return acc + (1 - cpu.times.idle / total);
    }, 0) / cpus.length;

    return {
      cpu: Math.round(cpuAvg * 100),
      mem: Math.round((usedMem / totalMem) * 100),
      memText: `${(usedMem / 1073741824).toFixed(1)} / ${(totalMem / 1073741824).toFixed(1)} GB`,
      gpu: await getGPUStats()
    };
  }

  return {
    getSystemStats
  };
}

module.exports = {
  createSystemStatsService
};
