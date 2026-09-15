// ==========================================================================
// Geist Monochrome YouTube MP3 Cutter — Client Application
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const ytUrlInput = document.getElementById('ytUrlInput');
  const pasteBtn = document.getElementById('pasteBtn');
  const clearBtn = document.getElementById('clearBtn');
  const urlStatus = document.getElementById('urlStatus');
  const sampleChips = document.querySelectorAll('.sample-chip');

  // Preview elements
  const videoPreviewCard = document.getElementById('videoPreviewCard');
  const videoThumb = document.getElementById('videoThumb');
  const videoTitle = document.getElementById('videoTitle');
  const videoAuthor = document.getElementById('videoAuthor');
  const videoDurationBadge = document.getElementById('videoDurationBadge');
  const videoDurationPill = document.getElementById('videoDurationPill');

  // Trim configuration elements
  const trimCard = document.getElementById('trimCard');
  const modeStartTill = document.getElementById('modeStartTill');
  const modeCustomRange = document.getElementById('modeCustomRange');
  const startTimeGroup = document.getElementById('startTimeGroup');
  const startTimeInput = document.getElementById('startTimeInput');
  const startResetBtn = document.getElementById('startResetBtn');
  const endTimeInput = document.getElementById('endTimeInput');
  const endLabel = document.getElementById('endLabel');
  const calculatedDurationBadge = document.getElementById('calculatedDurationBadge');

  // Scrubber & Sliders
  const timeSlider = document.getElementById('timeSlider');
  const sliderFill = document.getElementById('sliderFill');
  const scrubberStartLabel = document.getElementById('scrubberStartLabel');
  const scrubberEndLabel = document.getElementById('scrubberEndLabel');
  const quickChips = document.querySelectorAll('.chip-btn');
  const fullDurationChip = document.getElementById('fullDurationChip');

  // Convert & Processing
  const convertBtn = document.getElementById('convertBtn');
  const convertBtnText = document.getElementById('convertBtnText');
  const btnSpinner = convertBtn.querySelector('.btn-spinner');
  const btnIcon = convertBtn.querySelector('.btn-icon');
  const processingCard = document.getElementById('processingCard');
  const progressBar = document.getElementById('progressBar');
  const processingTitle = document.getElementById('processingTitle');
  const processingSub = document.getElementById('processingSub');

  // Result & Audio Player
  const resultCard = document.getElementById('resultCard');
  const resultTitle = document.getElementById('resultTitle');
  const resultAuthor = document.getElementById('resultAuthor');
  const resultMetaBadge = document.getElementById('resultMetaBadge');
  const downloadLink = document.getElementById('downloadLink');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const simulationNotice = document.getElementById('simulationNotice');
  const simulationText = document.getElementById('simulationText');

  const audioPreviewPlayer = document.getElementById('audioPreviewPlayer');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const playerTimeline = document.querySelector('.player-timeline');
  const playerProgress = document.getElementById('playerProgress');
  const playerTimer = document.getElementById('playerTimer');

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
  let currentVideoData = null;
  let activeMode = 'till'; // 'till' or 'range'
  let totalVideoDuration = 240; // Default 4 mins
  let currentCutDuration = 60; // Default 1 min
  let debounceTimeout = null;

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

  function formatSecondsToTime(seconds, forceHours = false) {
    const s = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = n => String(n).padStart(2, '0');

    if (hrs > 0 || forceHours) {
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
  // URL Input & Metadata Fetching
  // ==========================================================================

  ytUrlInput.addEventListener('input', () => {
    const val = ytUrlInput.value.trim();
    clearBtn.style.display = val ? 'flex' : 'none';

    clearTimeout(debounceTimeout);
    if (!val) {
      hideUrlStatus();
      hideVideoPreview();
      return;
    }

    if (isValidYoutubeUrl(val)) {
      debounceTimeout = setTimeout(() => {
        fetchVideoInfo(val);
      }, 400);
    }
  });

  clearBtn.addEventListener('click', () => {
    ytUrlInput.value = '';
    clearBtn.style.display = 'none';
    hideUrlStatus();
    hideVideoPreview();
    ytUrlInput.focus();
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          ytUrlInput.value = text.trim();
          clearBtn.style.display = 'flex';
          fetchVideoInfo(text.trim());
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
      fetchVideoInfo(url);
    });
  });

  function showUrlStatus(msg, type = 'loading') {
    urlStatus.textContent = msg;
    urlStatus.className = `url-status ${type}`;
    urlStatus.style.display = 'flex';
  }

  function hideUrlStatus() {
    urlStatus.style.display = 'none';
  }

  function hideVideoPreview() {
    videoPreviewCard.style.display = 'none';
    trimCard.style.display = 'none';
    resultCard.style.display = 'none';
    currentVideoData = null;
  }

  async function fetchVideoInfo(url) {
    showUrlStatus('Fetching video information...', 'loading');
    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to retrieve video');
      }

      currentVideoData = data;
      hideUrlStatus();
      renderVideoInfo(data);
    } catch (err) {
      showUrlStatus(err.message || 'Error fetching video', 'error');
      hideVideoPreview();
    }
  }

  function renderVideoInfo(data) {
    videoTitle.textContent = data.title;
    videoAuthor.textContent = data.author;
    videoThumb.src = data.thumbnail;
    videoDurationBadge.textContent = data.durationFormatted;
    videoDurationPill.textContent = `Duration: ${data.durationFormatted}`;

    totalVideoDuration = data.duration || 240;
    timeSlider.max = totalVideoDuration;
    scrubberEndLabel.textContent = formatSecondsToTime(totalVideoDuration);

    // Initial default: 1 minute or half total
    const defaultEnd = Math.min(60, totalVideoDuration);
    endTimeInput.value = formatSecondsToTime(defaultEnd);
    timeSlider.value = defaultEnd;
    updateDurationCalculations();

    videoPreviewCard.style.display = 'block';
    trimCard.style.display = 'block';

    // Smooth scroll into view on mobile
    trimCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ==========================================================================
  // Mode Toggling (Till vs Custom Range)
  // ==========================================================================

  modeStartTill.addEventListener('click', () => {
    activeMode = 'till';
    modeStartTill.classList.add('active');
    modeCustomRange.classList.remove('active');
    startTimeGroup.style.display = 'none';
    startTimeInput.value = '00:00';
    endLabel.textContent = 'Till Timestamp (Cut up to)';
    updateDurationCalculations();
  });

  modeCustomRange.addEventListener('click', () => {
    activeMode = 'range';
    modeCustomRange.classList.add('active');
    modeStartTill.classList.remove('active');
    startTimeGroup.style.display = 'block';
    endLabel.textContent = 'To (End)';
    updateDurationCalculations();
  });

  startResetBtn.addEventListener('click', () => {
    startTimeInput.value = '00:00';
    updateDurationCalculations();
  });

  // ==========================================================================
  // Timestamps & Slider Calculations
  // ==========================================================================

  function updateDurationCalculations() {
    const startSec = activeMode === 'range' ? parseTimeToSeconds(startTimeInput.value) : 0;
    const endSec = parseTimeToSeconds(endTimeInput.value);

    let cutDuration = Math.max(0, endSec - startSec);
    currentCutDuration = cutDuration;

    calculatedDurationBadge.textContent = `Duration: ${formatSecondsToTime(cutDuration)}`;
    scrubberStartLabel.textContent = formatSecondsToTime(startSec);

    // Sync slider
    timeSlider.value = endSec;
    const pct = totalVideoDuration > 0 ? (endSec / totalVideoDuration) * 100 : 0;
    sliderFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;

    // Highlight matching chip
    quickChips.forEach(chip => {
      const chipSec = chip.getAttribute('data-seconds');
      if (chipSec === 'full') {
        chip.classList.toggle('active', endSec >= totalVideoDuration && startSec === 0);
      } else {
        chip.classList.toggle('active', parseInt(chipSec, 10) === cutDuration && startSec === 0);
      }
    });
  }

  // Slider input
  timeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    endTimeInput.value = formatSecondsToTime(val);
    updateDurationCalculations();
  });

  // Direct manual time inputs
  endTimeInput.addEventListener('blur', () => {
    const sec = parseTimeToSeconds(endTimeInput.value);
    const clamped = Math.min(totalVideoDuration, Math.max(1, sec));
    endTimeInput.value = formatSecondsToTime(clamped);
    updateDurationCalculations();
  });

  startTimeInput.addEventListener('blur', () => {
    const sec = parseTimeToSeconds(startTimeInput.value);
    const endSec = parseTimeToSeconds(endTimeInput.value);
    const clamped = Math.min(Math.max(0, endSec - 1), Math.max(0, sec));
    startTimeInput.value = formatSecondsToTime(clamped);
    updateDurationCalculations();
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
          const currentStart = parseTimeToSeconds(startTimeInput.value);
          endTimeInput.value = formatSecondsToTime(currentStart + secs);
        } else {
          startTimeInput.value = '00:00';
          endTimeInput.value = formatSecondsToTime(secs);
        }
      }
      updateDurationCalculations();
    });
  });

  // ==========================================================================
  // Conversion & Audio Extraction Execution
  // ==========================================================================

  convertBtn.addEventListener('click', async () => {
    if (!currentVideoData) return;

    const startSec = activeMode === 'range' ? parseTimeToSeconds(startTimeInput.value) : 0;
    const endSec = parseTimeToSeconds(endTimeInput.value);

    if (endSec <= startSec) {
      alert('End timestamp must be greater than start timestamp.');
      return;
    }

    const selectedBitrate = document.querySelector('input[name="bitrate"]:checked')?.value || '192';

    // UI Loading State
    setConvertingState(true);
    resultCard.style.display = 'none';
    processingCard.style.display = 'block';
    processingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Progress animation
    let progress = 10;
    progressBar.style.width = '10%';
    const progressInterval = setInterval(() => {
      progress = Math.min(92, progress + Math.floor(Math.random() * 8) + 4);
      progressBar.style.width = `${progress}%`;
    }, 280);

    try {
      const payload = {
        url: currentVideoData.url,
        title: currentVideoData.title,
        author: currentVideoData.author,
        thumbnail: currentVideoData.thumbnail,
        startTime: formatSecondsToTime(startSec),
        endTime: formatSecondsToTime(endSec),
        bitrate: selectedBitrate
      };

      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      clearInterval(progressInterval);
      progressBar.style.width = '100%';

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Conversion failed');
      }

      setTimeout(() => {
        processingCard.style.display = 'none';
        setConvertingState(false);
        renderResult(data);
        saveToHistory(data);
      }, 350);

    } catch (err) {
      clearInterval(progressInterval);
      processingCard.style.display = 'none';
      setConvertingState(false);
      alert(`Download Error: ${err.message}`);
    }
  });

  function setConvertingState(isConverting) {
    convertBtn.disabled = isConverting;
    btnSpinner.style.display = isConverting ? 'inline-block' : 'none';
    btnIcon.style.display = isConverting ? 'none' : 'inline-block';
    convertBtnText.textContent = isConverting ? 'Processing Audio...' : 'Cut & Download MP3';
  }

  // ==========================================================================
  // Render Result & In-Browser Audio Player
  // ==========================================================================

  function renderResult(data) {
    resultTitle.textContent = data.title;
    resultAuthor.textContent = data.author;
    resultMetaBadge.textContent = `${data.startFormatted} - ${data.endFormatted} • ${data.bitrate}`;

    downloadLink.href = data.downloadUrl;
    downloadLink.setAttribute('download', data.filename);

    copyLinkBtn.onclick = () => {
      const fullUrl = window.location.origin + data.downloadUrl;
      navigator.clipboard.writeText(fullUrl).then(() => {
        copyLinkBtn.innerHTML = `<span>Copied!</span>`;
        setTimeout(() => {
          copyLinkBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy Link</span>
          `;
        }, 2000);
      });
    };

    if (data.isSimulated) {
      simulationText.textContent = data.simulationNotice || 'Sample preview audio generated.';
      simulationNotice.style.display = 'flex';
    } else {
      simulationNotice.style.display = 'none';
    }

    // Set up audio player
    setupAudioPlayer(data.streamUrl, data.duration);

    resultCard.style.display = 'block';
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setupAudioPlayer(streamUrl, durationSec) {
    audioPreviewPlayer.pause();
    audioPreviewPlayer.src = streamUrl;
    playerProgress.style.width = '0%';
    playerTimer.textContent = `00:00 / ${formatSecondsToTime(durationSec)}`;
    showPlayIcon();

    playPauseBtn.onclick = () => {
      if (audioPreviewPlayer.paused) {
        audioPreviewPlayer.play().catch(e => console.log('Autoplay error:', e));
        showPauseIcon();
      } else {
        audioPreviewPlayer.pause();
        showPlayIcon();
      }
    };

    audioPreviewPlayer.ontimeupdate = () => {
      const cur = audioPreviewPlayer.currentTime;
      const dur = audioPreviewPlayer.duration || durationSec;
      const pct = (cur / dur) * 100;
      playerProgress.style.width = `${pct}%`;
      playerTimer.textContent = `${formatSecondsToTime(cur)} / ${formatSecondsToTime(dur)}`;
    };

    audioPreviewPlayer.onended = () => {
      showPlayIcon();
      playerProgress.style.width = '0%';
    };

    playerTimeline.onclick = (e) => {
      const rect = playerTimeline.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = clickX / rect.width;
      const dur = audioPreviewPlayer.duration || durationSec;
      audioPreviewPlayer.currentTime = pct * dur;
    };
  }

  function showPlayIcon() {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }

  function showPauseIcon() {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
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
      // Add to front
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
      // Keep max 10
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

      ytdlpStatusBadge.textContent = data.ytdlpAvailable ? 'Installed' : 'Simulated Fallback';
      ytdlpStatusBadge.classList.toggle('online', data.ytdlpAvailable);

      ffmpegStatusBadge.textContent = data.ffmpegAvailable ? 'Installed' : 'Standard Pipeline';
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
    if (e.target === systemModal) {
      systemModal.style.display = 'none';
    }
  });

  // Initial load
  loadHistory();
  checkSystemHealth();
});
