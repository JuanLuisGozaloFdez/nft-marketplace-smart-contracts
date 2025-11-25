#!/usr/bin/env node
/**
 * Minimal CLI launcher
 * Deploys diamond and launches the interactive CLI
 */

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const projectRoot = path.join(__dirname, '..');
const nodeScript = path.join(__dirname, 'cli-deploy.js');

console.log('🚀 NFT Marketplace CLI Launcher\n');
console.log('Prerequisites:');
console.log('  ✓ Node.js running');
console.log('  ✓ Compiled contracts (run: npx hardhat compile)\n');

try {
  console.log('Starting Hardhat node on http://127.0.0.1:8545...');
  execSync('npx hardhat node', {
    cwd: projectRoot,
    stdio: 'inherit',
  });
} catch (e) {
  console.log('Node stopped.');
}
