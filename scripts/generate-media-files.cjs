/**
 * Generate sample media files for testing
 * Run with: node scripts/generate-media-files.js
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../test-files');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// SVG Images
const svgFiles = [
  {
    name: 'logo.svg',
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#007aff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#5856d6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="90" fill="url(#grad1)"/>
  <text x="100" y="115" font-family="Arial" font-size="48" font-weight="bold" fill="white" text-anchor="middle">L</text>
  <circle cx="100" cy="100" r="85" fill="none" stroke="white" stroke-width="2" opacity="0.3"/>
</svg>`
  },
  {
    name: 'icon-wallet.svg',
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
  <path d="M18 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
</svg>`
  },
  {
    name: 'pattern-dots.svg',
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse">
    <circle cx="5" cy="5" r="2" fill="#007aff" opacity="0.3"/>
  </pattern>
  <rect width="100" height="100" fill="url(#dots)"/>
</svg>`
  },
  {
    name: 'chart-illustration.svg',
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
  <rect width="400" height="200" fill="#f8fafc"/>
  <g transform="translate(50, 20)">
    <rect x="0" y="100" width="40" height="60" fill="#007aff" rx="4"/>
    <rect x="60" y="60" width="40" height="100" fill="#30d158" rx="4"/>
    <rect x="120" y="80" width="40" height="80" fill="#ff9f0a" rx="4"/>
    <rect x="180" y="40" width="40" height="120" fill="#5856d6" rx="4"/>
    <rect x="240" y="20" width="40" height="140" fill="#ff375f" rx="4"/>
  </g>
  <text x="200" y="190" font-family="Arial" font-size="14" fill="#64748b" text-anchor="middle">Sample Chart</text>
</svg>`
  },
  {
    name: 'avatar-placeholder.svg',
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="50" fill="#e2e8f0"/>
  <circle cx="50" cy="40" r="15" fill="#94a3b8"/>
  <ellipse cx="50" cy="80" rx="25" ry="18" fill="#94a3b8"/>
</svg>`
  }
];

// Create SVG files
console.log('Generating SVG files...\n');
for (const file of svgFiles) {
  const filePath = path.join(OUTPUT_DIR, file.name);
  fs.writeFileSync(filePath, file.content);
  console.log(`✓ Created: ${file.name}`);
}

// Create a simple audio file (WAV header only - minimal valid WAV)
const wavHeader = Buffer.alloc(44);
// RIFF header
wavHeader.write('RIFF', 0);
wavHeader.writeUInt32LE(36, 4); // File size - 8
wavHeader.write('WAVE', 8);
// fmt subchunk
wavHeader.write('fmt ', 12);
wavHeader.writeUInt32LE(16, 16); // Subchunk1Size
wavHeader.writeUInt16LE(1, 20); // AudioFormat (PCM)
wavHeader.writeUInt16LE(1, 22); // NumChannels
wavHeader.writeUInt32LE(44100, 24); // SampleRate
wavHeader.writeUInt32LE(88200, 28); // ByteRate
wavHeader.writeUInt16LE(2, 32); // BlockAlign
wavHeader.writeUInt16LE(16, 34); // BitsPerSample
// data subchunk
wavHeader.write('data', 36);
wavHeader.writeUInt32LE(0, 40); // Subchunk2Size

// Add some simple audio data (1 second of silence)
const sampleRate = 44100;
const duration = 0.1; // 0.1 second
const numSamples = Math.floor(sampleRate * duration);
const audioData = Buffer.alloc(numSamples * 2); // 16-bit samples

// Update sizes
const fileSize = 44 + audioData.length - 8;
wavHeader.writeUInt32LE(fileSize, 4);
wavHeader.writeUInt32LE(audioData.length, 40);

const wavBuffer = Buffer.concat([wavHeader, audioData]);
fs.writeFileSync(path.join(OUTPUT_DIR, 'sample.wav'), wavBuffer);
console.log('✓ Created: sample.wav');

// Create a simple text-based video placeholder (WebVTT subtitle file)
const vttContent = `WEBVTT

00:00:00.000 --> 00:00:05.000
Welcome to Lumen Browser

00:00:05.000 --> 00:00:10.000
Decentralized browsing for everyone

00:00:10.000 --> 00:00:15.000
Powered by IPFS and blockchain
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'subtitles.vtt'), vttContent);
console.log('✓ Created: subtitles.vtt');

// Create CSV data file
const csvContent = `id,name,type,size,created_at
1,document.pdf,file,1024,2026-01-01
2,images,folder,0,2026-01-02
3,video.mp4,file,5242880,2026-01-03
4,backup,folder,0,2026-01-04
5,config.json,file,512,2026-01-05
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'data.csv'), csvContent);
console.log('✓ Created: data.csv');

// Create XML file
const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<manifest>
  <application name="Lumen Browser" version="0.1.0">
    <features>
      <feature name="ipfs" enabled="true"/>
      <feature name="blockchain-dns" enabled="true"/>
      <feature name="pqc" enabled="true"/>
    </features>
    <permissions>
      <permission name="storage"/>
      <permission name="network"/>
      <permission name="clipboard"/>
    </permissions>
  </application>
  <dependencies>
    <dependency name="electron" version="35.0.0"/>
    <dependency name="vue" version="3.5.x"/>
    <dependency name="typescript" version="5.x"/>
  </dependencies>
</manifest>
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.xml'), xmlContent);
console.log('✓ Created: manifest.xml');

// Create SQL file
const sqlContent = `-- Sample SQL schema for Lumen

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    wallet_address TEXT UNIQUE,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS transactions (
    hash TEXT PRIMARY KEY,
    height INTEGER NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    fee TEXT,
    memo TEXT,
    timestamp INTEGER NOT NULL
);

CREATE INDEX idx_tx_from ON transactions(from_address);
CREATE INDEX idx_tx_to ON transactions(to_address);
CREATE INDEX idx_tx_height ON transactions(height);

-- Insert sample data
INSERT INTO profiles (id, name, wallet_address) VALUES 
    ('profile_1', 'Default Profile', 'lmn1abc123...'),
    ('profile_2', 'Work Profile', 'lmn1def456...');
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'schema.sql'), sqlContent);
console.log('✓ Created: schema.sql');

// Create shell script
const shContent = `#!/bin/bash
# Lumen Browser setup script

set -e

echo "Setting up Lumen Browser..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js is required but not installed."
    exit 1
fi

# Install dependencies
npm install

# Build the application
npm run build

# Run tests
npm test

echo "Setup complete!"
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'setup.sh'), shContent);
console.log('✓ Created: setup.sh');

// Create PowerShell script
const ps1Content = `# Lumen Browser Windows Setup Script
$ErrorActionPreference = "Stop"

Write-Host "Setting up Lumen Browser..." -ForegroundColor Cyan

# Check for Node.js
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js is required but not installed." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Build
Write-Host "Building application..." -ForegroundColor Yellow
npm run build

Write-Host "Setup complete!" -ForegroundColor Green
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'setup.ps1'), ps1Content);
console.log('✓ Created: setup.ps1');

console.log(`\n✅ All media and data files generated in: ${OUTPUT_DIR}`);
console.log('\nTotal files ready for upload:');

const files = fs.readdirSync(OUTPUT_DIR);
console.log(`  ${files.length} files\n`);
files.forEach(f => {
  const stats = fs.statSync(path.join(OUTPUT_DIR, f));
  console.log(`  - ${f} (${stats.size} bytes)`);
});
