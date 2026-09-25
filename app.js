"use strict";

/* =========================================================
   AVEDOW AUDIO ENGINE
   ========================================================= */

const audio = document.getElementById("audio");

const mp3Input = document.getElementById("mp3Input");
const playlistEl = document.getElementById("playlist");

const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const seekBar = document.getElementById("seekBar");

const trackName = document.getElementById("trackName");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");

const spectrum = document.getElementById("spectrum");

const meterL = document.getElementById("meterL");
const meterR = document.getElementById("meterR");

const engineStatus = document.getElementById("engineStatus");

let audioContext = null;
let source = null;

let inputGainNode = null;
let channelGainNode = null;

let eqNodes = [];

let compressorNode = null;
let pannerNode = null;

let delayNode = null;
let delayGainNode = null;

let reverbNode = null;
let reverbGainNode = null;

let masterGainNode = null;
let limiterNode = null;

let analyserNode = null;

let currentIndex = -1;

let songs = [];

let animationFrame = null;

let muted = false;
let previousMaster = 1;


/* =========================================================
   EQ FREQUENCIES
   ========================================================= */

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


/* =========================================================
   HELPERS
   ========================================================= */

function formatTime(seconds) {

  if (!Number.isFinite(seconds)) {
    return "00:00";
  }

  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);

  return (
    String(min).padStart(2, "0") +
    ":" +
    String(sec).padStart(2, "0")
  );
}


/* =========================================================
   CREATE AUDIO ENGINE
   ========================================================= */

function createAudioEngine() {

  if (audioContext) {
    return;
  }

  audioContext = new (
    window.AudioContext ||
    window.webkitAudioContext
  )();

  source = audioContext.createMediaElementSource(audio);

  inputGainNode = audioContext.createGain();
  channelGainNode = audioContext.createGain();

  compressorNode = audioContext.createDynamicsCompressor();

  pannerNode = audioContext.createStereoPanner();

  masterGainNode = audioContext.createGain();

  limiterNode = audioContext.createDynamicsCompressor();

  analyserNode = audioContext.createAnalyser();

  analyserNode.fftSize = 2048;
  analyserNode.smoothingTimeConstant = 0.82;


  /* INPUT */

  source.connect(inputGainNode);

  inputGainNode.connect(channelGainNode);


  /* EQ */

  let previousNode = channelGainNode;

  eqNodes = [];

  frequencies.forEach((frequency) => {

    const filter = audioContext.createBiquadFilter();

    filter.type = "peaking";

    filter.frequency.value = frequency;

    filter.Q.value = 1.1;

    filter.gain.value = 0;

    previousNode.connect(filter);

    previousNode = filter;

    eqNodes.push(filter);

  });


  /* COMPRESSOR */

  previousNode.connect(compressorNode);

  compressorNode.threshold.value = -24;
  compressorNode.knee.value = 20;
  compressorNode.ratio.value = 4;
  compressorNode.attack.value = 0.003;
  compressorNode.release.value = 0.25;


  /* PAN */

  compressorNode.connect(pannerNode);


  /* MAIN */

  pannerNode.connect(masterGainNode);


  /* DELAY */

  delayNode = audioContext.createDelay(2);

  delayGainNode = audioContext.createGain();

  delayNode.delayTime.value = 0.18;

  pannerNode.connect(delayNode);
  delayNode.connect(delayGainNode);
  delayGainNode.connect(masterGainNode);


  /* REVERB */

  reverbNode = audioContext.createConvolver();

  reverbGainNode = audioContext.createGain();

  reverbNode.buffer = createImpulseResponse();

  pannerNode.connect(reverbNode);
  reverbNode.connect(reverbGainNode);
  reverbGainNode.connect(masterGainNode);


  /* LIMITER */

  masterGainNode.connect(limiterNode);

  limiterNode.threshold.value = -1;
  limiterNode.knee.value = 0;
  limiterNode.ratio.value = 20;
  limiterNode.attack.value = 0.001;
  limiterNode.release.value = 0.08;


  /* ANALYSER */

  limiterNode.connect(analyserNode);

  analyserNode.connect(audioContext.destination);


  /* DEFAULTS */

  inputGainNode.gain.value = 1;
  channelGainNode.gain.value = 1;
  masterGainNode.gain.value = 1;

  delayGainNode.gain.value = 0;
  reverbGainNode.gain.value = 0;


  engineStatus.textContent = "AUDIO READY";
}


/* =========================================================
   IMPULSE RESPONSE
   ========================================================= */

function createImpulseResponse() {

  const length = audioContext.sampleRate * 2;

  const impulse = audioContext.createBuffer(
    2,
    length,
    audioContext.sampleRate
  );

  for (let channel = 0; channel < 2; channel++) {

    const data = impulse.getChannelData(channel);

    for (let i = 0; i < length; i++) {

      data[i] =
        (Math.random() * 2 - 1) *
        Math.pow(1 - i / length, 2.5);

    }
  }

  return impulse;
}


/* =========================================================
   RESUME AUDIO CONTEXT
   ========================================================= */

async function resumeAudio() {

  createAudioEngine();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}


/* =========================================================
   MP3 IMPORT
   ========================================================= */

mp3Input.addEventListener("change", function () {

  const files = Array.from(this.files || []);

  if (!files.length) {
    return;
  }

  files.forEach((file) => {

    if (!file.type.startsWith("audio/") &&
        !file.name.toLowerCase().endsWith(".mp3")) {
      return;
    }

    const url = URL.createObjectURL(file);

    songs.push({
      name: file.name,
      url: url,
      file: file
    });

  });

  renderPlaylist();

  if (currentIndex === -1 && songs.length > 0) {
    loadSong(0);
  }

  /*
    Reset input value.
    This is important because selecting the same MP3 again
    should trigger the change event.
  */
  this.value = "";

});


/* =========================================================
   RENDER PLAYLIST
   ========================================================= */

function renderPlaylist() {

  playlistEl.innerHTML = "";

  if (!songs.length) {

    playlistEl.innerHTML = `
      <div class="empty-playlist">
        <div class="empty-icon">♫</div>
        <div>Belum ada musik</div>
        <small>Tekan "Tambahkan MP3" untuk memasukkan lagu</small>
      </div>
    `;

    return;
  }


  songs.forEach((song, index) => {

    const item = document.createElement("div");

    item.className =
      "song" +
      (index === currentIndex ? " active" : "");


    item.innerHTML = `
      <div class="song-number">
        ${String(index + 1).padStart(2, "0")}
      </div>

      <div class="song-name" title="${escapeHTML(song.name)}">
        ${escapeHTML(song.name)}
      </div>

      <button class="song-play">
        ${index === currentIndex && !audio.paused ? "❚❚" : "▶"}
      </button>
    `;


    item.querySelector(".song-play").addEventListener(
      "click",
      async (event) => {

        event.stopPropagation();

        if (index === currentIndex) {

          await resumeAudio();

          if (audio.paused) {
            await audio.play();
          } else {
            audio.pause();
          }

        } else {

          loadSong(index);

          await resumeAudio();

          await audio.play();
        }

        renderPlaylist();
      }
    );


    item.addEventListener("click", () => {

      loadSong(index);

    });


    playlistEl.appendChild(item);

  });

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(text) {

  const div = document.createElement("div");

  div.textContent = text;

  return div.innerHTML;
}


/* =========================================================
   LOAD SONG
   ========================================================= */

function loadSong(index) {

  if (!songs[index]) {
    return;
  }

  currentIndex = index;

  audio.src = songs[index].url;

  audio.load();

  trackName.textContent = songs[index].name;

  seekBar.value = 0;

  currentTimeEl.textContent = "00:00";

  durationEl.textContent = "00:00";

  renderPlaylist();
}


/* =========================================================
   PLAY
   ========================================================= */

async function playCurrentSong() {

  if (!songs.length) {

    alert("Tambahkan MP3 terlebih dahulu.");

    return;
  }

  if (currentIndex === -1) {
    loadSong(0);
  }

  await resumeAudio();

  try {

    await audio.play();

  } catch (error) {

    console.error(error);

  }

  updatePlayButton();

  startSpectrum();
}


/* =========================================================
   PAUSE
   ========================================================= */

function pauseAudio() {

  audio.pause();

  updatePlayButton();

  renderPlaylist();
}


/* =========================================================
   STOP
   ========================================================= */

function stopAudio() {

  audio.pause();

  audio.currentTime = 0;

  updatePlayButton();

  seekBar.value = 0;

  currentTimeEl.textContent = "00:00";

  renderPlaylist();
}


/* =========================================================
   PLAY BUTTON
   ========================================================= */

playBtn.addEventListener("click", async () => {

  if (audio.paused) {

    await playCurrentSong();

  } else {

    pauseAudio();

  }

});


/* =========================================================
   STOP BUTTON
   ========================================================= */

stopBtn.addEventListener("click", () => {

  stopAudio();

});


/* =========================================================
   PREVIOUS
   ========================================================= */

prevBtn.addEventListener("click", async () => {

  if (!songs.length) {
    return;
  }

  let index = currentIndex - 1;

  if (index < 0) {
    index = songs.length - 1;
  }

  loadSong(index);

  await resumeAudio();

  await audio.play();

  updatePlayButton();

  startSpectrum();

  renderPlaylist();

});


/* =========================================================
   NEXT
   ========================================================= */

nextBtn.addEventListener("click", async () => {

  if (!songs.length) {
    return;
  }

  let index = currentIndex + 1;

  if (index >= songs.length) {
    index = 0;
  }

  loadSong(index);

  await resumeAudio();

  await audio.play();

  updatePlayButton();

  startSpectrum();

  renderPlaylist();

});


/* =========================================================
   AUDIO ENDED
   ========================================================= */

audio.addEventListener("ended", async () => {

  if (!songs.length) {
    return;
  }

  let next = currentIndex + 1;

  if (next >= songs.length) {
    next = 0;
  }

  loadSong(next);

  await resumeAudio();

  try {
    await audio.play();
  } catch (error) {
    console.error(error);
  }

});


/* =========================================================
   UPDATE PLAY BUTTON
   ========================================================= */

function updatePlayButton() {

  playBtn.textContent = audio.paused ? "▶" : "❚❚";

}


/* =========================================================
   TIME / SEEK
   ========================================================= */

audio.addEventListener("loadedmetadata", () => {

  durationEl.textContent = formatTime(audio.duration);

});


audio.addEventListener("timeupdate", () => {

  if (!Number.isFinite(audio.duration)) {
    return;
  }

  const percent =
    (audio.currentTime / audio.duration) * 100;

  seekBar.value = percent;

  currentTimeEl.textContent =
    formatTime(audio.currentTime);

});


seekBar.addEventListener("input", () => {

  if (!Number.isFinite(audio.duration)) {
    return;
  }

  audio.currentTime =
    (Number(seekBar.value) / 100) *
    audio.duration;

});


/* =========================================================
   EQ
   ========================================================= */

document.querySelectorAll(".eq-slider")
  .forEach((slider) => {

    slider.addEventListener("input", () => {

      const index =
        Number(slider.dataset.index);

      const value =
        Number(slider.value);

      document.getElementById(
        `eqValue${index}`
      ).textContent =
        `${value > 0 ? "+" : ""}${value} dB`;


      if (eqNodes[index]) {

        eqNodes[index].gain.value = value;

      }

    });

  });


/* =========================================================
   RESET EQ
   ========================================================= */

document.getElementById("resetEq")
  .addEventListener("click", () => {

    document.querySelectorAll(".eq-slider")
      .forEach((slider, index) => {

        slider.value = 0;

        document.getElementById(
          `eqValue${index}`
        ).textContent = "0 dB";

        if (eqNodes[index]) {
          eqNodes[index].gain.value = 0;
        }

      });

  });


/* =========================================================
   INPUT GAIN
   ========================================================= */

const inputGain = document.getElementById("inputGain");

inputGain.addEventListener("input", () => {

  const db = Number(inputGain.value);

  document.getElementById("inputGainValue")
    .textContent =
    `${db > 0 ? "+" : ""}${db} dB`;

  if (inputGainNode) {

    inputGainNode.gain.value =
      Math.pow(10, db / 20);

  }

});


/* =========================================================
   COMPRESSOR
   ========================================================= */

const compressor = document.getElementById("compressor");

compressor.addEventListener("input", () => {

  const value = Number(compressor.value);

  document.getElementById("compValue")
    .textContent = `${value} dB`;

  if (compressorNode) {

    compressorNode.threshold.value = value;

  }

});


/* =========================================================
   PAN
   ========================================================= */

const pan = document.getElementById("pan");

pan.addEventListener("input", () => {

  const value = Number(pan.value);

  let text = "CENTER";

  if (value < -0.05) {
    text = `L ${Math.round(Math.abs(value) * 100)}%`;
  }

  if (value > 0.05) {
    text = `R ${Math.round(value * 100)}%`;
  }

  document.getElementById("panValue")
    .textContent = text;

  if (pannerNode) {
    pannerNode.pan.value = value;
  }

});


/* =========================================================
   DELAY
   ========================================================= */

const delay = document.getElementById("delay");

delay.addEventListener("input", () => {

  const value = Number(delay.value);

  document.getElementById("delayValue")
    .textContent = `${value}%`;

  if (delayGainNode) {

    delayGainNode.gain.value =
      value / 100 * 0.45;

  }

});


/* =========================================================
   REVERB
   ========================================================= */

const reverb = document.getElementById("reverb");

reverb.addEventListener("input", () => {

  const value = Number(reverb.value);

  document.getElementById("reverbValue")
    .textContent = `${value}%`;

  if (reverbGainNode) {

    reverbGainNode.gain.value =
      value / 100 * 0.5;

  }

});


/* =========================================================
   MASTER
   ========================================================= */

const master = document.getElementById("master");

master.addEventListener("input", () => {

  const value = Number(master.value);

  document.getElementById("masterValue")
    .textContent = `${value}%`;

  if (masterGainNode && !muted) {

    masterGainNode.gain.value =
      value / 100;

  }

});


/* =========================================================
   MUTE
   ========================================================= */

document.getElementById("muteBtn")
  .addEventListener("click", () => {

    if (!masterGainNode) {
      createAudioEngine();
    }

    muted = !muted;

    const muteBtn =
      document.getElementById("muteBtn");


    if (muted) {

      previousMaster =
        masterGainNode.gain.value;

      masterGainNode.gain.value = 0;

      muteBtn.textContent = "🔇 UNMUTE";

    } else {

      masterGainNode.gain.value =
        previousMaster;

      muteBtn.textContent = "🔊 MUTE";

    }

  });


/* =========================================================
   THEME
   ========================================================= */

document.getElementById("themeBtn")
  .addEventListener("click", () => {

    document.body.classList.toggle("light");

  });


/* =========================================================
   RESET ALL
   ========================================================= */

document.getElementById("resetAll")
  .addEventListener("click", () => {

    /* EQ */

    document.querySelectorAll(".eq-slider")
      .forEach((slider, index) => {

        slider.value = 0;

        document.getElementById(
          `eqValue${index}`
        ).textContent = "0 dB";

        if (eqNodes[index]) {
          eqNodes[index].gain.value = 0;
        }

      });


    /* INPUT */

    inputGain.value = 0;

    document.getElementById("inputGainValue")
      .textContent = "0 dB";

    if (inputGainNode) {
      inputGainNode.gain.value = 1;
    }


    /* COMP */

    compressor.value = -24;

    document.getElementById("compValue")
      .textContent = "-24 dB";

    if (compressorNode) {
      compressorNode.threshold.value = -24;
    }


    /* PAN */

    pan.value = 0;

    document.getElementById("panValue")
      .textContent = "CENTER";

    if (pannerNode) {
      pannerNode.pan.value = 0;
    }


    /* DELAY */

    delay.value = 0;

    document.getElementById("delayValue")
      .textContent = "0%";

    if (delayGainNode) {
      delayGainNode.gain.value = 0;
    }


    /* REVERB */

    reverb.value = 0;

    document.getElementById("reverbValue")
      .textContent = "0%";

    if (reverbGainNode) {
      reverbGainNode.gain.value = 0;
    }


    /* MASTER */

    master.value = 100;

    document.getElementById("masterValue")
      .textContent = "100%";

    muted = false;

    document.getElementById("muteBtn")
      .textContent = "🔊 MUTE";

    if (masterGainNode) {
      masterGainNode.gain.value = 1;
    }

  });


/* =========================================================
   SPECTRUM
   ========================================================= */

function resizeSpectrum() {

  const rect =
    spectrum.getBoundingClientRect();

  const ratio =
    window.devicePixelRatio || 1;

  spectrum.width =
    rect.width * ratio;

  spectrum.height =
    rect.height * ratio;

}


window.addEventListener(
  "resize",
  resizeSpectrum
);


function startSpectrum() {

  if (!analyserNode) {
    return;
  }

  resizeSpectrum();

  if (animationFrame) {
    return;
  }

  drawSpectrum();

}


function drawSpectrum() {

  if (!analyserNode) {
    animationFrame = null;
    return;
  }

  animationFrame =
    requestAnimationFrame(drawSpectrum);


  const ctx =
    spectrum.getContext("2d");

  const width =
    spectrum.width;

  const height =
    spectrum.height;


  const data =
    new Ui
