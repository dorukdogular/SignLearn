let player;
let transcriptData = [];
let aslIndex = {};
let isPlaying = false;
let animationFrameId;

let lastVideoTime = 0;
let aslSpeedMs = 400; // Used only for replay mode now
let smartPauseEnabled = false; // Kept for UI compatibility, but strictly synced now
let replayMode = false;
const historyWords = new Set();

// UI Elements
const statusText = document.getElementById('status-text');
const pulseInd = document.querySelector('.pulse');
const wordCloud = document.getElementById('word-cloud');
const errorMsg = document.getElementById('error-message');

function onYouTubeIframeAPIReady() {
  console.log("YouTube API Ready");
}

async function fetchAslIndex() {
  try {
    const res = await fetch('/api/asl-index');
    aslIndex = await res.json();
  } catch (err) {
    console.error("Failed to load ASL index", err);
  }
}
fetchAslIndex();

let currentPlaybackRate = 1.0;

document.getElementById('speed-slider').addEventListener('input', (e) => {
  currentPlaybackRate = parseFloat(e.target.value);
  document.getElementById('speed-value').innerText = currentPlaybackRate.toFixed(2) + "x";
  if (player && player.setPlaybackRate) {
    player.setPlaybackRate(currentPlaybackRate);
  }
  aslSpeedMs = 300 / currentPlaybackRate; // Replay speed scales inversely
});

document.getElementById('tv-mode').addEventListener('change', (e) => {
  const workspace = document.getElementById('workspace');
  if (e.target.checked) {
    workspace.classList.add('workspace-tv-mode');
  } else {
    workspace.classList.remove('workspace-tv-mode');
  }
});

document.getElementById('sample-btn').addEventListener('click', () => {
  document.getElementById('youtube-url').value = "https://youtu.be/PGUdWfB8nLg";
  document.getElementById('translate-btn').click();
});

document.getElementById('translate-btn').addEventListener('click', async () => {
  const urlInput = document.getElementById('youtube-url').value;
  const btnText = document.querySelector('.btn-text');
  const spinner = document.querySelector('.spinner');
  
  errorMsg.classList.add('hidden');
  
  const videoId = extractVideoID(urlInput);
  if (!videoId) {
    errorMsg.innerText = "Invalid YouTube URL. Please try again.";
    errorMsg.classList.remove('hidden');
    return;
  }

  btnText.classList.add('hidden');
  spinner.classList.remove('hidden');

  document.getElementById('workspace').classList.remove('hidden');
  document.getElementById('controls').classList.remove('hidden');
  document.getElementById('dictionary').classList.remove('hidden');
  
  historyWords.clear();
  wordCloud.innerHTML = '';
  document.getElementById('current-subtitle').innerText = "Loading subtitles...";
  clearAslDisplay();
  
  if (!player) {
    player = new YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: { 'playsinline': 1, 'autoplay': 1 },
      events: { 'onStateChange': onPlayerStateChange }
    });
  } else {
    player.loadVideoById(videoId);
  }

  try {
    const res = await fetch(`/api/transcript?videoId=${videoId}`);
    const data = await res.json();
    
    if (data.error) throw new Error(data.error);
    
    transcriptData = data;
    
    let isSeconds = false;
    if (transcriptData.length > 0 && transcriptData[0].offset < 100 && transcriptData[transcriptData.length - 1].offset < 10000) {
      isSeconds = true; 
    }
    
    transcriptData = transcriptData.map(t => ({
        ...t,
        offset: isSeconds ? parseFloat(t.offset) * 1000 : parseFloat(t.offset),
        duration: isSeconds ? parseFloat(t.duration) * 1000 : parseFloat(t.duration)
    }));
    
  } catch (err) {
    console.error(err);
    document.getElementById('current-subtitle').innerText = "⚠️ No subtitles found.";
    errorMsg.innerHTML = "<strong>⚠️ Uyarı:</strong> Bu videoda altyazı (caption) bulunamadı. Video oynatılacak ancak ASL çevirisi yapılamayacak.";
    errorMsg.classList.remove('hidden');
  } finally {
    btnText.classList.remove('hidden');
    spinner.classList.add('hidden');
  }
});

function extractVideoID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function onPlayerStateChange(event) {
  if (event.data == YT.PlayerState.PLAYING) {
    isPlaying = true;
    if (player && player.setPlaybackRate) {
      player.setPlaybackRate(currentPlaybackRate);
    }
    updateStatusUI('LIVE');
    startSyncLoop();
    runStableTranslator();
  } else if (event.data == YT.PlayerState.PAUSED) {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);
    if (!replayMode) updateStatusUI('PAUSED');
  } else {
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);
  }
}

let translationQueue = [];
let isTranslatorRunning = false;
let processedSubtitleIndex = -1;

function startSyncLoop() {
  if (!isPlaying) return;
  const currentTimeMs = player.getCurrentTime() * 1000;
  
  let latestIndex = -1;
  for (let i = 0; i < transcriptData.length; i++) {
    if (transcriptData[i].offset <= currentTimeMs) {
      latestIndex = i;
    } else {
      break;
    }
  }

  if (latestIndex !== -1 && latestIndex !== processedSubtitleIndex) {
    const tItem = transcriptData[latestIndex];
    document.getElementById('current-subtitle').innerText = tItem.text;
    
    const prevText = processedSubtitleIndex !== -1 ? transcriptData[processedSubtitleIndex].text : "";
    const newWords = getNewWords(prevText, tItem.text);
    
    newWords.forEach(w => translationQueue.push(w));
    processedSubtitleIndex = latestIndex;
  }
  
  animationFrameId = requestAnimationFrame(startSyncLoop);
}

function getNewWords(prevText, currText) {
   const prevWords = prevText.trim().split(/\s+/).filter(Boolean);
   const currWords = currText.trim().split(/\s+/).filter(Boolean);
   
   let i = 0;
   while (i < prevWords.length && i < currWords.length && prevWords[i].toLowerCase() === currWords[i].toLowerCase()) {
       i++;
   }
   return currWords.slice(i);
}

async function runStableTranslator() {
  if (isTranslatorRunning) return;
  isTranslatorRunning = true;
  
  while (true) {
    if (translationQueue.length > 0 && isPlaying && !replayMode) {
      const rawWord = translationQueue.shift();
      const currentWord = rawWord.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      
      if (currentWord.length > 0) {
        addWordToDictionary(currentWord);
        
        // Sabit, sarsılmaz ve konuşmadan bir tık daha hızlı bir ritim.
        // Asla hız değiştirmez (dengesizleşmez), her zaman kuyruğu eritecek kadar hızlıdır.
        const baseLetterTime = 65; 
        const baseRestTime = 60;
        
        const currentLetterTime = baseLetterTime / currentPlaybackRate;
        
        for (let i = 0; i < currentWord.length; i++) {
          renderWordWithActiveLetter(currentWord, i);
          renderAslImage(currentWord[i]);
          await delay(currentLetterTime);
        }
        
        let totalRestTime = baseRestTime / currentPlaybackRate;
        if (rawWord.endsWith(',')) totalRestTime += (150 / currentPlaybackRate);
        if (rawWord.endsWith('.') || rawWord.endsWith('?') || rawWord.endsWith('!')) totalRestTime += (300 / currentPlaybackRate);
        
        await delay(totalRestTime);
      }
    } else {
      await delay(50);
      if (!isPlaying && translationQueue.length === 0) {
         clearAslDisplay();
      }
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function updateStatusUI(status) {
  statusText.innerText = status;
  pulseInd.className = 'pulse';
  if (status === 'PAUSED') pulseInd.classList.add('paused');
  if (status === 'REPLAY') pulseInd.classList.add('replay');
}

/* Dictionary & History Feature */
function addWordToDictionary(word) {
  if (historyWords.has(word) || word.length < 2) return;
  historyWords.add(word);
  
  const card = document.createElement('div');
  card.className = 'word-card';
  card.innerText = word;
  card.onclick = () => replayWord(word, card);
  
  if (wordCloud.firstChild) {
    wordCloud.insertBefore(card, wordCloud.firstChild);
  } else {
    wordCloud.appendChild(card);
  }
}

async function replayWord(word, cardElement) {
  if (replayMode) return;
  replayMode = true;
  updateStatusUI('REPLAY');
  
  document.querySelectorAll('.word-card').forEach(c => c.classList.remove('active-replay'));
  cardElement.classList.add('active-replay');
  
  let wasPlaying = isPlaying;
  if (wasPlaying && player && player.pauseVideo) {
     player.pauseVideo();
  }
  
  for (let i = 0; i < word.length; i++) {
    renderWordWithActiveLetter(word, i);
    renderAslImage(word[i]);
    // Uses the Speed Slider value
    await delay(aslSpeedMs);
  }
  
  clearAslDisplay();
  cardElement.classList.remove('active-replay');
  replayMode = false;
  
  updateStatusUI('LIVE');
  if (wasPlaying && player && player.playVideo) {
     player.playVideo();
  }
}

/* Render Methods */
let lastWord = "";
let lastLetterIndex = -1;
let lastLetter = "";

let currentImgIndex = 0;
let imgBuffer = [];

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('asl-images-container');
  if (container) {
    for (let i=0; i<2; i++) {
      const img = document.createElement('img');
      img.className = 'asl-image';
      container.appendChild(img);
      imgBuffer.push(img);
    }
  }
});

function renderWordWithActiveLetter(word, activeIndex) {
  if (word === lastWord && activeIndex === lastLetterIndex) return;
  lastWord = word;
  lastLetterIndex = activeIndex;
  
  const container = document.getElementById('active-word-display');
  container.innerHTML = '';
  
  for (let i = 0; i < word.length; i++) {
    const span = document.createElement('span');
    span.innerText = word[i];
    if (i === activeIndex) {
      span.classList.add('active-letter');
    }
    container.appendChild(span);
  }
}

function renderAslImage(letter) {
  if (letter === lastLetter) return;
  lastLetter = letter;
  
  const container = document.getElementById('asl-images-container');
  const waitingState = container.querySelector('.waiting-state');
  if (waitingState) waitingState.remove();
  
  const images = aslIndex[letter];
  if (!images || images.length === 0) return;
  
  const randomImgPath = images[Math.floor(Math.random() * images.length)];
  
  if (imgBuffer.length < 2) {
      imgBuffer = Array.from(container.querySelectorAll('.asl-image'));
      if (imgBuffer.length < 2) return; // Wait for DOMContentLoaded theoretically
  }
  
  const nextImgIndex = (currentImgIndex + 1) % 2;
  const nextImg = imgBuffer[nextImgIndex];
  const currImg = imgBuffer[currentImgIndex];
  
  const tSpeed = 0.12 / currentPlaybackRate;
  nextImg.style.transition = `all ${tSpeed}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
  currImg.style.transition = `all ${tSpeed}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
  
  nextImg.src = randomImgPath;
  
  setTimeout(() => {
    nextImg.classList.add('show');
    currImg.classList.remove('show');
  }, 10);
  
  currentImgIndex = nextImgIndex;
}

function clearAslDisplay() {
  document.getElementById('active-word-display').innerHTML = '';
  if (imgBuffer.length >= 2) {
    imgBuffer[0].classList.remove('show');
    imgBuffer[1].classList.remove('show');
  }
  lastWord = "";
  lastLetter = "";
  lastLetterIndex = -1;
}
