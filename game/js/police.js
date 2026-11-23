// police.js: Solara PD — the wanted stars, the patrol cars that chase,
// the roadblocks that close streets, and Air One, the helicopter with
// its spotlight cone.
import * as THREE from 'three';
import { createCar, CAR_MODELS } from './vehicles.js';
import { randomRoadPoint } from './city.js';

export const WANTED_LABELS = ['CLEAR', 'SUSPECT', 'PURSUIT', 'MANHUNT', 'LOCKDOWN', 'AIR ONE'];

const UNIT_NAMES = [
  'Unit 12', 'Unit 07', 'Unit 23', 'Unit 31', 'Unit 44', 'Unit 09',
  'Unit 18', 'Unit 52', 'Unit 60', 'Unit 77', 'Unit 85', 'Unit 91',
];

function makeHelicopter() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.4, 5),
    new THREE.MeshLambertMaterial({ color: 0x1a2a44 }),
  );
  group.add(body);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 4.5),
    new THREE.MeshLambertMaterial({ color: 0x1a2a44 }),
  );
  tail.position.set(0, 0.3, -4.2);
  group.add(tail);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x222222 }),
  );
  rotor.position.y = 1;
  rotor.name = 'rotor';
  group.add(rotor);
  const search = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
  );
  search.position.set(0, -0.9, 2);
  group.add(search);
  // the spotlight cone: a translucent cone from the belly to the street
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(9, 42, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  cone.rotation.x = Math.PI;
  cone.position.y = -22;
  cone.name = 'spotCone';
  group.add(cone);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(9, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -42.5;
  pool.name = 'spotPool';
  group.add(pool);
  return group;
}

export function createPolice(scene, city) {
  const heli = makeHelicopter();
  heli.visible = false;
  scene.add(heli);
  return {
    scene, city,
    wanted: 0,
    heat: 0,            // 0..100, drives star changes
    cars: [],
    heli,
    heliActive: false,
    roadblocks: [],
    unitCounter: 0,
    dispatchLog: [],
    sirenPhase: 0,
  };
}

export function addHeat(police, amount, reason) {
  police.heat = Math.max(0, Math.min(100, police.heat + amount));
  const stars = police.heat <= 2 ? 0
    : police.heat <= 18 ? 1
    : police.heat <= 38 ? 2
    : police.heat <= 60 ? 3
    : police.heat <= 82 ? 4 : 5;
  if (stars !== police.wanted) {
    police.wanted = stars;
    police.dispatchLog.unshift(`WANTED ${stars} STAR${stars === 1 ? '' : 'S'} — ${reason}`);
    if (police.dispatchLog.length > 6) police.dispatchLog.pop();
  }
  return police.wanted;
}

export function coolDown(police, dt, hidden) {
  // heat bleeds off slowly; faster when the player is out of sight
  police.heat = Math.max(0, police.heat - dt * (hidden ? 2.2 : 0.7));
  const stars = police.heat <= 2 ? 0
    : police.heat <= 18 ? 1
    : police.heat <= 38 ? 2
    : police.heat <= 60 ? 3
    : police.heat <= 82 ? 4 : 5;
  if (stars < police.wanted) police.wanted = stars;
}

function spawnPoliceCar(police, near) {
  const model = CAR_MODELS[1];
  const p = randomRoadPoint(police.city.rng);
  const car = createCar(model, p.x, p.z, 0, true);
  car.speed = 0;
  car.unitName = UNIT_NAMES[police.unitCounter % UNIT_NAMES.length];
  police.unitCounter++;
  car.status = 'RESPONDING';
  police.scene.add(car.mesh);
  police.cars.push(car);
  police.dispatchLog.unshift(`${car.unitName} dispatched — responding`);
  if (police.dispatchLog.length > 6) police.dispatchLog.pop();
  return car;
}

function spawnRoadblock(police, playerPos) {
  const angle = police.city.rng() * Math.PI * 2;
  const bx = playerPos.x + Math.sin(angle) * 55;
  const bz = playerPos.z + Math.cos(angle) * 55;
  const group = new THREE.Group();
  for (let i = -1; i <= 1; i++) {
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.1, 0.8),
      new THREE.MeshLambertMaterial({ color: 0xff7a2a }),
    );
    barrier.position.set(i * 3.4, 0.55, 0);
    group.add(barrier);
  }
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.4, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  sign.position.set(0, 1.6, 0);
  group.add(sign);
  group.position.set(bx, 0, bz);
  group.rotation.y = angle;
  police.scene.add(group);
  police.roadblocks.push({ group, x: bx, z: bz, life: 45 });
  police.dispatchLog.unshift('ROADBLOCK set — street closed ahead');
  if (police.dispatchLog.length > 6) police.dispatchLog.pop();
}

export function updatePolice(dt, police, playerPos, playerSpeed) {
  const wanted = police.wanted;
  const wantCars = wanted === 0 ? 0 : Math.min(1 + wanted, 6);
  // spawn / despawn patrol cars to match the wanted level
  while (police.cars.length < wantCars) spawnPoliceCar(police, playerPos);
  if (police.cars.length > wantCars) {
    const gone = police.cars.pop();
    police.scene.remove(gone.mesh);
    police.dispatchLog.unshift(`${gone.unitName} stood down`);
  }
  // roadblocks at 3+ stars, at most two at once
  if (wanted >= 3 && police.roadblocks.length < 2 && police.city.rng() < dt * 0.12) {
    spawnRoadblock(police, playerPos);
  }
  for (let i = police.roadblocks.length - 1; i >= 0; i--) {
    const rb = police.roadblocks[i];
    rb.life -= dt;
    if (rb.life <= 0) {
      police.scene.remove(rb.group);
      police.roadblocks.splice(i, 1);
    }
  }
  // chase: each unit steers at the player, faster than traffic
  for (const car of police.cars) {
    const dx = playerPos.x - car.mesh.position.x;
    const dz = playerPos.z - car.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    car.status = dist < 12 ? 'ON SCENE' : dist < 60 ? 'PURSUIT' : 'EN ROUTE';
    const want = Math.atan2(dx, dz);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const topSpeed = 30 + wanted * 3.5;
    const target = Math.min(topSpeed, dist * 0.55 + 12);
    car.speed += Math.max(-22 * dt, Math.min(22 * dt, target - car.speed));
    car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
    car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    // siren light bar flashes red / blue
    police.sirenPhase += dt * 9;
    const bar = car.mesh.getObjectByName('lightBar');
    if (bar) {
      bar.material.color.setHex(Math.floor(police.sirenPhase) % 2 === 0 ? 0xff2222 : 0x2266ff);
    }
    // ramming the player slows them and dents the car
    if (dist < 4.5 && playerSpeed > 2) {
      car.speed *= 0.6;
    }
  }
  // Air One: 4+ stars, hovers above the player, spotlight pinned on them
  const wantHeli = wanted >= 4;
  if (wantHeli && !police.heliActive) {
    police.heliActive = true;
    police.heli.visible = true;
    police.heli.position.set(playerPos.x, 44, playerPos.z - 30);
    police.dispatchLog.unshift('AIR ONE airborne — spotlight on suspect');
  }
  if (!wantHeli && police.heliActive) {
    police.heliActive = false;
    police.heli.visible = false;
    police.dispatchLog.unshift('AIR ONE returning to base');
  }
  if (police.heliActive) {
    const hx = playerPos.x + Math.sin(police.sirenPhase * 0.11) * 12;
    const hz = playerPos.z + Math.cos(police.sirenPhase * 0.09) * 12;
    police.heli.position.x += (hx - police.heli.position.x) * Math.min(1, dt * 1.2);
    police.heli.position.z += (hz - police.heli.position.z) * Math.min(1, dt * 1.2);
    police.heli.position.y = 44 + Math.sin(police.sirenPhase * 0.3) * 2;
    const rotor = police.heli.getObjectByName('rotor');
    if (rotor) rotor.rotation.y += dt * 22;
    const pool = police.heli.getObjectByName('spotPool');
    if (pool) {
      pool.position.x = playerPos.x - police.heli.position.x;
      pool.position.z = playerPos.z - police.heli.position.z;
    }
    police.heli.lookAt(playerPos.x, 0, playerPos.z);
  }
}

export function policeDistanceList(police, playerPos) {
  const lines = [];
  for (const car of police.cars) {
    const d = Math.round(Math.hypot(car.mesh.position.x - playerPos.x, car.mesh.position.z - playerPos.z));
    lines.push({ name: car.unitName, dist: d, status: car.status });
  }
  if (police.heliActive) {
    lines.push({ name: 'AIR ONE', dist: 0, status: 'AIRBORNE', air: true });
  }
  for (const rb of police.roadblocks) {
    const d = Math.round(Math.hypot(rb.x - playerPos.x, rb.z - playerPos.z));
    lines.push({ name: 'ROADBLOCK', dist: d, status: 'CLOSED', roadblock: true });
  }
  return lines;
}
