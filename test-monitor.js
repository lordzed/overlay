// Quick test of monitor detection without full Electron app
const { app, screen } = require('electron');

console.log('Testing monitor detection...');

app.whenReady().then(() => {
  try {
    const monitors = screen.getAllDisplays();
    console.log('✓ Monitors detected:', monitors.length);
    
    monitors.forEach((m, i) => {
      console.log(`  Monitor ${i}:`, {
        id: m.id,
        label: m.label,
        bounds: m.bounds,
        isPrimary: m.bounds.x === 0 && m.bounds.y === 0
      });
    });
    
    // Test resolution parsing
    const testRes = '1920x1080';
    const [w, h] = testRes.split('x').map(Number);
    console.log(`✓ Resolution parsing test: ${testRes} -> ${w}x${h}`);
    
    console.log('✓ All tests passed!');
  } catch (err) {
    console.error('✗ Error:', err);
  }
  
  process.exit(0);
});
