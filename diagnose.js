#!/usr/bin/env node
/**
 * Quick diagnostic script - checks if the app can start without Electron
 * Run with: node diagnose.js
 */

const fs = require('fs');
const path = require('path');

console.log('=== Overlay Diagnostic Tool ===\n');

// Check 1: Config file
console.log('1. Checking config.json...');
try {
  const cfgPath = path.join(__dirname, 'config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  console.log('   ✓ Config is valid JSON');
  console.log('   - steamApiKey:', cfg.steamApiKey ? '***' : 'missing');
  console.log('   - steamId:', cfg.steamId ? 'set' : 'missing');
  console.log('   - monitorId:', cfg.monitorId || 'not set (will use default)');
  console.log('   - resolution:', cfg.resolution || 'not set (will use 1920x1080)');
} catch (err) {
  console.log('   ✗ Config error:', err.message);
  console.log('   → App will create new config on startup');
}

// Check 2: Required files
console.log('\n2. Checking required files...');
const files = [
  'main.js',
  'renderer.js', 
  'preload.js',
  'index.html',
  'package.json'
];

files.forEach(f => {
  const exists = fs.existsSync(path.join(__dirname, f));
  console.log(`   ${exists ? '✓' : '✗'} ${f}`);
});

// Check 3: node_modules
console.log('\n3. Checking node_modules...');
const nmPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nmPath)) {
  const folders = fs.readdirSync(nmPath).filter(f => !f.startsWith('.')).length;
  console.log(`   ✓ node_modules exists (${folders} packages)`);
  
  if (fs.existsSync(path.join(nmPath, 'electron'))) {
    console.log('   ✓ electron is installed');
  } else {
    console.log('   ✗ electron NOT found - run: npm install');
  }
} else {
  console.log('   ✗ node_modules missing - run: npm install');
}

// Check 4: Syntax validation
console.log('\n4. Checking JavaScript syntax...');
try {
  require('./main.js');
  console.log('   ✗ main.js loaded (should not require() main.js in Node)');
} catch (err) {
  if (err.code === 'ERR_MODULE_NOT_FOUND' || err.message.includes('electron')) {
    console.log('   ✓ main.js syntax is valid (requires Electron to run)');
  } else {
    console.log('   ✗ Syntax error in main.js:');
    console.log('   ', err.message);
  }
}

console.log('\n=== End Diagnostic ===');
console.log('\nTo start the app:');
console.log('  npm start');
console.log('\nTo view errors:');
console.log('  - Check the file: app-error.log');
console.log('  - Run with: npm start (errors will be in command prompt)');
console.log('  - Open DevTools: Press F12 after app starts');
