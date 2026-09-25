/* =========================================================
   AVEDOW AUDIO MIXER
   Version 2
   ========================================================= */

"use strict";


/* =========================================================
   ELEMENTS
   ========================================================= */

const $ = id => document.getElementById(id);

const audio = new Audio();

let audioContext = null;

let sourceNode = null;

let inputGain = null;
let channelGain = null;

let eqFilters = [];

let compressorNode = null;
let pannerNode = null;

let masterGain = null;
let analyser = null;
let limiter = null;

let delayNode = null;
let delayFeedback = null;

let reverbNode = null;

let isMuted = false;

let playlist = [];

let currentIndex = -1;

let animationId = null;

let ytPlayer = null;


/* =========================================================
   EQ BANDS
   ========================================================= */

const EQ_BANDS = [
  32,
  64,
  125,
  250,
  500,
  1000,
  2000,
  4000,
  8000,
  16000
];


/* =========================================================
   STARTUP
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  createEQ();

  loadSavedApiKey();

  setupEvents();

  drawIdleSpectrum();

  setStatus("Siap. Pilih MP3 atau cari lagu YouTube.");

});


/* =========================================================
   AUDIO ENGINE
   ========================================================= */

function initAudioEngine() {

  if (audioContext) {
    return;
  }


  try {

    audioContext =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();


    sourceNode =
      audioContext.createMediaElementSource(audio);


    inputGain =
      audioContext.createGain();


    channelGain =
      audioContext.createGain();


    compressorNode =
      audioContext.createDynamicsCompressor();


    pannerNode =
      audioContext.createStereoPanner();


    masterGain =
      audioContext.createGain();


    analyser =
      audioContext.createAnalyser();


    limiter =
      audioContext.createDynamicsCompressor();


    delayNode =
      audioContext.createDelay(1.0);


    delayFeedback =
      audioContext.createGain();


    reverbNode =
      createReverb();


    analyser.fftSize = 2048;

    analyser.smoothingTimeConstant = 0.82;


    /* -----------------------------
       LIMITER
       ----------------------------- */

    limiter.threshold.value = -3;

    limiter.knee.value = 0;

    limiter.ratio.value = 20;

    limiter.attack.value = 0.001;

    limiter.release.value = 0.08;


    /* -----------------------------
       COMPRESSOR
       ----------------------------- */

    compressorNode.threshold.value = 0;

    compressorNode.knee.value = 20;

    compressorNode.ratio.value = 1;

    compressorNode.attack.value = 0.01;

    compressorNode.release.value = 0.15;


    /* -----------------------------
       DELAY
       ----------------------------- */

    delayNode.delayTime.value = 0.15;

    delayFeedback.gain.value = 0;


    /* -----------------------------
       INITIAL VALUES
       ----------------------------- */

    inputGain.gain.value = 1;

    channelGain.gain.value = 1;

    masterGain.gain.value = 1;


    /* -----------------------------
       EQ
       ----------------------------- */

    eqFilters = EQ_BANDS.map(freq => {

      const filter =
        audioContext.createBiquadFilter();

      filter.type = "peaking";

      filter.frequency.value = freq;

      filter.Q.value = 1;

      filter.gain.value = 0;

      return filter;

    });


    /* -----------------------------
       CONNECT EQ
       ----------------------------- */

    sourceNode.connect(inputGain);

    inputGain.connect(channelGain);


    let previous = channelGain;

    eqFilters.forEach(filter => {

      previous.connect(filter);

      previous = filter;

    });


    previous.connect(compressorNode);

    compressorNode.connect(pannerNode);


    /* -----------------------------
       DRY SIGNAL
       ----------------------------- */

    pannerNode.connect(masterGain);


    /* -----------------------------
       DELAY FX
       ----------------------------- */

    pannerNode.connect(delayNode);

    delayNode.connect(delayFeedback);

    delayFeedback.connect(delayNode);

    delayNode.connect(masterGain);


    /* -----------------------------
       REVERB FX
       ----------------------------- */

    pannerNode.connect(reverbNode);

    reverbNode.connect(masterGain);


    /* -----------------------------
       OUTPUT
       ----------------------------- */

    masterGain.connect(limiter);

    limiter.connect(analyser);

    analyser.connect(
      audioContext.destination
    );


    setStatus("Audio engine siap.");

  }

  catch (error) {

    console.error(error);

    setStatus(
      "Gagal membuat Audio Engine: " +
      error.message
    );

  }

}


/* =========================================================
   REVERB
   ========================================================= */

function createReverb() {

  const length =
    audioContext.sampleRate * 2.5;

  const impulse =
    audioContext.createBuffer(
      2,
      length,
      audioContext.sampleRate
    );


  for (
    let channel = 0;
    channel < 2;
    channel++
  ) {

    const data =
      impulse.getChannelData(channel);


    for (
      let i = 0;
      i < length;
      i++
    ) {

      const decay =
        Math.pow(
          1 - i / length,
          2.5
        );


      data[i] =
        (Math.random() * 2 - 1) *
        decay;

    }

  }


  const convolver =
    audioContext.createConvolver();


  convolver.buffer = impulse;


  const gain =
    audioContext.createGain();


  gain.gain.value = 0;


  convolver.gainNode = gain;


  return convolver;

}


/* =========================================================
   EQ UI
   ========================================================= */

function createEQ() {

  const container =
    $("eqContainer");


  EQ_BANDS.forEach((freq, index) => {

    const band =
      document.createElement("div");


    band.className = "eqBand";


    const label =
      document.createElement("span");


    label.textContent =
      formatFrequency(freq);


    const slider =
      document.createElement("input");


    slider.type = "range";

    slider.min = "-12";

    slider.max = "12";

    slider.step = "0.1";

    slider.value = "0";


    slider.className = "eqSlider";


    const value =
      document.createElement("span");


    value.className =
      "eqValue";


    value.textContent =
      "0 dB";


    slider.addEventListener(
      "input",
      () => {

        value.textContent =
          Number(slider.value)
            .toFixed(1) +
          " dB";


        if (
          eqFilters[index]
        ) {

          eqFilters[index]
            .gain.value =
            Number(slider.value);

        }

      }
    );


    band.appendChild(label);

    band.appendChild(slider);

    band.appendChild(value);


    container.appendChild(band);

  });

}


function formatFrequency(freq) {

  if (freq >= 1000) {

    return (
      freq / 1000 +
      "k"
    );

  }

  return freq;

}


/* =========================================================
   LOCAL MP3
   ========================================================= */

function loadFile(file) {

  if (!file) return;


  initAudioEngine();


  const url =
    URL.createObjectURL(file);


  audio.pause();

  audio.src = url;

  audio.load();


  playlist.push({
    name: file.name,
    url: url
  });


  currentIndex =
    playlist.length - 1;


  renderPlaylist();


  $("trackName").textContent =
    file.name;


  setStatus(
    "MP3 dimuat. Tekan PLAY."
  );

}


/* =========================================================
   PLAY
   ========================================================= */

async function playAudio() {

  if (!audio.src) {

    setStatus(
      "Pilih MP3 terlebih dahulu."
    );

    return;

  }


  initAudioEngine();


  try {

    if (
      audioContext.state ===
      "suspended"
    ) {

      await audioContext.resume();

    }


    await audio.play();


    $("playBtn").textContent =
      "▶ PLAYING";


    setStatus("Sedang diputar.");

    startSpectrum();

  }

  catch (error) {

    console.error(error);

    setStatus(
      "Tidak bisa memutar audio: " +
      error.message
    );

  }

}


/* =========================================================
   PAUSE
   ========================================================= */

function pauseAudio() {

  audio.pause();

  $("playBtn").textContent =
    "▶ PLAY";

  setStatus("Pause.");

}


/* =========================================================
   STOP
   ========================================================= */

function stopAudio() {

  audio.pause();

  audio.currentTime = 0;

  $("seekBar").value = 0;

  $("currentTime").textContent =
    "00:00";

  $("playBtn").textContent =
    "▶ PLAY";

  setStatus("Stop.");

}


/* =========================================================
   SEEK
   ========================================================= */

function updateSeek() {

  if (
    !audio.duration ||
    !isFinite(audio.duration)
  ) {

    return;

  }


  const percent =
    (audio.currentTime /
      audio.duration) *
    100;


  $("seekBar").value =
    percent;


  $("currentTime").textContent =
    formatTime(audio.currentTime);


  $("duration").textContent =
    formatTime(audio.duration);

}


function seekAudio() {

  if (!audio.duration) return;


  audio.currentTime =
    (
      Number($("seekBar").value) /
      100
    ) *
    audio.duration;

}


/* =========================================================
   SPECTRUM
   ========================================================= */

function startSpectrum() {

  if (animationId) return;


  const canvas =
    $("spectrum");


  const ctx =
    canvas.getContext("2d");


  function resizeCanvas() {

    const ratio =
      window.devicePixelRatio || 1;


    canvas.width =
      canvas.clientWidth * ratio;


    canvas.height =
      canvas.clientHeight * ratio;


    ctx.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );

  }


  resizeCanvas();


  window.addEventListener(
    "resize",
    resizeCanvas
  );


  const bufferLength =
    analyser
      ? analyser.frequencyBinCount
      : 1024;


  const data =
    new Uint8Array(bufferLength);


  function draw() {

    animationId =
      requestAnimationFrame(draw);


    const width =
      canvas.clientWidth;


    const height =
      canvas.clientHeight;


    ctx.clearRect(
      0,
      0,
      width,
      height
    );


    ctx.fillStyle =
      "#07080b";


    ctx.fillRect(
      0,
      0,
      width,
      height
    );


    if (!analyser) return;


    analyser.getByteFrequencyData(
      data
    );


    const bars = 80;

    const step =
      Math.max(
        1,
        Math.floor(
          bufferLength / bars
        )
      );


    const barWidth =
      width / bars;


    let maxValue = 0;


    for (
      let i = 0;
      i < bars;
      i++
    ) {

      const index =
        i * step;


      const value =
        data[index] || 0;


      if (value > maxValue) {
        maxValue = value;
      }


      const barHeight =
        (value / 255) *
        height *
        0.92;


      const x =
        i * barWidth;


      const y =
        height - barHeight;


      const gradient =
        ctx.createLinearGradient(
          0,
          height,
          0,
          0
        );


      gradient.addColorStop(
        0,
        "#00e5ff"
      );


      gradient.addColorStop(
        .55,
        "#7c4dff"
      );


      gradient.addColorStop(
        1,
        "#ff2f7d"
      );


      ctx.fillStyle =
        gradient;


      ctx.fillRect(
        x + 1,
        y,
        Math.max(
          1,
          barWidth - 2
        ),
        barHeight
      );

    }


    const db =
      maxValue > 0
        ? 20 *
          Math.log10(
            maxValue / 255
          )
        : -Infinity;


    $("peakValue").textContent =
      db === -Infinity
        ? "-∞ dB"
        : db.toFixed(1) + " dB";


    const level =
      maxValue / 255;


    $("meterL").style.height =
      Math.max(
        3,
        level * 100
      ) + "%";


    $("meterR").style.height =
      Math.max(
        3,
        level * 96
      ) + "%";

  }


  draw();

}


function drawIdleSpectrum() {

  const canvas =
    $("spectrum");


  const ctx =
    canvas.getContext("2d");


  const width =
    canvas.clientWidth;


  const height =
    canvas.clientHeight;


  canvas.width =
    width * (window.devicePixelRatio || 1);


  canvas.height =
    height * (window.devicePixelRatio || 1);


  ctx.fillStyle =
    "#07080b";


  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

}


/* =========================================================
   DSP CONTROLS
   ========================================================= */

function setupDSP() {

  $("gain").addEventListener(
    "input",
    () => {

      const db =
        Number($("gain").value);


      $("gainValue").textContent =
        db.toFixed(1) + " dB";


      if (inputGain) {

        inputGain.gain.value =
          Math.pow(
            10,
            db / 20
          );

      }

    }
  );


  $("compressor").addEventListener(
    "input",
    () => {

      const value =
        Number(
          $("compressor").value
        );


      $("compressorValue")
        .textContent =
        value + "%";


      if (compressorNode) {

        compressorNode.threshold.value =
          -value * 0.4;

        compressorNode.ratio.value =
          1 + value / 10;

      }

    }
  );


  $("pan").addEventListener(
    "input",
    () => {

      const value =
        Number($("pan").value);


      $("panValue").textContent =
        value.toFixed(2);


      if (pannerNode) {

        pannerNode.pan.value =
          value;

      }

    }
  );


  $("delay").addEventListener(
    "input",
    () => {

      const value =
        Number(
          $("delay").value
        );


      $("delayValue").textContent =
        value + "%";


      if (delayFeedback) {

        delayFeedback.gain.value =
          value / 100 * 0.55;

      }

    }
  );


  $("reverb").addEventListener(
    "input",
    () => {

      const value =
        Number(
          $("reverb").value
        );


      $("reverbValue")
        .textContent =
        value + "%";


      if (
        reverbNode &&
        reverbNode.gainNode
      ) {

        reverbNode.gainNode.gain.value =
          value / 100;

      }

    }
  );


  $("masterVolume").addEventListener(
    "input",
    () => {

      const value =
        Number(
          $("masterVolume").value
        );


      $("masterValue")
        .textContent =
        value + "%";


      $("masterMixerValue")
        .textContent =
        value + "%";


      if (masterGain) {

        masterGain.gain.value =
          value / 100;

      }

    }
  );


  $("channelVolume").addEventListener(
    "input",
    () => {

      const value =
        Number(
          $("channelVolume").value
        );


      $("channelValue")
        .textContent =
        value + "%";


      if (channelGain) {

        channelGain.gain.value =
          isMuted
            ? 0
            : value / 100;

      }

    }
  );


  $("muteBtn").addEventListener(
    "click",
    () => {

      isMuted = !isMuted;


      const value =
        Number(
          $("channelVolume").value
        );


      if (channelGain) {

        channelGain.gain.value =
          isMuted
            ? 0
            : value / 100;

      }


      $("muteBtn").textContent =
        isMuted
          ? "UNMUTE"
          : "MUTE";

    }
  );

}


/* =========================================================
   RESET EQ
   ========================================================= */

function resetEQ() {

  document
    .querySelectorAll(".eqSlider")
    .forEach(
      (slider, index) => {

        slider.value = 0;

        const value =
          slider
            .parentElement
            .querySelector(
              ".eqValue"
            );


        if (value) {
          value.textContent =
            "0 dB";
        }


        if (eqFilters[index]) {

          eqFilters[index]
            .gain.value = 0;

        }

      }
    );

}


/* =========================================================
   PLAYLIST
   ========================================================= */

function renderPlaylist() {

  const container =
    $("playlist");


  container.innerHTML = "";


  if (playlist.length === 0) {

    container.innerHTML =
      `<div class="empty">
        Belum ada lagu.
      </div>`;

    return;

  }


  playlist.forEach(
    (track, index) => {

      const item =
        document.createElement("div");


      item.className =
        "playItem";


      if (
        index === currentIndex
      ) {

        item.classList.add(
          "active"
        );

      }


      item.innerHTML = `

        <span>
          ${escapeHTML(track.name)}
        </span>

        <button>
          ▶
        </button>

      `;


      item.addEventListener(
        "click",
        () => {

          loadPlaylistTrack(index);

        }
      );


      container.appendChild(item);

    }
  );

}


function loadPlaylistTrack(index) {

  if (
    !playlist[index]
  ) return;


  currentIndex = index;


  audio.src =
    playlist[index].url;


  audio.load();


  $("trackName").textContent =
    playlist[index].name;


  renderPlaylist();


  playAudio();

}


/* =========================================================
   YOUTUBE API KEY
   ========================================================= */

function loadSavedApiKey() {

  const key =
    localStorage.getItem(
      "avedow_youtube_key"
    );


  if (key) {

    $("apiKey").value =
      key;

  }

}


function saveApiKey() {

  const key =
    $("apiKey").value.trim();


  if (!key) {

    setStatus(
      "API Key masih kosong."
    );

    return;

  }


  localStorage.setItem(
    "avedow_youtube_key",
    key
  );


  setStatus(
    "API Key disimpan di perangkat ini."
  );

}


/* =========================================================
   YOUTUBE SEARCH
   ========================================================= */

async function searchYouTube() {

  const query =
    $("youtubeQuery")
      .value
      .trim();


  if (!query) {

    setStatus(
      "Masukkan nama lagu."
    );

    return;

  }


  const key =
    $("apiKey")
      .value
      .trim();


  if (!key) {

    setStatus(
      "Masukkan YouTube API Key terlebih dahulu."
    );

    return;

  }


  const results =
    $("youtubeResults");


  results.innerHTML =
    `<div class="empty">
      Mencari di YouTube...
    </div>`;


  try {

    const url =
      "https://www.googleapis.com/youtube/v3/search?" +
      new URLSearchParams({

        part: "snippet",

        q: query,

        type: "video",

        maxResults: "8",

        regionCode: "ID",

        relevanceLanguage: "id",

        safeSearch: "moderate",

        key: key

      });


    const response =
      await fetch(url);


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error?.message ||
        "YouTube API error"
      );

    }


    results.innerHTML = "";


    if (
      !data.items ||
      data.items.length === 0
    ) {

      results.innerHTML =
        `<div class="empty">
          Tidak ada hasil.
        </div>`;

      return;

    }


    data.items.forEach(
      item => {

        const videoId =
    
