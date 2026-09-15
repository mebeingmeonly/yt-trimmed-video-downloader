const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { 
  YTDLP_STRATEGY, 
  FFMPEG_PATH, 
  getVideoInfo, 
  cutAndConvert,
  extractVideoId 
} = require('./downloader');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// In-memory registry of created cuts: fileId -> fileMetadata
const cutsRegistry = new Map();

// Periodic cleanup of older files (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  const maxAge = 3600 * 1000; // 1 hour
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    for (const f of files) {
      const fullPath = path.join(DOWNLOADS_DIR, f);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(fullPath);
      }
    }
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}, 30 * 60 * 1000);

// MIME types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

// Send JSON response helper
function sendJSON(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

// Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

// Serve static file
function serveStatic(req, res, filePath) {
  let resolvedPath = path.join(PUBLIC_DIR, filePath);
  
  // Guard against path traversal
  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  // If directory, serve index.html
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
    resolvedPath = path.join(resolvedPath, 'index.html');
  }

  if (!fs.existsSync(resolvedPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(resolvedPath);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache'
  });

  const stream = fs.createReadStream(resolvedPath);
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // API Routes
  // 1. Health check
  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJSON(res, 200, {
      status: 'ok',
      ytdlpAvailable: !!YTDLP_STRATEGY,
      ytdlpStrategy: YTDLP_STRATEGY,
      ffmpegAvailable: !!FFMPEG_PATH,
      ffmpegPath: FFMPEG_PATH,
      nodeVersion: process.version,
      uptime: process.uptime()
    });
  }

  // 2. Video Info
  if (req.method === 'GET' && pathname === '/api/info') {
    const videoUrl = parsedUrl.query.url;
    if (!videoUrl) {
      return sendJSON(res, 400, { error: 'Missing YouTube URL (?url=...)' });
    }

    try {
      const info = await getVideoInfo(videoUrl);
      return sendJSON(res, 200, info);
    } catch (err) {
      return sendJSON(res, 400, { error: err.message || 'Failed to fetch video information' });
    }
  }

  // 3. Cut & Convert
  if (req.method === 'POST' && pathname === '/api/convert') {
    try {
      const body = await parseBody(req);
      const { url: videoUrl, startTime = '00:00', endTime, bitrate = '192' } = body;

      if (!videoUrl) {
        return sendJSON(res, 400, { error: 'YouTube URL is required' });
      }

      if (!endTime) {
        return sendJSON(res, 400, { error: 'End timestamp is required' });
      }

      const result = await cutAndConvert({
        url: videoUrl,
        startTime,
        endTime,
        bitrate,
        outputDir: DOWNLOADS_DIR
      });

      // Save into registry
      cutsRegistry.set(result.fileId, result);

      return sendJSON(res, 200, {
        success: true,
        fileId: result.fileId,
        filename: result.filename,
        title: result.title,
        author: result.author,
        thumbnail: result.thumbnail,
        startFormatted: result.startFormatted,
        endFormatted: result.endFormatted,
        duration: result.duration,
        durationFormatted: result.durationFormatted,
        bitrate: result.bitrate,
        fileSize: result.fileSize,
        downloadUrl: `/api/download/${result.fileId}`,
        streamUrl: `/api/stream/${result.fileId}`,
        isSimulated: result.isSimulated,
        simulationNotice: result.simulationNotice
      });
    } catch (err) {
      console.error('Conversion error:', err);
      return sendJSON(res, 500, { error: err.message || 'Error processing audio extraction' });
    }
  }

  // 4. Download file
  if (req.method === 'GET' && pathname.startsWith('/api/download/')) {
    const fileId = pathname.replace('/api/download/', '').trim();
    const cut = cutsRegistry.get(fileId);

    let filePath;
    let filename = 'cut_audio.mp3';

    if (cut && fs.existsSync(cut.outputPath)) {
      filePath = cut.outputPath;
      filename = cut.filename;
    } else {
      // Find file by fileId in downloads dir
      const files = fs.readdirSync(DOWNLOADS_DIR);
      const matched = files.find(f => f.includes(fileId));
      if (matched) {
        filePath = path.join(DOWNLOADS_DIR, matched);
        filename = matched;
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return sendJSON(res, 404, { error: 'File not found or expired. Please generate again.' });
    }

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  }

  // 5. Stream audio for in-browser playback
  if (req.method === 'GET' && pathname.startsWith('/api/stream/')) {
    const fileId = pathname.replace('/api/stream/', '').trim();
    const cut = cutsRegistry.get(fileId);

    let filePath;
    if (cut && fs.existsSync(cut.outputPath)) {
      filePath = cut.outputPath;
    } else {
      const files = fs.readdirSync(DOWNLOADS_DIR);
      const matched = files.find(f => f.includes(fileId));
      if (matched) filePath = path.join(DOWNLOADS_DIR, matched);
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return sendJSON(res, 404, { error: 'Audio file not found.' });
    }

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  }

  // Static file serving
  const reqPath = pathname === '/' ? 'index.html' : pathname;
  serveStatic(req, res, reqPath);
});

function startServer(portToTry) {
  server.listen(portToTry, () => {
    console.log(`Server running at http://localhost:${portToTry}`);
    console.log(`yt-dlp: ${YTDLP_STRATEGY ? 'Available (' + YTDLP_STRATEGY + ')' : 'Not found (Preview Mode)'}`);
    console.log(`ffmpeg: ${FFMPEG_PATH ? 'Available (' + FFMPEG_PATH + ')' : 'Not found'}`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is busy, trying next port...`);
    const nextPort = Number(PORT) + 1;
    server.listen(nextPort, () => {
      console.log(`Server running at http://localhost:${nextPort}`);
    });
  } else {
    console.error('Server error:', err);
  }
});

startServer(PORT);

