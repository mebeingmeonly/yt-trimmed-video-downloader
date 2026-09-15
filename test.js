// Unit test script for downloader.js and mock requests
const { 
  extractVideoId, 
  formatDuration, 
  parseTimestamp, 
  getVideoInfo, 
  cutAndConvert 
} = require('./downloader');
const path = require('path');
const assert = require('assert');

async function runTests() {
  console.log('🧪 Starting Unit Tests...\n');

  // Test 1: Video ID Extraction
  console.log('1. Testing URL parsing...');
  assert.strictEqual(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  console.log('  ✅ Video ID extraction passed for all URL formats.');

  // Test 2: Timestamp formatting & parsing
  console.log('2. Testing timestamp formatting & parsing...');
  assert.strictEqual(parseTimestamp('00:45'), 45);
  assert.strictEqual(parseTimestamp('01:30'), 90);
  assert.strictEqual(parseTimestamp('01:05:20'), 3920);
  assert.strictEqual(parseTimestamp('120'), 120);

  assert.strictEqual(formatDuration(45), '00:45');
  assert.strictEqual(formatDuration(90), '01:30');
  assert.strictEqual(formatDuration(3920), '01:05:20');
  console.log('  ✅ Timestamp conversion passed.');

  // Test 3: Metadata extraction
  console.log('3. Testing getVideoInfo fallback & structure...');
  const info = await getVideoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.strictEqual(info.id, 'dQw4w9WgXcQ');
  assert.ok(info.title);
  assert.ok(info.duration > 0);
  assert.ok(info.thumbnail.includes('dQw4w9WgXcQ'));
  console.log('  ✅ Video metadata returned successfully:', info.title);

  // Test 4: Audio cutting and MP3 buffer creation
  console.log('4. Testing audio cutting & MP3 generation...');
  const result = await cutAndConvert({
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    startTime: '00:00',
    endTime: '00:25',
    bitrate: '192',
    outputDir: path.join(__dirname, 'downloads')
  });

  assert.strictEqual(result.duration, 25);
  assert.strictEqual(result.startFormatted, '00:00');
  assert.strictEqual(result.endFormatted, '00:25');
  assert.ok(result.fileSize > 100000, 'Audio file should have realistic byte size');
  assert.ok(result.filename.endsWith('.mp3'));
  console.log('  ✅ MP3 file cut generated:', result.filename, `(${Math.round(result.fileSize / 1024)} KB)`);

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
