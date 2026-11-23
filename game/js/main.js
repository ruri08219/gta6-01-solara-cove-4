// main.js: Solara Cove's heart — the game loop, keyboard + mouse input,
// the chase camera, the player on foot and behind the wheel, and the
// wiring that ties city, traffic, police, missions, combat, HUD, radio,
// crew and saves into one playable game.
import * as THREE from 'three';
import { buildCity, districtAt, clampToCity } from './city.js';
import {
  spawnTraffic, updateTraffic, spawnParkedCars, drivePlayerCar, nearestStealableCar,
  collideWithBuildings, onRoadSpeedBonus, CAR_MODELS,
} from './vehicles.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, updatePolice, addHeat, coolDown } from './police.js';
import {
  createMissions, currentJob, currentStage, updateMissions, advanceStage,
  markerPosition, JOBS,
} from './missions.js';
import {
  createCombat, fireWeapon, switchWeapon, buildTargets, linkTargetRefs, WEAPONS,
} from './combat.js';
import { createHud, updateHud, setDialogue, showToast } from './hud.js';
import { createRadio, ensureAudio, setStation, radioTick } from './radio.js';
import { saveGame, loadGame, hasSave, applySave } from './savegame.js';
import { createCrew, useAbility, updateCrewCooldowns, nitroActive, rankFor } from './crew.js';
import { createEffects, spawnExplosion, spawnMuzzle, spawnSparks, updateEffects } from './effects.js';
import { installDebugHooks } from './debug.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

// --- world -----------------------------------------------------------------
const city = buildCity(scene);
const sun = scene.children.find((c) => c.isDirectionalLight);
let traffic = spawnTraffic(scene, city, 22);
let parkedCars = spawnParkedCars(scene, city, 14);
const peds = spawnPedestrians(scene, city, 26);
const police = createPolice(scene, city);
const effects = createEffects(scene);

// --- player figure ---------------------------------------------------------
function makePlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.44, 1.15, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a9e8a }),
  );
  jacket.position.y = 1.0;
  group.add(jacket);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8a878 }),
  );
  head.position.y = 1.85;
  group.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  );
  hair.position.y = 1.9;
  group.add(hair);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x22223a });
  for (const lx of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), legMat);
    leg.position.set(lx, 0.28, 0);
    leg.name = 'leg';
    group.add(leg);
  }
  return group;
}
const playerMesh = makePlayerMesh();
scene.add(playerMesh);

// --- mission marker beacon ---------------------------------------------------
const beacon = new THREE.Group();
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(1.6, 1.6, 60, 10, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
);
beam.position.y = 30;
beacon.add(beam);
const beaconRing = new THREE.Mesh(
  new THREE.TorusGeometry(5, 0.35, 8, 24),
  new THREE.MeshBasicMaterial({ color: 0xffd23f }),
);
beaconRing.rotation.x = Math.PI / 2;
beaconRing.position.y = 0.4;
beacon.add(beaconRing);
scene.add(beacon);

// --- state -------------------------------------------------------------------
const state = {
  mode: 'menu', // menu | playing | paused | busted
  cash: 1200,
  respect: 0,
  respectRank: 'NOBODY',
  health: 100,
  armor: 0,
  playTime: 0,
  player: {
    pos: new THREE.Vector3(30, 0, 60),
    heading: Math.PI,
    onFoot: true,
    vehicle: null,
    walkSpeed: 0,
    mesh: playerMesh,
  },
  missions: null,
  police,
  combat: createCombat(scene),
  crew: createCrew(),
  radio: createRadio(),
  traffic,
  parkedCars,
  peds,
  enforcers: [],
  missionTarget: null,
  camYaw: Math.PI,
  camPitch: 0.32,
  cinematic: null,
  shake: 0,
  bustedTimer: 0,
  lastDamageAt: -99,
  gunfireFlash: 0,
  frame: 0,
  errors: [],
};
state.missions = createMissions(state);
const hud = createHud();

// --- input -------------------------------------------------------------------
const keys = {};
const input = { forward: false, back: false, left: false, right: false, handbrake: false };
let mouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (state.mode !== 'playing') return;
  if (e.code === 'KeyE') stealOrExitCar();
  if (e.code === 'KeyP') doSave();
  if (e.code === 'KeyR') {
    const s = setStation(state.radio, state.radio.stationIndex + 1);
    showToast(`${s.name} — ${s.track}`);
  }
  if (e.code === 'Digit1') { switchWeapon(state.combat, 0); showToast('FISTS'); }
  if (e.code === 'Digit2') { switchWeapon(state.combat, 1); showToast('PISTOL — click to fire'); }
  if (e.code === 'Digit3') { switchWeapon(state.combat, 2); showToast('SMG — hold click to fire'); }
  if (e.code === 'KeyZ') crewAbility('dax');
  if (e.code === 'KeyX') crewAbility('iris');
  if (e.code === 'KeyC') crewAbility('bram');
  if (e.code === 'Escape') pauseGame();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousedown', (e) => {
  mouseDown = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  if (state.mode === 'playing') tryShoot();
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('mousemove', (e) => {
  if (!mouseDown || state.mode !== 'playing') return;
  state.camYaw -= (e.clientX - lastMouseX) * 0.005;
  state.camPitch = Math.max(0.08, Math.min(0.9, state.camPitch + (e.clientY - lastMouseY) * 0.003));
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function readInput() {
  input.forward = !!(keys.KeyW || keys.ArrowUp);
  input.back = !!(keys.KeyS || keys.ArrowDown);
  input.left = !!(keys.KeyA || keys.ArrowLeft);
  input.right = !!(keys.KeyD || keys.ArrowRight);
  input.handbrake = !!keys.Space;
}

// --- crew abilities ----------------------------------------------------------
function crewAbility(key) {
  const line = useAbility(state.crew, key, state);
  if (line) setDialogue(key === 'dax' ? 'DAX' : key === 'iris' ? 'IRIS' : 'BRAM', line);
}

// --- cars: steal / enter / exit ------------------------------------------------
function stealOrExitCar() {
  const p = state.player;
  if (p.vehicle) {
    // step out beside the car
    const car = p.vehicle;
    car.occupied = false;
    car.speed = 0;
    p.vehicle = null;
    p.onFoot = true;
    p.mesh.visible = true;
    p.pos.set(car.mesh.position.x + Math.sin(car.heading + Math.PI / 2) * 3, 0, car.mesh.position.z + Math.cos(car.heading + Math.PI / 2) * 3);
    p.heading = car.heading;
    showToast('Out of the car');
    return;
  }
  const allCars = [...state.parkedCars, ...state.traffic];
  const car = nearestStealableCar(p.pos, allCars, 5.5);
  if (!car) { showToast('No car in reach — get closer'); return; }
  car.occupied = true;
  car.stolen = true;
  const wasTraffic = state.traffic.includes(car);
  if (wasTraffic) {
    state.traffic = state.traffic.filter((c) => c !== car);
    state.parkedCars.push(car);
  }
  car.parked = false;
  p.vehicle = car;
  p.onFoot = false;
  p.mesh.visible = false;
  addHeat(police, 12, 'Grand theft auto');
  showToast(`You stole the ${car.model.name} — Solara PD is on it`);
  setDialogue('MARA', `This ${car.model.name} is mine now. Let's see what she can do.`);
}

// --- shooting ------------------------------------------------------------------
function tryShoot() {
  if (state.mode !== 'playing') return;
  const targets = buildTargets(state.peds, police.cars, state.enforcers);
  linkTargetRefs(targets);
  const report = fireWeapon(state.combat, camera, targets, 0);
  handleShot(report);
}

function handleShot(report) {
  if (!report) return;
  if (report.dry) { showToast('Out of ammo — switch weapon (1/2/3)'); return; }
  const weapon = report.weapon;
  state.gunfireFlash = 0.06;
  addHeat(police, weapon.name === 'FISTS' ? 0 : 6, 'Shots fired');
  for (const ped of state.peds) ped.panic = Math.max(ped.panic, 2);
  if (report.pos) {
    spawnMuzzle(effects, report.pos.clone ? report.pos.clone() : report.pos);
    if (report.hit) spawnSparks(effects, report.pos);
  }
  if (report.hit && report.target) {
    if (report.target.kind === 'enforcer' && report.killed) {
      state.missions.killsThisStage++;
      showToast(`Enforcer down — ${state.missions.killsThisStage} / 3`);
    }
    if (report.target.kind === 'police' && report.killed) {
      addHeat(police, 10, 'Officer down');
    }
    if (report.target.kind === 'pedestrian' && report.killed) {
      addHeat(police, 15, 'Pedestrian down');
    }
  }
}

// --- enforcers (job 7) ---------------------------------------------------------
function spawnEnforcers() {
  clearEnforcers();
  for (let i = 0; i < 3; i++) {
    const mesh = makePlayerMesh();
    mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x8a1a1a });
    mesh.position.set(-380 + (i - 1) * 8, 0, 270 + i * 6);
    scene.add(mesh);
    state.enforcers.push({ mesh, hp: 70, alive: true, shootTimer: 1 + i * 0.4 });
  }
  setDialogue('BRAM', 'Three of them, by the crates. Take them down, Mara — I\'ll cover the bag.');
}

function clearEnforcers() {
  for (const e of state.enforcers) scene.remove(e.mesh);
  state.enforcers = [];
}

function updateEnforcers(dt) {
  for (const e of state.enforcers) {
    if (!e.alive) continue;
    const d = Math.hypot(e.mesh.position.x - state.player.pos.x, e.mesh.position.z - state.player.pos.z);
    e.mesh.lookAt(state.player.pos.x, 0, state.player.pos.z);
    if (d < 45 && state.mode === 'playing') {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 0.9;
        damagePlayer(6);
        spawnMuzzle(effects, e.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)));
      }
    }
  }
}

// --- damage / busted -----------------------------------------------------------
function damagePlayer(amount) {
  const absorbed = Math.min(state.armor, amount);
  state.armor -= absorbed;
  state.health -= (amount - absorbed);
  state.lastDamageAt = state.playTime;
  state.shake = Math.min(1, state.shake + 0.4);
  if (state.health <= 0) busted('You got taken down. Solara PD scraped you off the pavement.');
}

function busted(text) {
  if (state.mode === 'busted') return;
  state.mode = 'busted';
  state.cash = Math.floor(state.cash / 2);
  document.getElementById('gameover-text').textContent = `${text} Half your cash is gone.`;
  document.getElementById('gameover-screen').classList.remove('hidden');
  showToast('BUSTED');
}

function respawn() {
  state.health = 100;
  state.armor = 0;
  police.heat = 0;
  police.wanted = 0;
  for (const car of police.cars) scene.remove(car.mesh);
  police.cars = [];
  police.heliActive = false;
  police.heli.visible = false;
  if (state.player.vehicle) {
    state.player.vehicle.occupied = false;
    state.player.vehicle = null;
  }
  state.player.onFoot = true;
  state.player.mesh.visible = true;
  state.player.pos.set(30, 0, 60);
  state.player.heading = Math.PI;
  state.camYaw = Math.PI;
  state.mode = 'playing';
  document.getElementById('gameover-screen').classList.add('hidden');
  setDialogue('MARA', 'Back on my feet. The cove doesn\'t keep me down — not today.');
}

// --- missions wiring -------------------------------------------------------------
function missionEvent(type, payload) {
  const m = state.missions;
  if (type === 'jobStart') {
    const job = payload;
    const stage = job.stages[0];
    setDialogue(stage.say[0], stage.say[1]);
    showToast(`JOB ${m.jobIndex + 1}/8: ${job.title} — $${job.payout.toLocaleString()}`);
  }
  if (type === 'stageStart') {
    const stage = payload;
    setDialogue(stage.say[0], stage.say[1]);
    if (stage.killsNeeded) spawnEnforcers();
  }
  if (type === 'jobDone') {
    showToast(`JOB COMPLETE — ${payload.title} +$${payload.payout.toLocaleString()}`);
    setDialogue('MARA', `Job done. $${payload.payout.toLocaleString()} in the pocket.`);
    doSave();
  }
  if (type === 'storyDone') {
    showToast('STORY COMPLETE — SOLARA SUNRISE! You made it out.');
    setDialogue('MARA', 'Eight jobs. One sunrise. The cove is behind us now.');
    doSave();
  }
}

function updateBeacon(dt) {
  const target = markerPosition(state.missions);
  if (!target || state.missions.done) {
    beacon.visible = false;
    state.missionTarget = null;
    return;
  }
  beacon.visible = true;
  beacon.position.set(target.x, 0, target.z);
  beaconRing.scale.setScalar(1 + Math.sin(state.playTime * 3) * 0.12);
  state.missionTarget = target;
}

// --- save ----------------------------------------------------------------------
function doSave() {
  const ok = saveGame(state);
  showToast(ok ? 'Game saved — progress kept' : 'Save failed (storage blocked)');
}

// --- screens ---------------------------------------------------------------------
function startGame(fromSave) {
  if (fromSave) {
    const data = loadGame();
    if (data) {
      applySave(state, data);
      setStation(state.radio, data.radioStation || 0);
    }
  }
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('continue-button').style.display = 'none';
  state.mode = 'playing';
  ensureAudio(state.radio);
  const stage = currentStage(state.missions);
  if (stage) setDialogue(stage.say[0], stage.say[1]);
  showToast(fromSave ? 'Save loaded — welcome back to the cove' : 'JOB 1/8: First Light — reach Marina Bay');
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  document.getElementById('pause-screen').classList.remove('hidden');
}

function resumeGame() {
  state.mode = 'playing';
  document.getElementById('pause-screen').classList.add('hidden');
}

document.getElementById('start-button').addEventListener('click', () => startGame(false));
document.getElementById('continue-button').addEventListener('click', () => startGame(true));
document.getElementById('resume-button').addEventListener('click', resumeGame);
document.getElementById('save-button').addEventListener('click', () => { doSave(); resumeGame(); });
document.getElementById('restart-button').addEventListener('click', () => {
  document.getElementById('pause-screen').classList.add('hidden');
  location.reload();
});
document.getElementById('retry-button').addEventListener('click', respawn);
if (hasSave()) document.getElementById('continue-button').style.display = 'inline-block';
document.getElementById('loading-note').textContent = 'Cove loaded. Press START THE RUN.';

// --- camera ----------------------------------------------------------------------
function updateCamera(dt) {
  if (state.cinematic) {
    camera.position.set(state.cinematic.x, state.cinematic.y, state.cinematic.z);
    camera.lookAt(state.cinematic.tx, state.cinematic.ty, state.cinematic.tz);
    return;
  }
  const p = state.player;
  const inCar = !!p.vehicle;
  const dist = inCar ? 11.5 : 7.5;
  const height = inCar ? 4.6 : 3.4;
  if (inCar && Math.abs(p.vehicle.speed) > 4) {
    // chase feel: the camera swings behind the car's heading
    let diff = p.heading - state.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.camYaw += diff * Math.min(1, dt * 1.6);
  }
  const cx = p.pos.x - Math.sin(state.camYaw) * dist;
  const cz = p.pos.z - Math.cos(state.camYaw) * dist;
  const k = 1 - Math.exp(-dt * 6);
  camera.position.x += (cx - camera.position.x) * k;
  camera.position.y += (height - camera.position.y) * k;
  camera.position.z += (cz - camera.position.z) * k;
  const lookX = p.pos.x + Math.sin(state.camYaw) * 8;
  const lookZ = p.pos.z + Math.cos(state.camYaw) * 8;
  camera.lookAt(lookX, 2.0, lookZ);
  const speed = p.vehicle ? Math.abs(p.vehicle.speed) : p.walkSpeed;
  const targetFov = 62 + Math.min(12, speed * 0.35);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
  camera.updateProjectionMatrix();
  if (state.shake > 0) {
    state.shake = Math.max(0, state.shake - dt * 2);
    camera.position.x += (Math.random() - 0.5) * state.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.4;
  }
}

// --- main loop ---------------------------------------------------------------------
const clock = new THREE.Clock();
let lastHud = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  state.frame++;
  if (state.mode === 'playing') {
    state.playTime += dt;
    readInput();
    const p = state.player;
    // --- driving / walking
    if (p.vehicle) {
      const car = p.vehicle;
      const nitro = nitroActive(state.crew, state.playTime);
      const kmh = drivePlayerCar(dt, car, input, nitro);
      const roadFactor = onRoadSpeedBonus(car.mesh.position.x, car.mesh.position.z);
      if (roadFactor < 1) car.speed *= (1 - 0.35 * dt);
      const hit = collideWithBuildings(car.mesh.position, 2.4, city.colliders);
      if (hit && Math.abs(car.speed) > 8) {
        car.condition -= 3;
        car.speed *= 0.45;
        state.shake = Math.min(1, state.shake + 0.5);
        spawnSparks(effects, car.mesh.position.clone());
        if (car.condition <= 0) {
          spawnExplosion(effects, car.mesh.position.clone(), true);
          addHeat(police, 10, 'Vehicle fire');
          p.vehicle = null;
          p.onFoot = true;
          p.mesh.visible = true;
          p.pos.copy(car.mesh.position);
          scene.remove(car.mesh);
          state.parkedCars = state.parkedCars.filter((c) => c !== car);
          setDialogue('MARA', 'She\'s done. On foot it is — the cove provides.');
        }
      }
      const clamped = clampToCity(car.mesh.position.x, car.mesh.position.z, 8);
      car.mesh.position.x = clamped.x;
      car.mesh.position.z = clamped.z;
      p.pos.copy(car.mesh.position);
      p.heading = car.heading;
      p.walkSpeed = 0;
      // running over a pedestrian is a crime
      for (const ped of state.peds) {
        if (!ped.alive) continue;
        const d = Math.hypot(ped.mesh.position.x - car.mesh.position.x, ped.mesh.position.z - car.mesh.position.z);
        if (d < 2.6 && Math.abs(car.speed) > 4) {
          ped.alive = false;
          ped.mesh.visible = false;
          addHeat(police, 15, 'Pedestrian down');
          showToast('You hit a pedestrian — Solara PD noticed');
        }
      }
      // police ramming the player's car dents it
      for (const pc of police.cars) {
        const d = Math.hypot(pc.mesh.position.x - car.mesh.position.x, pc.mesh.position.z - car.mesh.position.z);
        if (d < 4.2) {
          car.condition -= 8 * dt;
          car.speed *= (1 - 0.8 * dt);
        }
      }
    } else {
      // on foot
      const speed = keys.ShiftLeft || keys.ShiftRight ? 10 : 6;
      let mx = 0;
      let mz = 0;
      if (input.forward) { mx += Math.sin(state.camYaw); mz += Math.cos(state.camYaw); }
      if (input.back) { mx -= Math.sin(state.camYaw); mz -= Math.cos(state.camYaw); }
      if (input.left) { mx -= Math.cos(state.camYaw); mz += Math.sin(state.camYaw); }
      if (input.right) { mx += Math.cos(state.camYaw); mz -= Math.sin(state.camYaw); }
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        mx /= len; mz /= len;
        p.pos.x += mx * speed * dt;
        p.pos.z += mz * speed * dt;
        const want = Math.atan2(mx, mz);
        let diff = want - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += Math.max(-8 * dt, Math.min(8 * dt, diff));
        p.walkSpeed = speed;
      } else {
        p.walkSpeed = 0;
      }
      collideWithBuildings(p.pos, 0.8, city.colliders);
      const clamped = clampToCity(p.pos.x, p.pos.z, 8);
      p.pos.x = clamped.x;
      p.pos.z = clamped.z;
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = p.heading;
      // walk cycle
      const swing = Math.sin(state.playTime * 10) * (p.walkSpeed > 0 ? 0.5 : 0);
      for (const child of p.mesh.children) {
        if (child.name === 'leg') child.rotation.x = swing * (child.position.x < 0 ? 1 : -1);
      }
      // busted: a patrol car touches the player on foot
      let touched = false;
      for (const pc of police.cars) {
        const d = Math.hypot(pc.mesh.position.x - p.pos.x, pc.mesh.position.z - p.pos.z);
        if (d < 3.5) touched = true;
      }
      if (touched) {
        state.bustedTimer += dt;
        if (state.bustedTimer > 1.6) busted('Solara PD caught you on foot.');
      } else {
        state.bustedTimer = 0;
      }
    }
    // --- world systems
    updateTraffic(dt, state.traffic, city, state.player.pos);
    updatePedestrians(dt, state.peds, city, state.player.pos, state.gunfireFlash > 0);
    updatePolice(dt, police, state.player.pos, state.player.vehicle ? Math.abs(state.player.vehicle.speed) : state.player.walkSpeed);
    updateEnforcers(dt);
    updateMissions(dt, state.missions, state.player.pos, missionEvent);
    updateBeacon(dt);
    updateEffects(dt, effects);
    updateCrewCooldowns(state.crew, dt);
    radioTick(state.radio);
    state.respectRank = rankFor(state.respect);
    // wanted heat cools when no unit is near
    const nearestUnit = police.cars.reduce((m, c) => Math.min(m, Math.hypot(c.mesh.position.x - state.player.pos.x, c.mesh.position.z - state.player.pos.z)), Infinity);
    coolDown(police, dt, nearestUnit > 45 && !police.heliActive);
    // health regen while clear
    if (police.wanted === 0 && state.health < 100 && state.playTime - state.lastDamageAt > 8) {
      state.health = Math.min(100, state.health + 2 * dt);
    }
    if (state.gunfireFlash > 0) state.gunfireFlash -= dt;
    // auto fire for SMG while held
    if (mouseDown && state.combat.weaponIndex === 2) {
      const targets = buildTargets(state.peds, police.cars, state.enforcers);
      linkTargetRefs(targets);
      handleShot(fireWeapon(state.combat, camera, targets, dt));
    }
    // HUD at ~15 Hz
    if (state.playTime - lastHud > 0.066) {
      lastHud = state.playTime;
      updateHud(hud, state);
    }
  }
  // lighthouse lamp pulse + sea shimmer, even in the menu
  const lamp = scene.getObjectByName('lighthouseLamp');
  if (lamp) lamp.material.color.setHex(Math.floor(state.playTime * 2) % 2 === 0 ? 0xfff2b0 : 0xffe08a);
  if (state.mode === 'menu') {
    // slow establishing orbit over Palm Court while the menu is up
    const t = performance.now() / 1000;
    camera.position.set(Math.sin(t * 0.05) * 160, 55, Math.cos(t * 0.05) * 160);
    camera.lookAt(0, 0, 0);
  } else {
    updateCamera(dt);
  }
  renderer.render(scene, camera);
  if (!window.__solara) installDebugHooks(debugApi);
  if (window.__solara) window.__solara.ready = true;
}

// --- debug API (used by the screenshot / playtest driver) --------------------------
const debugApi = {
  getState: () => ({
    mode: state.mode,
    cash: Math.floor(state.cash),
    respect: state.respect,
    respectRank: state.respectRank,
    job: state.missions.jobIndex + 1,
    jobTitle: state.missions.done ? 'DONE' : currentJob(state.missions).title,
    stage: state.missions.stageIndex + 1,
    wanted: police.wanted,
    health: Math.round(state.health),
    armor: Math.round(state.armor),
    vehicle: state.player.vehicle ? state.player.vehicle.model.name : null,
    pos: { x: Math.round(state.player.pos.x), z: Math.round(state.player.pos.z) },
    heading: state.player.heading,
    district: districtAt(state.player.pos.x, state.player.pos.z).name,
    policeCars: police.cars.length,
    heli: police.heliActive,
    roadblocks: police.roadblocks.length,
    traffic: state.traffic.length,
    pedsAlive: state.peds.filter((p) => p.alive).length,
    kills: state.combat.kills,
    radio: state.radio.name,
    errors: window.__solara ? window.__solara.errors : [],
  }),
  startGame: () => startGame(false),
  setWanted: (stars) => {
    const heat = stars <= 0 ? 0 : [0, 10, 30, 50, 70, 90][Math.min(5, stars)];
    police.heat = heat;
    police.wanted = stars;
  },
  startJob: (i) => {
    state.missions.jobIndex = Math.max(0, Math.min(7, i - 1));
    state.missions.stageIndex = 0;
    state.missions.killsThisStage = 0;
    clearEnforcers();
    missionEvent('jobStart', currentJob(state.missions));
  },
  teleport: (x, z) => {
    state.player.pos.set(x, 0, z);
    if (state.player.vehicle) {
      state.player.vehicle.mesh.position.set(x, 0, z);
    } else {
      state.player.mesh.position.set(x, 0, z);
    }
  },
  enterNearestCar: () => stealOrExitCar(),
  stealNearestCar: () => {
    if (state.player.vehicle) return state.player.vehicle.model.name;
    stealOrExitCar();
    return state.player.vehicle ? state.player.vehicle.model.name : null;
  },
  giveWeapon: (i) => {
    switchWeapon(state.combat, i);
    state.combat.ammo[i] = 999;
    return WEAPONS[i].name;
  },
  shoot: () => {
    const targets = buildTargets(state.peds, police.cars, state.enforcers);
    linkTargetRefs(targets);
    const report = fireWeapon(state.combat, camera, targets, 0);
    handleShot(report);
    return report ? { hit: !!report.hit, weapon: report.weapon.name, killed: !!report.killed } : null;
  },
  save: () => { doSave(); return loadGame() !== null; },
  loadSaveState: () => loadGame(),
  setTimeOfDay: (t) => {
    // t 0 = morning, 0.5 = noon, 1 = golden hour
    const warm = Math.max(0, t - 0.5) * 2;
    if (sun) {
      sun.color.setHex(warm > 0.5 ? 0xffc878 : 0xffe8b0);
      sun.position.set(180 - warm * 120, 320 - warm * 180, 120);
    }
    scene.background = new THREE.Color().setHSL(0.58 - warm * 0.06, 0.55, 0.72 - warm * 0.18);
  },
  cinematic: (x, y, z, tx, ty, tz) => {
    state.cinematic = { x, y, z, tx, ty, tz };
  },
  releaseCamera: () => { state.cinematic = null; },
  spawnPolice: (n) => {
    police.heat = Math.max(police.heat, 55);
    police.wanted = Math.max(police.wanted, 3);
  },
};

installDebugHooks(debugApi);
animate();
