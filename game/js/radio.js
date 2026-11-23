// radio.js: Solara Cove's radio — three stations of fully procedural
// WebAudio music (no audio files, no network): a step sequencer playing
// chord stabs, bass and hats through oscillators. R cycles stations.
export const STATIONS = [
  {
    name: 'SOLARA FM 88.1',
    track: 'Golden Hour Drive',
    tempo: 96, root: 220.0,
    chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 8], [5, 9, 12, 15]],
    bass: [0, 0, -4, 5],
    wave: 'triangle',
  },
  {
    name: 'HARBOR ROCK 101.3',
    track: 'Cannery Nights',
    tempo: 128, root: 164.81,
    chords: [[0, 3, 7], [5, 8, 12], [-2, 2, 5], [3, 7, 10]],
    bass: [0, 5, -2, 3],
    wave: 'sawtooth',
  },
  {
    name: 'NIGHT DRIVE 94.7',
    track: 'Neon Tide',
    tempo: 112, root: 196.0,
    chords: [[0, 3, 7, 12], [-5, -2, 2, 5], [-3, 0, 3, 7], [2, 5, 9, 12]],
    bass: [0, -5, -3, 2],
    wave: 'sine',
  },
];

function semitone(root, n) {
  return root * Math.pow(2, n / 12);
}

export function createRadio() {
  return {
    stationIndex: 0,
    name: STATIONS[0].name,
    track: STATIONS[0].track,
    ctx: null,
    master: null,
    step: 0,
    nextTime: 0,
    started: false,
  };
}

export function ensureAudio(radio) {
  if (radio.ctx) {
    if (radio.ctx.state === 'suspended') radio.ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    radio.ctx = new AC();
    radio.master = radio.ctx.createGain();
    radio.master.gain.value = 0.16;
    radio.master.connect(radio.ctx.destination);
    radio.nextTime = radio.ctx.currentTime + 0.1;
    radio.started = true;
  } catch (e) {
    radio.ctx = null;
  }
}

export function setStation(radio, index) {
  radio.stationIndex = ((index % STATIONS.length) + STATIONS.length) % STATIONS.length;
  const s = STATIONS[radio.stationIndex];
  radio.name = s.name;
  radio.track = s.track;
  radio.step = 0;
  return s;
}

function playNote(radio, freq, time, dur, type, gain) {
  const osc = radio.ctx.createOscillator();
  const g = radio.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(g);
  g.connect(radio.master);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

function playHat(radio, time) {
  const len = Math.floor(radio.ctx.sampleRate * 0.03);
  const buf = radio.ctx.createBuffer(1, len, radio.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = radio.ctx.createBufferSource();
  src.buffer = buf;
  const g = radio.ctx.createGain();
  g.gain.value = 0.12;
  src.connect(g);
  g.connect(radio.master);
  src.start(time);
}

export function radioTick(radio) {
  if (!radio.ctx || radio.ctx.state !== 'running') return;
  const station = STATIONS[radio.stationIndex];
  const stepDur = 60 / station.tempo / 2; // eighth notes
  while (radio.nextTime < radio.ctx.currentTime + 0.25) {
    const step = radio.step;
    const bar = Math.floor(step / 8) % station.chords.length;
    const chord = station.chords[bar];
    const t = radio.nextTime;
    if (step % 2 === 0) {
      for (const n of chord) playNote(radio, semitone(station.root, n), t, stepDur * 1.8, station.wave, 0.1);
    }
    if (step % 4 === 0) {
      playNote(radio, semitone(station.root / 2, station.bass[bar]), t, stepDur * 3.5, 'sine', 0.22);
    }
    if (step % 2 === 1) playHat(radio, t);
    radio.step++;
    radio.nextTime += stepDur;
  }
}
