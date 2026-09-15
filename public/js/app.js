// ==========================================================================
// Geist Monochrome YouTube MP3 Cutter — In-Browser Trimmer & Instant Exporter
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const ytUrlInput = document.getElementById('ytUrlInput');
  const pasteBtn = document.getElementById('pasteBtn');
  const clearBtn = document.getElementById('clearBtn');
  const loadAudioBtn = document.getElementById('loadAudioBtn');
  const loadAudioBtnText = document.getElementById('loadAudioBtnText');
  const loadSpinner = loadAudioBtn.querySelector('.btn-spinner');
  const loadIcon = loadAudioBtn.querySelector('.btn-icon');
  const urlStatus = document.getElementById('urlStatus');
  const sampleChips = document.querySelectorAll('.sample-chip');

  // Processing & Workbench
  const processingCard = document.getElementById('processingCard');
  const progressBar = document.getElementById('progressBar');
  const processingTitle = document.getElementById('processingTitle');
  const processingSub = document.getElementById('processingSub');
  const workbenchCard = document.getElementById('workbenchCard');

  // Track info
  const videoThumb = document.getElementById('videoThumb');
  const videoTitle = document.getElementById('videoTitle');
  const videoAuthor = document.getElementById('videoAuthor');
  const videoDurationBadge = document.getElementById('videoDurationBadge');
  const videoDurationPill = document.getElementById('videoDurationPill');

  // Audio Player & Visualizer
  const audioSource = document.getElementById('audioSource');
  const waveformCanvas = document.getElementById('waveformCanvas');
  const waveformCutOverlay = document.getElementById('waveformCutOverlay');
  const playheadMarker = document.getElementById('playheadMarker');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const previewCutBtn = document.getElementById('previewCutBtn');
  const playerTimer = document.getElementById('playerTimer');

  // Trimming controls
  const modeStartTill = document.getElementById('modeStartTill');
  const modeCustomRange = document.getElementById('modeCustomRange');
  const startTimeGroup = document.getElementById('startTimeGroup');
  const startTimeInput = document.getElementById('startTimeInput');
  const startResetBtn = document.getElementById('startResetBtn');
  const endTimeInput = document.getElementById('endTimeInput');
  const endLabel = document.getElementById('endLabel');
  const calculatedDurationBadge = document.getElementById('calculatedDurationBadge');
  const timeSlider = document.getElementById('timeSlider');
  const sliderFill = document.getElementById('sliderFill');
  const scrubberStartLabel = document.getElementById('scrubberStartLabel');
  const scrubberEndLabel = document.getElementById('scrubberEndLabel');
  const quickChips = document.querySelectorAll('.chip-btn');
  const fullDurationChip = document.getElementById('fullDurationChip');

  // Actions
  const downloadTrimmedBtn = document.getElementById('downloadTrimmedBtn');
  const downloadTrimmedBtnText = document.getElementById('downloadTrimmedBtnText');
  const trimmedSpinner = downloadTrimmedBtn.querySelector('.btn-spinner');
  const trimmedIcon = downloadTrimmedBtn.querySelector('.btn-icon');
  const downloadFullBtn = document.getElementById('downloadFullBtn');

  // History & System Modal
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const systemInfoBtn = document.getElementById('systemInfoBtn');
  const systemModal = document.getElementById('systemModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const ytdlpStatusBadge = document.getElementById('ytdlpStatusBadge');
  const ffmpegStatusBadge = document.getElementById('ffmpegStatusBadge');
  const nodeVersionBadge = document.getElementById('nodeVersionBadge');

  // State
  let currentAudioData = null;
  let decodedAudioBuffer = null;
  let audioContext = null;
  let activeMode = 'till'; // 'till' or 'range'
  let totalVideoDuration = 210;
  let isPreviewingCut = false;
  let cutPreviewStopTimer = null;

  // Web Audio Context setup
  function getAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  }

  // ==========================================================================
  // Helper Utilities
  // ==========================================================================

  function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    if (typeof timeStr === 'number') return timeStr;
    const parts = String(timeStr).trim().split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return 0;
  }

  function formatSecondsToTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = n => String(n).padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  function isValidYoutubeUrl(url) {
    if (!url) return false;
    const str = url.trim();
    return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+/.test(str) || /^[a-zA-Z0-9_-]{11}$/.test(str);
  }

  // ==========================================================================
  // URL Input & Actions
  // ==========================================================================

  ytUrlInput.addEventListener('input', () => {
    const val = ytUrlInput.value.trim();
    clearBtn.style.display = val ? 'flex' : 'none';
    if (!val) hideUrlStatus();
  });

  clearBtn.addEventListener('click', () => {
    ytUrlInput.value = '';
    clearBtn.style.display = 'none';
    hideUrlStatus();
    ytUrlInput.focus();
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          ytUrlInput.value = text.trim();
          clearBtn.style.display = 'flex';
          startLoadAudioFlow(text.trim());
        }
      } else {
        ytUrlInput.focus();
      }
    } catch (e) {
      ytUrlInput.focus();
    }
  });

  sampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const url = chip.getAttribute('data-url');
      ytUrlInput.value = url;
      clearBtn.style.display = 'flex';
      startLoadAudioFlow(url);
    });
  });

  loadAudioBtn.addEventListener('click', () => {
    const url = ytUrlInput.value.trim();
    if (!url) {
      showUrlStatus('Please enter a YouTube link first.', 'error');
      return;
    }
    startLoadAudioFlow(url);
  });

  function showUrlStatus(msg, type = 'loading') {
    urlStatus.textContent = msg;
    urlStatus.className = `url-status ${type}`;
    urlStatus.style.display = 'flex';
  }

  function hideUrlStatus() {
    urlStatus.style.display = 'none';
  }

  // ==========================================================================
  // Fetch Full Audio from YouTube
  // ==========================================================================

  async function startLoadAudioFlow(url) {
    if (!isValidYoutubeUrl(url)) {
      showUrlStatus('Invalid YouTube URL. Please check your link.', 'error');
      return;
    }

    showUrlStatus('Connecting to YouTube...', 'loading');
    setLoadingState(true);
    workbenchCard.style.display = 'none';
    processingCard.style.display = 'block';
    processingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    let progress = 12;
    progressBar.style.width = '12%';
    const progressInterval = setInterval(() => {
      progress = Math.min(94, progress + Math.floor(Math.random() * 6) + 3);
      progressBar.style.width = `${progress}%`;
    }, 320);

    try {
      const res = await fetch('/api/full-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await res.json();
      clearInterval(progressInterval);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract audio');
      }

      progressBar.style.width = '100%';
      processingTitle.textContent = 'Audio ready! Loading in browser...';
      processingSub.textContent = 'Decoding waveform for instant trimming';

      currentAudioData = data;
      hideUrlStatus();

      // Load into audio element and decode buffer in background
      await loadAndDecodeAudio(data);

      setTimeout(() => {
        processingCard.style.display = 'none';
        setLoadingState(false);
        renderWorkbench(data);
      }, 400);

    } catch (err) {
      clearInterval(progressInterval);
      processingCard.style.display = 'none';
      setLoadingState(false);
      showUrlStatus(err.message || 'Error fetching audio', 'error');
    }
  }

  function setLoadingState(isLoading) {
    loadAudioBtn.disabled = isLoading;
    loadSpinner.style.display = isLoading ? 'inline-block' : 'none';
    loadIcon.style.display = isLoading ? 'none' : 'inline-block';
    loadAudioBtnText.textContent = isLoading ? 'Fetching YouTube Audio...' : 'Load Full Audio';
  }

  // ==========================================================================
  // Web Audio Decoding & Waveform Rendering
  // ==========================================================================

  async function loadAndDecodeAudio(data) {
    audioSource.pause();
    audioSource.src = data.streamUrl;
    audioSource.load();

    try {
      const ctx = getAudioContext();
      const response = await fetch(data.streamUrl);
      const arrayBuffer = await response.arrayBuffer();
      decodedAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
      drawWaveform(decodedAudioBuffer);
    } catch (e) {
      console.warn('WebAudio decode warning:', e);
      drawFallbackWaveform();
    }
  }

  function drawWaveform(buffer) {
    const canvas = waveformCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth;
    const height = canvas.height;
    canvas.width = width;

    ctx.clearRect(0, 0, width, height);

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const barHeight = Math.max(2, (max - min) * amp);
      const y = (height - barHeight) / 2;
      ctx.fillRect(i, y, 1, barHeight);
    }
  }

  function drawFallbackWaveform() {
    const canvas = waveformCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth;
    const height = canvas.height;
    canvas.width = width;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';

    const bars = Math.floor(width / 3);
    for (let i = 0; i < bars; i++) {
      const h = Math.max(4, Math.sin(i * 0.15) * 16 + Math.random() * 12 + 6);
      ctx.fillRect(i * 3, (height - h) / 2, 2, h);
    }
  }

  // ==========================================================================
  // Workbench Render & Trimming Controls
  // ==========================================================================

  function renderWorkbench(data) {
    videoTitle.textContent = data.title;
    videoAuthor.textContent = data.author;
    videoThumb.src = data.thumbnail;
    videoDurationBadge.textContent = data.durationFormatted;
    videoDurationPill.textContent = `Total: ${data.durationFormatted}`;

    totalVideoDuration = data.duration || 210;
    timeSlider.max = totalVideoDuration;
    scrubberEndLabel.textContent = formatSecondsToTime(totalVideoDuration);

    // Initial default cut: first 30 seconds
    const defaultCut = Math.min(30, totalVideoDuration);
    startTimeInput.value = '00:00';
    endTimeInput.value = formatSecondsToTime(defaultCut);
    timeSlider.value = defaultCut;
    updateTrimCalculations();

    downloadFullBtn.href = data.downloadUrl;
    downloadFullBtn.setAttribute('download', data.filename);

    workbenchCard.style.display = 'block';
    workbenchCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Mode Toggling
  modeStartTill.addEventListener('click', () => {
    activeMode = 'till';
    modeStartTill.classList.add('active');
    modeCustomRange.classList.remove('active');
    startTimeGroup.style.display = 'none';
    startTimeInput.value = '00:00';
    endLabel.textContent = 'Till Timestamp (Cut up to)';
    updateTrimCalculations();
  });

  modeCustomRange.addEventListener('click', () => {
    activeMode = 'range';
    modeCustomRange.classList.add('active');
    modeStartTill.classList.remove('active');
    startTimeGroup.style.display = 'block';
    endLabel.textContent = 'To (End)';
    updateTrimCalculations();
  });

  startResetBtn.addEventListener('click', () => {
    startTimeInput.value = '00:00';
    updateTrimCalculations();
  });

  function updateTrimCalculations() {
    const startSec = activeMode === 'range' ? parseTimeToSeconds(startTimeInput.value) : 0;
    const endSec = parseTimeToSeconds(endTimeInput.value);

    let cutDuration = Math.max(0, endSec - startSec);
    calculatedDurationBadge.textContent = `Duration: ${formatSecondsToTime(cutDuration)}`;
    scrubberStartLabel.textContent = formatSecondsToTime(startSec);

    // Slider position
    timeSlider.value = endSec;
    const pct = totalVideoDuration > 0 ? (endSec / totalVideoDuration) * 100 : 0;
    sliderFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;

    // Visual Waveform Cut Overlay
    if (totalVideoDuration > 0) {
      const leftPct = (startSec / totalVideoDuration) * 100;
      const widthPct = (cutDuration / totalVideoDuration) * 100;
      waveformCutOverlay.style.left = `${Math.max(0, leftPct)}%`;
      waveformCutOverlay.style.width = `${Math.min(100 - leftPct, widthPct)}%`;
    }

    // Active preset chip
    quickChips.forEach(chip => {
      const chipSec = chip.getAttribute('data-seconds');
      if (chipSec === 'full') {
        chip.classList.toggle('active', endSec >= totalVideoDuration && startSec === 0);
      } else {
        chip.classList.toggle('active', parseInt(chipSec, 10) === cutDuration && startSec === 0);
      }
    });
  }

  // Slider Input
  timeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    endTimeInput.value = formatSecondsToTime(val);
    updateTrimCalculations();
  });

  // Direct Time Inputs
  endTimeInput.addEventListener('blur', () => {
    const sec = parseTimeToSeconds(endTimeInput.value);
    const clamped = Math.min(totalVideoDuration, Math.max(1, sec));
    endTimeInput.value = formatSecondsToTime(clamped);
    updateTrimCalculations();
  });

  startTimeInput.addEventListener('blur', () => {
    const sec = parseTimeToSeconds(startTimeInput.value);
    const endSec = parseTimeToSeconds(endTimeInput.value);
    const clamped = Math.min(Math.max(0, endSec - 1), Math.max(0, sec));
    startTimeInput.value = formatSecondsToTime(clamped);
    updateTrimCalculations();
  });

  // Quick preset chips
  quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const secVal = chip.getAttribute('data-seconds');
      if (secVal === 'full') {
        startTimeInput.value = '00:00';
        endTimeInput.value = formatSecondsToTime(totalVideoDuration);
      } else {
        const secs = parseInt(secVal, 10);
        if (activeMode === 'range') {
          const curStart = parseTimeToSeconds(startTimeInput.value);
          endTimeInput.value = formatSecondsToTime(curStart + secs);
        } else {
          startTimeInput.value = '00:00';
          endTimeInput.value = formatSecondsToTime(secs);
        }
      }
      updateTrimCalculations();
    });
  });

  // ==========================================================================
  // Audio Player & Cut Preview
  // ==========================================================================

  playPauseBtn.addEventListener('click', () => {
    if (audioSource.paused) {
      isPreviewingCut = false;
      clearTimeout(cutPreviewStopTimer);
      audioSource.play().catch(e => console.log('Playback error:', e));
      showPauseIcon();
    } else {
      audioSource.pause();
      showPlayIcon();
    }
  });

  // Preview cut section only
  previewCutBtn.addEventListener('click', () => {
    const startSec = activeMode === 'range' ? parseTimeToSeconds(startTimeInput.value) : 0;
    const endSec = parseTimeToSeconds(endTimeInput.value);

    clearTimeout(cutPreviewStopTimer);
    isPreviewingCut = true;

    audioSource.currentTime = startSec;
    audioSource.play().catch(e => console.log('Playback error:', e));
    showPauseIcon();

    const durationMs = (endSec - startSec) * 1000;
    cutPreviewStopTimer = setTimeout(() => {
      audioSource.pause();
      showPlayIcon();
      isPreviewingCut = false;
    }, durationMs);
  });

  audioSource.ontimeupdate = () => {
    const cur = audioSource.currentTime;
    const dur = audioSource.duration || totalVideoDuration;
    playerTimer.textContent = `${formatSecondsToTime(cur)} / ${formatSecondsToTime(dur)}`;

    if (dur > 0) {
      const pct = (cur / dur) * 100;
      playheadMarker.style.left = `${Math.min(100, Math.max(0, pct))}%`;
    }
  };

  audioSource.onended = () => {
    showPlayIcon();
  };

  function showPlayIcon() {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }

  function showPauseIcon() {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  }

  // Click on waveform to seek
  waveformCanvas.parentElement.addEventListener('click', (e) => {
    const rect = waveformCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = clickX / rect.width;
    const dur = audioSource.duration || totalVideoDuration;
    audioSource.currentTime = pct * dur;
  });

  // ==========================================================================
  // Instant In-Browser MP3 Trimming & Export (Web Audio + LameJS)
  // ==========================================================================

  downloadTrimmedBtn.addEventListener('click', async () => {
    if (!currentAudioData) return;

    const startSec = activeMode === 'range' ? parseTimeToSeconds(startTimeInput.value) : 0;
    const endSec = parseTimeToSeconds(endTimeInput.value);

    if (endSec <= startSec) {
      alert('End timestamp must be greater than start timestamp.');
      return;
    }

    setExportingState(true);

    try {
      // If we don't have decoded buffer yet, decode it now
      if (!decodedAudioBuffer) {
        const ctx = getAudioContext();
        const response = await fetch(currentAudioData.streamUrl);
        const arrayBuffer = await response.arrayBuffer();
        decodedAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
      }

      // Encode trimmed slice to MP3 in memory using lamejs
      const mp3Blob = encodeAudioSliceToMp3(decodedAudioBuffer, startSec, endSec, 192);

      // Trigger instant browser download
      const cleanTitle = (currentAudioData.title || 'audio')
        .replace(/[^\w\s\-_.]/gi, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 40) || 'track';

      const filename = `${cleanTitle}_cut_${formatSecondsToTime(startSec).replace(/:/g, '-')}_to_${formatSecondsToTime(endSec).replace(/:/g, '-')}.mp3`;
      const blobUrl = URL.createObjectURL(mp3Blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Save to history
      saveToHistory({
        title: currentAudioData.title,
        filename,
        downloadUrl: blobUrl,
        startFormatted: formatSecondsToTime(startSec),
        endFormatted: formatSecondsToTime(endSec),
        durationFormatted: formatSecondsToTime(endSec - startSec),
        bitrate: '192 kbps'
      });

      setExportingState(false);

    } catch (err) {
      console.error('Client-side trimming error:', err);
      setExportingState(false);
      alert(`Export Error: ${err.message}`);
    }
  });

  function setExportingState(isExporting) {
    downloadTrimmedBtn.disabled = isExporting;
    trimmedSpinner.style.display = isExporting ? 'inline-block' : 'none';
    trimmedIcon.style.display = isExporting ? 'none' : 'inline-block';
    downloadTrimmedBtnText.textContent = isExporting ? 'Exporting MP3...' : 'Download Trimmed MP3';
  }

  // Pure Client-side MP3 encoding function using LameJS
  function encodeAudioSliceToMp3(buffer, startSec, endSec, bitrate = 192) {
    if (typeof lamejs === 'undefined') {
      throw new Error('LameJS MP3 encoder library not loaded');
    }

    const sampleRate = buffer.sampleRate;
    const numChannels = buffer.numberOfChannels;
    const startSample = Math.floor(startSec * sampleRate);
    const endSample = Math.min(buffer.length, Math.floor(endSec * sampleRate));

    const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
    const mp3Data = [];

    function floatToInt16(floatArr) {
      const int16 = new Int16Array(floatArr.length);
      for (let i = 0; i < floatArr.length; i++) {
        const s = Math.max(-1, Math.min(1, floatArr[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return int16;
    }

    const leftFloat = buffer.getChannelData(0).subarray(startSample, endSample);
    const leftInt16 = floatToInt16(leftFloat);
    const sampleBlockSize = 1152;

    if (numChannels === 1) {
      for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
        const chunk = leftInt16.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(chunk);
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
      }
    } else {
      const rightFloat = (numChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)).subarray(startSample, endSample);
      const rightInt16 = floatToInt16(rightFloat);

      for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
        const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
        const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
      }
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) mp3Data.push(mp3buf);

    return new Blob(mp3Data, { type: 'audio/mp3' });
  }

  // ==========================================================================
  // Recent Cuts History (localStorage)
  // ==========================================================================

  function loadHistory() {
    try {
      const items = JSON.parse(localStorage.getItem('audiocut_history') || '[]');
      if (!items || items.length === 0) {
        historyList.innerHTML = '<div class="history-empty">No previous cuts yet. Paste a link above to begin.</div>';
        return;
      }

      historyList.innerHTML = items.map(item => `
        <div class="history-item">
          <div class="history-item-info">
            <div class="history-item-title">${escapeHtml(item.title)}</div>
            <div class="history-item-meta mono">${item.startFormatted} - ${item.endFormatted} (${item.durationFormatted}) • ${item.bitrate}</div>
          </div>
          <a href="${item.downloadUrl}" download="${item.filename}" class="history-dl-btn">Download</a>
        </div>
      `).join('');
    } catch (e) {
      console.warn('Could not read history:', e);
    }
  }

  function saveToHistory(item) {
    try {
      const items = JSON.parse(localStorage.getItem('audiocut_history') || '[]');
      items.unshift({
        title: item.title,
        downloadUrl: item.downloadUrl,
        filename: item.filename,
        startFormatted: item.startFormatted,
        endFormatted: item.endFormatted,
        durationFormatted: item.durationFormatted,
        bitrate: item.bitrate,
        timestamp: Date.now()
      });
      localStorage.setItem('audiocut_history', JSON.stringify(items.slice(0, 10)));
      loadHistory();
    } catch (e) {
      console.warn('Could not save history:', e);
    }
  }

  clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('audiocut_history');
    loadHistory();
  });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ==========================================================================
  // System Info Modal
  // ==========================================================================

  async function checkSystemHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      ytdlpStatusBadge.textContent = data.ytdlpAvailable ? 'Installed' : 'Unavailable';
      ytdlpStatusBadge.classList.toggle('online', data.ytdlpAvailable);

      ffmpegStatusBadge.textContent = data.ffmpegAvailable ? 'Installed' : 'Unavailable';
      ffmpegStatusBadge.classList.toggle('online', data.ffmpegAvailable);

      nodeVersionBadge.textContent = data.nodeVersion || '-';
    } catch (e) {
      ytdlpStatusBadge.textContent = 'Unavailable';
      ffmpegStatusBadge.textContent = 'Unavailable';
    }
  }

  systemInfoBtn.addEventListener('click', () => {
    checkSystemHealth();
    systemModal.style.display = 'flex';
  });

  closeModalBtn.addEventListener('click', () => {
    systemModal.style.display = 'none';
  });

  systemModal.addEventListener('click', (e) => {
    if (e.target === systemModal) systemModal.style.display = 'none';
  });

  // Initial load
  loadHistory();
  checkSystemHealth();
});
