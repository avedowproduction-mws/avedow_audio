/*
  AVEDOW AUDIO MIXER
  Web Audio Engine
*/


const $ = id =>
  document.getElementById(id);



/* =========================
   EQUALIZER
========================= */

const frequencies = [
  31,
  62,
  125,
  250,
  500,
  1000,
  2000,
  4000,
  8000,
  16000
];


const presets = {

  flat:
    [0,0,0,0,0,0,0,0,0,0],

  bass:
    [6,5,4,3,2,1,0,-1,-1,0],

  vocal:
    [-2,-1,0,2,4,5,4,2,0,-1],

  treble:
    [-1,-1,0,0,0,1,2,4,5,6],

  loud:
    [4,3,2,1,0,1,2,3,4,4]

};



const eqContainer =
  $("eq");


frequencies.forEach(
  (frequency,index) => {

    const band =
      document.createElement("div");

    band.className =
      "eqBand";


    const label =
      frequency >= 1000
      ? frequency / 1000 + "k"
      : frequency;


    band.innerHTML = `

      <b>${label}</b>

      <input
        class="eqSlider"
        data-index="${index}"
        type="range"
        min="-12"
        max="12"
        step="0.1"
        value="0"
      >

      <output>
        0 dB
      </output>

    `;


    eqContainer.appendChild(band);

  }
);



/* =========================
   AUDIO ENGINE
========================= */

let audioContext = null;

let audioElement = null;

let source = null;

let analyser = null;

let masterGain = null;

let channelGain = null;

let compressor = null;

let panner = null;

let filters = [];

let tracks = [];

let currentTrack = -1;

let muted = false;



function createAudioEngine() {

  if(audioContext)
    return;


  audioContext =
    new (
      window.AudioContext ||
      window.webkitAudioContext
    )();


  analyser =
    audioContext.createAnalyser();


  analyser.fftSize = 2048;

  analyser.smoothingTimeConstant =
    0.85;


  channelGain =
    audioContext.createGain();


  masterGain =
    audioContext.createGain();


  compressor =
    audioContext.createDynamicsCompressor();


  panner =
    audioContext.createStereoPanner();


  filters =
    frequencies.map(

      frequency => {

        const filter =
          audioContext.createBiquadFilter();

        filter.type =
          "peaking";

        filter.frequency.value =
          frequency;

        filter.Q.value =
          1.1;

        filter.gain.value =
          0;

        return filter;

      }

    );


  let node =
    channelGain;


  filters.forEach(
    filter => {

      node.connect(filter);

      node = filter;

    }
  );


  node
    .connect(compressor)
    .connect(panner)
    .connect(masterGain)
    .connect(analyser)
    .connect(
      audioContext.destination
    );


  masterGain.gain.value =
    $("masterVolume").value;

}



function createAudioElement() {

  if(audioElement)
    return;


  audioElement =
    new Audio();


  audioElement.crossOrigin =
    "anonymous";


  audioElement.preload =
    "metadata";


  audioElement.addEventListener(
    "timeupdate",
    updateTime
  );


  audioElement.addEventListener(
    "ended",
    nextTrack
  );


  source =
    audioContext
      .createMediaElementSource(
        audioElement
      );


  source.connect(channelGain);

}



/* =========================
   PLAYLIST
========================= */

$("fileInput").addEventListener(
  "change",
  event => {

    const files =
      [...event.target.files];


    files.forEach(file => {

      const url =
        URL.createObjectURL(file);


      tracks.push({

        name: file.name,

        url: url

      });

    });


    renderPlaylist();


    if(
      currentTrack === -1 &&
      tracks.length
    ) {

      loadTrack(0);

    }

  }
);



function renderPlaylist() {

  const playlist =
    $("playlist");


  playlist.innerHTML = "";


  tracks.forEach(
    (track,index) => {

      const item =
        document.createElement("div");


      item.className =
        "track";


      if(index === currentTrack)
        item.classList.add("active");


      item.innerHTML = `

        <strong>
          ${escapeHTML(track.name)}
        </strong>

        <small>
          TRACK ${index + 1}
        </small>

      `;


      item.onclick = () => {

        loadTrack(index);

        playAudio();

      };


      playlist.appendChild(item);

    }
  );

}



function escapeHTML(text) {

  return text.replace(
    /[&<>"']/g,
    char => ({

      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"

    }[char])
  );

}



/* =========================
   LOAD TRACK
========================= */

function loadTrack(index) {

  createAudioEngine();

  createAudioElement();


  currentTrack =
    index;


  audioElement.src =
    tracks[index].url;


  audioElement.load();


  $("trackName").textContent =
    tracks[index].name;


  renderPlaylist();

}



/* =========================
   PLAY
========================= */

function playAudio() {

  if(!tracks.length)
    return;


  if(currentTrack === -1)
    loadTrack(0);


  createAudioEngine();

  createAudioElement();


  audioContext.resume();


  audioElement.play();


  $("playBtn").textContent =
    "❚❚ PAUSE";

}



/* =========================
   PAUSE
========================= */

function pauseAudio() {

  if(!audioElement)
    return;


  audioElement.pause();


  $("playBtn").textContent =
    "▶ PLAY";

}



/* =========================
   NEXT
========================= */

function nextTrack() {

  if(!tracks.length)
    return;


  const next =
    (currentTrack + 1)
    % tracks.length;


  loadTrack(next);

  playAudio();

}



/* =========================
   PLAYER BUTTONS
========================= */

$("playBtn").onclick = () => {

  if(
    audioElement &&
    !audioElement.paused
  ) {

    pauseAudio();

  } else {

    playAudio();

  }

};



$("stopBtn").onclick = () => {

  if(!audioElement)
    return;


  audioElement.pause();

  audioElement.currentTime = 0;

  $("playBtn").textContent =
    "▶ PLAY";

};



/* =========================
   TIME
========================= */

function updateTime() {

  if(!audioElement)
    return;


  const current =
    formatTime(
      audioElement.currentTime
    );


  const duration =
    formatTime(
      audioElement.duration
    );


  $("time").textContent =
    current + " / " + duration;

}



function formatTime(seconds) {

  if(!isFinite(seconds))
    return "00:00";


  const minutes =
    Math.floor(seconds / 60);


  const sec =
    Math.floor(seconds % 60);


  return (
    String(minutes).padStart(2,"0")
    + ":" +
    String(sec).padStart(2,"0")
  );

}



/* =========================
   MASTER
========================= */

$("masterVolume").oninput =
  event => {

    const value =
      Number(event.target.value);


    if(masterGain)
      masterGain.gain.value =
        value;


    $("masterValue").textContent =
      Math.round(value * 100)
      + "%";

  };



/* =========================
   CHANNEL
========================= */

$("channelVolume").oninput =
  event => {

    const value =
      Number(event.target.value);


    if(channelGain && !muted)
      channelGain.gain.value =
        value;


    $("channelValue").textContent =
      Math.round(value * 100)
      + "%";

  };



/* =========================
   MUTE
========================= */

$("muteBtn").onclick = () => {

  muted = !muted;


  if(channelGain) {

    channelGain.gain.value =
      muted
      ? 0
      : Number(
          $("channelVolume").value
        );

  }


  $("muteBtn").textContent =
    muted
    ? "UNMUTE"
    : "MUTE";

};



/* =========================
   GAIN
========================= */

$("gain").oninput =
  event => {

    const db =
      Number(event.target.value);


    const linear =
      Math.pow(10,db / 20);


    if(channelGain && !muted) {

      channelGain.gain.value =
        linear *
        Number(
          $("channelVolume").value
        );

    }


    $("gainValue").textContent =
      db.toFixed(1)
      + " dB";

  };



/* =========================
   COMPRESSOR
========================= */

$("compressor").oninput =
  event => {

    const value =
      Number(event.target.value);


    if(compressor) {

      compressor.threshold.value =
        -24 * value;

      compressor.ratio.value =
        1 + 11 * value;

      compressor.attack.value =
        0.003;

      compressor.release.value =
        0.25;

    }


    $("compressorValue").textContent =
      Math.round(value * 100)
      + "%";

  };



/* =========================
   PAN
========================= */

$("pan").oninput =
  event => {

    const value =
      Number(event.target.value);


    if(panner)
      panner.pan.value =
        value;


    if(value === 0) {

      $("panValue").textContent =
        "CENTER";

    }

    else if(value < 0) {

      $("panValue").textContent =
        "LEFT " +
        Math.round(-value * 100)
        + "%";

    }

    else {

      $("panValue").textContent =
        "RIGHT " +
        Math.round(value * 100)
        + "%";

    }

  };



/* =========================
   REVERB / DELAY UI
========================= */

$("reverb").oninput =
  event => {

    $("reverbValue").textContent =
      Math.round(
        event.target.value * 100
      )
      + "%";

  };


$("delay").oninput =
  event => {

    $("delayValue").textContent =
      Math.round(
        event.target.value * 100
      )
      + "%";

  };



/* =========================
   EQ
========================= */

document
  .querySelectorAll(".eqSlider")
  .forEach(slider => {

    slider.oninput =
      event => {

        const index =
          Number(
            event.target.dataset.index
          );


        const value =
          Number(event.target.value);


        if(filters[index]) {

          filters[index].gain.value =
            value;

        }


        event.target
          .nextElementSibling
          .textContent =
          value.toFixed(1)
          + " dB";

      };

  });



/* =========================
   EQ PRESETS
========================= */

document
  .querySelectorAll("[data-preset]")
  .forEach(button => {

    button.onclick = () => {

      const values =
        presets[
          button.dataset.preset
        ];


      document
        .querySelectorAll(".eqSlider")
        .forEach(
          (slider,index) => {

            slider.value =
              values[index];


            slider
              .nextElementSibling
              .textContent =
              values[index]
              + " dB";


            if(filters[index]) {

              filters[index]
                .gain.value =
                values[index];

            }

          }
        );

    };

  });



/* =========================
   YOUTUBE
========================= */

$("youtubeBtn").onclick =
  () => {

    const input =
      $("youtubeURL").value.trim();


    let id = "";


    try {

      const url =
        new URL(input);


      if(
        url.hostname.includes(
          "youtu.be"
        )
      ) {

        id =
          url.pathname.substring(1);

      }

      else {

        id =
          url.searchParams.get("v");

      }

    }

    catch {

      alert(
        "URL YouTube tidak valid."
      );

      return;

    }


    if(!id) {

      alert(
        "Video YouTube tidak ditemukan."
      );

      return;

    }


    $("youtubePlayer").innerHTML = `

      <iframe

        src="https://www.youtube.com/embed/${encodeURIComponent(id)}"

        allow="
          autoplay;
          encrypted-media;
          picture-in-picture
        "

        allowfullscreen>

      </iframe>

    `;

  };



/* =========================
   SPECTRUM ANALYZER
========================= */

const canvas =
  $("spectrum");


const ctx =
  canvas.getContext("2d");


function drawSpectrum() {

  requestAnimationFrame(
    drawSpectrum
  );


  const width =
    canvas.clientWidth *
    devicePixelRatio;


  const height =
    canvas.clientHeight *
    devicePixelRatio;


  if(
    canvas.width !== width ||
    canvas.height !== height
  ) {

    canvas.width = width;

    canvas.height = height;

  }


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  ctx.fillStyle =
    "#030507";


  ctx.fillRect(
    0,
    0,
    width,
    height
  );


  if(!analyser)
    return;


  const data =
    new Uint8Array(
      analyser.frequencyBinCount
    );


  analyser.getByteFrequencyData(
    data
  );


  const bars = 80;


  const step =
    Math.floor(
      data.length / bars
    );


  const barWidth =
    width / bars;


  let peak = 0;


  for(
    let i = 0;
    i < bars;
    i++
  ) {

    let value = 0;


    for(
      let j = 0;
      j < step;
      j++
    ) {

      value =
        Math.max(
          value,
          data[
            i * step + j
          ] || 0
        );

    }


    peak =
      Math.max(
        peak,
        value
      );


    const barHeight =
      value / 255 *
      height *
      0.9;


    ctx.fillStyle =
      i > bars * 0.72
      ? "#20e3a2"
      : "#249cff";


    ctx.fillRect(

      i * barWidth,

      height - barHeight,

      Math.max(
        1,
        barWidth - 2
      ),

      barHeight

    );

  }


  const db =
    peak === 0
    ? "-∞"
    : (
        -60 +
        peak / 255 * 60
      ).toFixed(1);


  $("peak").textContent =
    "PEAK " + db + " dB";


  $("meterL").style.height =
    Math.min(
      100,
      peak / 255 * 100
    ) + "%";


  $("meterR").style.height =
    Math.min(
      100,
      peak / 255 * 100
    ) + "%";

}


drawSpectrum();



/* =========================
   THEME
========================= */

$("themeBtn").onclick =
  () => {

    document.body
      .classList
      .toggle("light");

  };



/* =========================
   RESET
========================= */

$("resetBtn").onclick =
  () => {

    location.reload();

  };
