"use strict";

/*
===========================================================
AVEDOW AUDIO MIXER
MP3 + 10 BAND EQ + DSP + SPECTRUM + MIXER
===========================================================
*/


/* ========================================================
   ELEMENT HELPER
======================================================== */

const $ = id => document.getElementById(id);


/* ========================================================
   AUDIO
======================================================== */

const audio = new Audio();

audio.preload = "metadata";

let ctx = null;

let source = null;

let inputGain = null;

let channelGain = null;

let eqFilters = [];

let compressor = null;

let panner = null;

let masterGain = null;

let analyser = null;

let delay = null;

let delayFeedback = null;

let reverb = null;

let reverbGain = null;

let limiter = null;

let audioReady = false;

let muted = false;

let animationFrame = null;


/* ========================================================
   PLAYLIST
======================================================== */

const tracks = [];

let currentTrack = -1;


/* ========================================================
   EQ FREQUENCIES
======================================================== */

const frequencies = [
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


/* ========================================================
   START
======================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    buildEQ();

    setupControls();

    drawSpectrum();

    setStatus(
      "Siap. Pilih file MP3 untuk mulai."
    );

  }
);


/* ========================================================
   AUDIO ENGINE
======================================================== */

function createAudioEngine() {

  if (audioReady) {
    return;
  }


  try {

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;


    if (!AudioContext) {

      throw new Error(
        "Browser tidak mendukung Web Audio."
      );

    }


    ctx = new AudioContext();


    source =
      ctx.createMediaElementSource(
        audio
      );


    inputGain =
      ctx.createGain();


    channelGain =
      ctx.createGain();


    compressor =
      ctx.createDynamicsCompressor();


    panner =
      ctx.createStereoPanner();


    masterGain =
      ctx.createGain();


    analyser =
      ctx.createAnalyser();


    delay =
      ctx.createDelay(1);


    delayFeedback =
      ctx.createGain();


    limiter =
      ctx.createDynamicsCompressor();


    /* =========================
       ANALYZER
    ========================= */

    analyser.fftSize = 2048;

    analyser.smoothingTimeConstant =
      0.78;


    /* =========================
       INITIAL GAIN
    ========================= */

    inputGain.gain.value = 1;

    channelGain.gain.value = 1;

    masterGain.gain.value = 1;


    /* =========================
       COMPRESSOR
    ========================= */

    compressor.threshold.value = 0;

    compressor.knee.value = 20;

    compressor.ratio.value = 1;

    compressor.attack.value = 0.01;

    compressor.release.value = 0.15;


    /* =========================
       LIMITER
    ========================= */

    limiter.threshold.value = -3;

    limiter.knee.value = 0;

    limiter.ratio.value = 20;

    limiter.attack.value = 0.001;

    limiter.release.value = 0.08;


    /* =========================
       DELAY
    ========================= */

    delay.delayTime.value = 0.18;

    delayFeedback.gain.value = 0;


    /* =========================
       EQ
    ========================= */

    eqFilters =
      frequencies.map(
        frequency => {

          const filter =
            ctx.createBiquadFilter();


          filter.type =
            "peaking";


          filter.frequency.value =
            frequency;


          filter.Q.value = 1;


          filter.gain.value = 0;


          return filter;

        }
      );


    /* =========================
       REVERB
    ========================= */

    createReverb();


    /* =========================
       MAIN SIGNAL
       
       source
         ↓
       inputGain
         ↓
       channelGain
         ↓
       EQ
         ↓
       compressor
         ↓
       panner
         ↓
       master
         ↓
       limiter
         ↓
       analyser
         ↓
       speaker
    ========================= */


    source.connect(
      inputGain
    );


    inputGain.connect(
      channelGain
    );


    let node =
      channelGain;


    eqFilters.forEach(
      filter => {

        node.connect(filter);

        node = filter;

      }
    );


    node.connect(
      compressor
    );


    compressor.connect(
      panner
    );


    panner.connect(
      masterGain
    );


    /* =========================
       DELAY FX
    ========================= */

    panner.connect(
      delay
    );


    delay.connect(
      delayFeedback
    );


    delayFeedback.connect(
      delay
    );


    delay.connect(
      masterGain
    );


    /* =========================
       REVERB FX
    ========================= */

    panner.connect(
      reverb
    );


    reverb.connect(
      reverbGain
    );


    reverbGain.connect(
      masterGain
    );


    /* =========================
       OUTPUT
    ========================= */

    masterGain.connect(
      limiter
    );


    limiter.connect(
      analyser
    );


    analyser.connect(
      ctx.destination
    );


    audioReady = true;


    setStatus(
      "Audio engine siap."
    );

  }

  catch (error) {

    console.error(error);

    setStatus(
      "Audio engine error: " +
      error.message
    );

  }

}


/* ========================================================
   REVERB
======================================================== */

function createReverb() {

  const seconds = 2.2;

  const length =
    Math.floor(
      ctx.sampleRate * seconds
    );


  const buffer =
    ctx.createBuffer(
      2,
      length,
      ctx.sampleRate
    );


  for (
    let channel = 0;
    channel < 2;
    channel++
  ) {

    const data =
      buffer.getChannelData(
        channel
      );


    for (
      let i = 0;
      i < length;
      i++
    ) {

      const decay =
        Math.pow(
          1 - i / length,
          2.8
        );


      data[i] =
        (
          Math.random() * 2 - 1
        ) * decay;

    }

  }


  reverb =
    ctx.createConvolver();


  reverb.buffer =
    buffer;


  reverbGain =
    ctx.createGain();


  reverbGain.gain.value = 0;

}


/* ========================================================
   BUILD EQ
======================================================== */

function buildEQ() {

  const container =
    $("eqContainer");


  container.innerHTML = "";


  frequencies.forEach(
    (frequency, index) => {

      const band =
        document.createElement(
          "div"
        );


      band.className =
        "eq-band";


      const frequencyLabel =
        document.createElement(
          "div"
        );


      frequencyLabel.className =
        "eq-frequency";


      frequencyLabel.textContent =
        formatFrequency(
          frequency
        );


      const sliderWrap =
        document.createElement(
          "div"
        );


      sliderWrap.className =
        "eq-slider-wrap";


      const slider =
        document.createElement(
          "input"
        );


      slider.type = "range";

      slider.className =
        "eq-slider";


      slider.min = -12;

      slider.max = 12;

      slider.step = 0.1;

      slider.value = 0;


      const value =
        document.createElement(
          "div"
        );


      value.className =
        "eq-value";


      value.textContent =
        "0 dB";


      slider.addEventListener(
        "input",
        () => {

          const db =
            Number(
              slider.value
            );


          value.textContent =
            db.toFixed(1) +
            " dB";


          if (
            eqFilters[index]
          ) {

            eqFilters[index]
              .gain.value = db;

          }

        }
      );


      sliderWrap.appendChild(
        slider
      );


      band.appendChild(
        frequencyLabel
      );


      band.appendChild(
        sliderWrap
      );


      band.appendChild(
        value
      );


      container.appendChild(
        band
      );

    }
  );

}


function formatFrequency(
  frequency
) {

  if (frequency >= 1000) {

    return (
      frequency / 1000 +
      "kHz"
    );

  }

  return frequency + "Hz";

}


/* ========================================================
   LOAD MP3
======================================================== */

function loadFile(file) {

  if (!file) {
    return;
  }


  createAudioEngine();


  const url =
    URL.createObjectURL(file);


  audio.pause();


  audio.src = url;

  audio.load();


  tracks.push({
    name: file.name,
    url: url
  });


  currentTrack =
    tracks.length - 1;


  $("trackName").textContent =
    file.name;


  renderPlaylist();


  setStatus(
    "MP3 siap. Tekan PLAY."
  );


  $("seekBar").value = 0;

}


/* ========================================================
   PLAY
======================================================== */

async function playAudio() {

  if (!audio.src) {

    setStatus(
      "Pilih MP3 terlebih dahulu."
    );

    return;

  }


  createAudioEngine();


  try {

    if (
      ctx.state ===
      "suspended"
    ) {

      await ctx.resume();

    }


    await audio.play();


    $("playBtn").textContent =
      "▶ PLAYING";


    setStatus(
      "Sedang diputar."
    );


    startSpectrum();

  }

  catch (error) {

    console.error(error);

    setStatus(
      "Gagal memutar: " +
      error.message
    );

  }

}


/* ========================================================
   PAUSE
======================================================== */

function pauseAudio() {

  audio.pause();


  $("playBtn").textContent =
    "▶ PLAY";


  setStatus(
    "Pause."
  );

}


/* ========================================================
   STOP
======================================================== */

function stopAudio() {

  audio.pause();


  try {

    audio.currentTime = 0;

  }

  catch (_) {}


  $("seekBar").value = 0;


  $("currentTime").textContent =
    "00:00";


  $("playBtn").textContent =
    "▶ PLAY";


  setStatus(
    "Stop."
  );

}


/* ========================================================
   TIME
======================================================== */

function updateTime() {

  if (
    !isFinite(audio.duration) ||
    audio.duration <= 0
  ) {

    return;

  }


  const percentage =
    (
      audio.currentTime /
      audio.duration
    ) * 100;


  $("seekBar").value =
    percentage;


  $("currentTime").textContent =
    formatTime(
      audio.currentTime
    );


  $("duration").textContent =
    formatTime(
      audio.duration
    );

}


function seekAudio() {

  if (
    !isFinite(audio.duration)
  ) {

    return;

  }


  const percent =
    Number(
      $("seekBar").value
    );


  audio.currentTime =
    (
      percent / 100
    ) *
    audio.duration;

}


function formatTime(seconds) {

  if (
    !isFinite(seconds) ||
    seconds < 0
  ) {

    return "00:00";

  }


  const minutes =
    Math.floor(
      seconds / 60
    );


  const secs =
    Math.floor(
      seconds % 60
    );


  return (
    String(minutes)
      .padStart(2, "0") +
    ":" +
    String(secs)
      .padStart(2, "0")
  );

}


/* ========================================================
   SPECTRUM
======================================================== */

function startSpectrum() {

  if (animationFrame) {
    return;
  }


  const canvas =
    $("spectrum");


  const ctx2d =
    canvas.getContext("2d");


  const data =
    new Uint8Array(
      analyser.frequencyBinCount
    );


  function resize() {

    const ratio =
      window.devicePixelRatio ||
      1;


    canvas.width =
      canvas.clientWidth *
      ratio;


    canvas.height =
      canvas.clientHeight *
      ratio;


    ctx2d.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );

  }


  resize();


  window.addEventListener(
    "resize",
    resize
  );


  function draw() {

    animationFrame =
      requestAnimationFrame(
        draw
      );


    const width =
      canvas.clientWidth;


    const height =
      canvas.clientHeight;


    ctx2d.clearRect(
      0,
      0,
      width,
      height
    );


    ctx2d.fillStyle =
      "#05070a";


    ctx2d.fillRect(
      0,
      0,
      width,
      height
    );


    analyser.getByteFrequencyData(
      data
    );


    const bars = 70;


    const step =
      Math.max(
        1,
        Math.floor(
          data.length / bars
        )
      );


    const barWidth =
      width / bars;


    let peak = 0;


    for (
      let i = 0;
      i < bars;
      i++
    ) {

      const value =
        data[i * step] || 0;


      peak =
        Math.max(
          peak,
          value
        );


      const barHeight =
        (
          value / 255
        ) *
        height *
        .9;


      const x =
        i * barWidth;


      const y =
        height -
        barHeight;


      const gradient =
        ctx2d.createLinearGradient(
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
        "#278cff"
      );


      gradient.addColorStop(
        1,
        "#ff3d8a"
      );


      ctx2d.fillStyle =
        gradient;


      ctx2d.fillRect(
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
      peak > 0
        ? 20 *
          Math.log10(
            peak / 255
          )
        : -Infinity;


    $("peakValue").textContent =
      db === -Infinity
        ? "-∞ dB"
        : db.toFixed(1) +
          " dB";


    const level =
      peak / 255;


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


/* ========================================================
   DSP
======================================================== */

function setupControls() {

  /* -------------------------
     FILE
  ------------------------- */

  $("fileInput")
    .addEventListener(
      "change",
      event => {

        const file =
          event.target.files[0];


        loadFile(file);

      }
    );


  /* -------------------------
     PLAY
  ------------------------- */

  $("playBtn")
    .addEventListener(
      "click",
      playAudio
    );


  /* -------------------------
     PAUSE
  ------------------------- */

  $("pauseBtn")
    .addEventListener(
      "click",
      pauseAudio
    );


  /* -------------------------
     STOP
  ------------------------- */

  $("stopBtn")
    .addEventListener(
      "click",
      stopAudio
    );


  /* -------------------------
     SEEK
  ------------------------- */

  $("seekBar")
    .addEventListener(
      "input",
      seekAudio
    );


  /* -------------------------
     GAIN
  ------------------------- */

  $("gain")
    .addEventListener(
      "input",
      event => {

        const db =
          Number(
            event.target.value
          );


        $("gainValue").textContent =
          db.toFixed(1) +
          " dB";


        if (inputGain) {

          inputGain.gain.value =
            Math.pow(
              10,
              db / 20
            );

        }

      }
    );


  /* -------------------------
     COMPRESSOR
  ------------------------- */

  $("compressor")
    .addEventListener(
      "input",
      event => {

        const amount =
          Number(
            event.target.value
          );


        $("compressorValue")
          .textContent =
          amount + "%";


        if (compressor) {

          compressor.threshold.value =
            -amount * .45;


          compressor.ratio.value =
            1 +
            amount * .09;

        }

      }
    );


  /* -------------------------
     PAN
  ------------------------- */

  $("pan")
    .addEventListener(
      "input",
      event => {

        const value =
          Number(
            event.target.value
          );


        $("panValue").textContent =
          value.toFixed(2);


        if (panner) {

          panner.pan.value =
            value;

        }

      }
    );


  /* -------------------------
     DELAY
  ------------------------- */

  $("delay")
    .addEventListener(
      "input",
      event => {

        const amount =
          Number(
            event.target.value
          );


        $("delayValue")
          .textContent =
          amount + "%";


        if (delayFeedback) {

          delayFeedback.gain.value =
            (
              amount / 100
            ) * .55;

        }

      }
    );


  /* -------------------------
     REVERB
  ------------------------- */

  $("reverb")
    .addEventListener(
      "input",
      event => {

        const amount =
          Number(
            event.target.value
          );


        $("reverbValue")
          .textContent =
          amount + "%";


        if (reverbGain) {

          reverbGain.gain.value =
            amount / 100;

        }

      }
    );


  /* -------------------------
     MASTER
  ------------------------- */

  $("masterVolume")
    .addEventListener(
      "input",
      event => {

        const amount =
          Number(
            event.target.value
          );


        $("masterValue")
          .textContent =
          amount + "%";


        $("masterMixerValue")
          .textContent =
          amount + "%";


        if (masterGain) {

          masterGain.gain.value =
            amount / 100;

        }

      }
    );


  /* -------------------------
     CHANNEL VOLUME
  ------------------------- */

  $("channelVolume")
    .addEventListener(
      "input",
      event => {

        const amount =
          Number(
            event.target.value
          );


        $("channelValue")
          .textContent =
          amount + "%";


        if (channelGain) {

          channelGain.gain.value =
            muted
              ? 0
              : amount / 100;

        }

      }
    );


  /* -------------------------
     MUTE
  ------------------------- */

  $("muteBtn")
    .addEventListener(
      "click",
      () => {

        muted =
          !muted;


        const button =
          $("muteBtn");


        const volume =
          Number(
            $("channelVolume")
              .value
          );


        if (channelGain) {

          channelGain.gain.value =
            muted
              ? 0
              : volume / 100;

        }


        button.classList.toggle(
          "active",
          muted
        );


        button.textContent =
          muted
            ? "UNMUTE"
            : "MUTE";

      }
    );


  /* -------------------------
     RESET EQ
  ------------------------- */

  $("resetEqBtn")
    .addEventListener(
      "click",
      resetEQ
    );


  /* -------------------------
     THEME
  ------------------------- */

  $("themeBtn")
    .addEventListener(
      "click",
      () => {

        document.body
          .classList.toggle(
            "light"
          );

      }
    );


  /* -------------------------
     RESET ALL
  ------------------------- */

  $("resetBtn")
    .addEventListener(
    
