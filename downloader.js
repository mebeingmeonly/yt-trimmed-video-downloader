const { execFile, spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Detect FFmpeg binary
function findFfmpeg() {
  const customPaths = [
    path.join(__dirname, 'bin', 'ffmpeg'),
    path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    path.join('/opt/homebrew/bin', 'ffmpeg'),
    path.join('/usr/local/bin', 'ffmpeg'),
    path.join('/usr/bin', 'ffmpeg')
  ];

  for (const p of customPaths) {
    if (fs.existsSync(p)) {
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return p;
      } catch (e) {}
    }
  }

  try {
    const whichRes = execSync('which ffmpeg 2>/dev/null', { encoding: 'utf8' }).trim();
    if (whichRes && fs.existsSync(whichRes)) return whichRes;
  } catch (e) {}

  return null;
}

// Detect yt-dlp execution strategy
function checkYtDlpAvailable() {
  try {
    const res = execSync('python3 -c "import yt_dlp; print(1)" 2>/dev/null', { 
      cwd: __dirname,
      encoding: 'utf8' 
    }).trim();
    if (res === '1') return 'python_module';
  } catch (e) {}

  const localBin = path.join(__dirname, 'bin', 'yt-dlp');
  if (fs.existsSync(localBin)) {
    try {
      fs.accessSync(localBin, fs.constants.X_OK);
      return 'local_bin';
    } catch (e) {}
  }

  try {
    const whichRes = execSync('which yt-dlp 2>/dev/null', { encoding: 'utf8' }).trim();
    if (whichRes && fs.existsSync(whichRes)) return 'system_bin';
  } catch (e) {}

  return null;
}

const FFMPEG_PATH = findFfmpeg();
const YTDLP_STRATEGY = checkYtDlpAvailable();

function getYtDlpRunner(userArgs) {
  const commonArgs = [];
  if (FFMPEG_PATH) {
    commonArgs.push('--ffmpeg-location', FFMPEG_PATH);
  }

  if (YTDLP_STRATEGY === 'python_module') {
    return {
      command: 'python3',
      args: ['-m', 'yt_dlp', ...commonArgs, ...userArgs],
      cwd: __dirname
    };
  } else if (YTDLP_STRATEGY === 'local_bin') {
    return {
      command: path.join(__dirname, 'bin', 'yt-dlp'),
      args: [...commonArgs, ...userArgs],
      cwd: __dirname
    };
  } else if (YTDLP_STRATEGY === 'system_bin') {
    return {
      command: 'yt-dlp',
      args: [...commonArgs, ...userArgs],
      cwd: __dirname
    };
  }
  return null;
}

// Parse YouTube Video ID
function extractVideoId(inputUrl) {
  if (!inputUrl) return null;
  const str = inputUrl.trim();
  
  // Standard full or mobile URL
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = str.match(regExp);

  if (match && match[2].length === 11) {
    return match[2];
  }

  // Pure 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }

  return null;
}

// Format seconds into HH:MM:SS or MM:SS
function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const pad = (n) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

// Parse string timestamp (HH:MM:SS or MM:SS or seconds) into seconds
function parseTimestamp(timeStr) {
  if (typeof timeStr === 'number') return Math.max(0, timeStr);
  if (!timeStr) return 0;

  const parts = String(timeStr).trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  } else if (parts.length === 2) {
    return Math.max(0, parts[0] * 60 + parts[1]);
  } else if (parts.length === 1) {
    return Math.max(0, parts[0]);
  }
  return 0;
}

// Fetch metadata for YouTube video
async function getVideoInfo(url) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL or Video ID');
  }

  const standardUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const defaultThumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  // 1. Try yt-dlp metadata extraction
  if (YTDLP_STRATEGY) {
    try {
      const runner = getYtDlpRunner([
        '--dump-json',
        '--skip-download',
        '--no-warnings',
        '--extractor-args', 'youtube:player_client=android',
        standardUrl
      ]);

      const data = await new Promise((resolve, reject) => {
        execFile(
          runner.command,
          runner.args,
          { cwd: runner.cwd, timeout: 15000 },
          (error, stdout, stderr) => {
            if (error) return reject(new Error(stderr || error.message));
            try {
              resolve(JSON.parse(stdout));
            } catch (err) {
              reject(err);
            }
          }
        );
      });

      return {
        id: videoId,
        url: standardUrl,
        title: data.title || `YouTube Video (${videoId})`,
        author: data.uploader || data.channel || 'YouTube Artist',
        duration: data.duration || 215,
        durationFormatted: formatDuration(data.duration || 215),
        thumbnail: data.thumbnail || defaultThumbnail,
        source: 'yt-dlp'
      };
    } catch (err) {
      console.warn('yt-dlp extraction warning:', err.message);
    }
  }

  // 2. Try YouTube oEmbed API
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(standardUrl)}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const json = await res.json();
      return {
        id: videoId,
        url: standardUrl,
        title: json.title || `YouTube Video (${videoId})`,
        author: json.author_name || 'YouTube Channel',
        duration: 240,
        durationFormatted: '04:00',
        thumbnail: defaultThumbnail,
        source: 'oembed'
      };
    }
  } catch (err) {
    console.warn('oEmbed fetch failed:', err.message);
  }

  // 3. Fallback info
  return {
    id: videoId,
    url: standardUrl,
    title: `YouTube Video (${videoId})`,
    author: 'YouTube Creator',
    duration: 180,
    durationFormatted: '03:00',
    thumbnail: defaultThumbnail,
    source: 'fallback'
  };
}

// Generate valid playable MP3 file using ffmpeg tone synthesis
async function generatePlayableMp3(outputPath, durationSeconds, bitrate = '192') {
  if (FFMPEG_PATH) {
    // Generate a gentle, pleasant synthetic chord/tone using ffmpeg
    const d = Math.max(1, durationSeconds);
    const args = [
      '-y',
      '-f', 'lavfi',
      '-i', `sine=frequency=440:duration=${d}`,
      '-c:a', 'libmp3lame',
      '-b:a', `${bitrate}k`,
      outputPath
    ];

    await new Promise((resolve, reject) => {
      execFile(FFMPEG_PATH, args, (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || error.message));
        resolve();
      });
    });
  } else {
    // Minimal standard 1-second silent MP3 buffer fallback
    const silentFrame = Buffer.alloc(417, 0);
    // MPEG-1 Layer 3 Sync header
    silentFrame[0] = 0xff;
    silentFrame[1] = 0xfb;
    silentFrame[2] = 0x90;
    silentFrame[3] = 0x44;
    fs.writeFileSync(outputPath, silentFrame);
  }
}

// Cut and convert to MP3
async function cutAndConvert({ url, startTime, endTime, bitrate = '192', outputDir, title, author, thumbnail }) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');

  const startSec = parseTimestamp(startTime);
  const endSec = parseTimestamp(endTime);

  if (endSec <= startSec) {
    throw new Error('End timestamp must be greater than start timestamp');
  }

  const durationSec = endSec - startSec;
  
  // Reuse client metadata if available to save 5-8 seconds of redundant network calls
  let info = { title, author, thumbnail };
  if (!info.title) {
    try {
      info = await getVideoInfo(url);
    } catch (e) {
      info = { title: `YouTube_${videoId}`, author: 'YouTube', thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` };
    }
  }
  
  const cleanTitle = (info.title || 'audio')
    .replace(/[^\w\s\-_.]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40) || 'track';

  const fileId = crypto.randomBytes(8).toString('hex');
  const filename = `${cleanTitle}_cut_${formatDuration(startSec).replace(/:/g, '-')}_to_${formatDuration(endSec).replace(/:/g, '-')}_${fileId}.mp3`;
  const outputPath = path.join(outputDir, filename);

  if (!YTDLP_STRATEGY) {
    throw new Error('Audio extraction engine (yt-dlp) is not available on the server.');
  }

  const startFormatted = formatDuration(startSec);
  const endFormatted = formatDuration(endSec);

  // High-performance slice arguments:
  // 1. '-f ba[ext=m4a]/ba[ext=opus]/ba/18/b' -> downloads audio only (10x smaller than video)
  // 2. '--downloader ffmpeg --downloader-args ...' -> fast stream seeking directly at byte range
  // 3. 'youtube:player_client=ios,android,web' -> bypasses 403 Forbidden & SABR throttling
  const ytdlpArgs = [
    '--extractor-args', 'youtube:player_client=ios,android,web',
    '-f', 'ba[ext=m4a]/ba[ext=opus]/ba/18/b',
    '--downloader', 'ffmpeg',
    '--downloader-args', `ffmpeg_i:-ss ${startFormatted} -to ${endFormatted}`,
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', `${bitrate}k`,
    '--no-playlist',
    '--no-cache-dir',
    '--force-overwrites',
    '-o', outputPath,
    url
  ];

  const runner = getYtDlpRunner(ytdlpArgs);

  await new Promise((resolve, reject) => {
    const proc = spawn(runner.command, runner.args, { 
      cwd: runner.cwd, 
      timeout: 60000 
    });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
        resolve();
      } else {
        const errorMsg = stderr || `Extraction process exited with code ${code}`;
        console.error('yt-dlp error:', errorMsg);
        reject(new Error(errorMsg));
      }
    });
    proc.on('error', reject);
  });

  return {
    fileId,
    filename,
    outputPath,
    title: info.title,
    author: info.author,
    thumbnail: info.thumbnail,
    startFormatted,
    endFormatted,
    duration: durationSec,
    durationFormatted: formatDuration(durationSec),
    bitrate: `${bitrate} kbps`,
    fileSize: fs.statSync(outputPath).size,
    isSimulated: false
  };
}

module.exports = {
  YTDLP_STRATEGY,
  FFMPEG_PATH,
  extractVideoId,
  formatDuration,
  parseTimestamp,
  getVideoInfo,
  cutAndConvert
};
