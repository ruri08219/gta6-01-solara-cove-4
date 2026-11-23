// vehicles.js: every car in Solara Cove — the factory that builds them,
// the traffic that drives the grid, the player's arcade driving, and
// stealing a parked car (E).
import * as THREE from 'three';
import { WORLD, isOnRoad, randomRoadPoint } from './city.js';

export const CAR_MODELS = [
  { name: 'Sunray GT', color: 0xffd23f, topSpeed: 46, accel: 26, grip: 2.6, price: 4200 },
  { name: 'Cove Cruiser', color: 0x4a7ab8, topSpeed: 34, accel: 18, grip: 2.0, price: 1500 },
  { name: 'Harbor Van', color: 0xe8e8e8, topSpeed: 30, accel: 15, grip: 1.8, price: 900 },
  { name: 'Palm Taxi', color: 0xffb347, topSpeed: 36, accel: 20, grip: 2.1, price: 1800 },
  { name: 'Bluffs Pickup', color: 0x7a4a3a, topSpeed: 33, accel: 17, grip: 1.9, price: 1200 },
  { name: 'Cannery Truck', color: 0x6a8a5a, topSpeed: 28, accel: 13, grip: 1.7, price: 700 },
];

export function makeCarMesh(model, isPolice = false) {
  const group = new THREE.Group();
  const bodyColor = isPolice ? 0x1a1a22 : model.color;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.75, 4.6),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0x222226 : 0x1a2a3a }),
  );
  cabin.position.set(0, 1.2, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    head.position.set(hx, 0.6, 2.32);
    group.add(head);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    bar.position.set(0, 1.62, -0.2);
    bar.name = 'lightBar';
    group.add(bar);
    const decal = new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 0.3, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    decal.position.set(0, 0.75, 0.4);
    group.add(decal);
  }
  return group;
}

export function createCar(model, x, z, heading, isPolice = false) {
  const mesh = makeCarMesh(model, isPolice);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    model, mesh, isPolice,
    heading, speed: 0,
    condition: 100,
    stolen: false,
    // traffic AI
    route: [],
    routeIndex: 0,
    waitTimer: 0,
    siren: 0,
  };
}

// --- traffic: cars loop around the road grid on random routes ---------------
export function spawnTraffic(scene, city, count = 22) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const model = CAR_MODELS[Math.floor(city.rng() * CAR_MODELS.length)];
    const p = randomRoadPoint(city.rng);
    const heading = (Math.floor(city.rng() * 4) * Math.PI) / 2;
    const car = createCar(model, p.x, p.z, heading);
    car.speed = 8 + city.rng() * 6;
    car.route = buildRoute(city, p);
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}

function buildRoute(city, start) {
  const route = [];
  let x = start.x;
  let z = start.z;
  let dir = Math.floor(city.rng() * 4);
  for (let i = 0; i < 10; i++) {
    const steps = 1 + Math.floor(city.rng() * 3);
    for (let s = 0; s < steps; s++) {
      if (dir === 0) x += 100; else if (dir === 1) z += 100;
      else if (dir === 2) x -= 100; else z -= 100;
      x = Math.max(-400, Math.min(400, x));
      z = Math.max(-400, Math.min(400, z));
      route.push({ x, z });
    }
    dir = (dir + (city.rng() < 0.5 ? 1 : 3)) % 4;
  }
  return route;
}

export function updateTraffic(dt, cars, city, playerPos) {
  for (const car of cars) {
    if (car.waitTimer > 0) { car.waitTimer -= dt; continue; }
    const target = car.route[car.routeIndex];
    if (!target) { car.route = buildRoute(city, { x: car.mesh.position.x, z: car.mesh.position.z }); car.routeIndex = 0; continue; }
    const dx = target.x - car.mesh.position.x;
    const dz = target.z - car.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) {
      car.routeIndex = (car.routeIndex + 1) % car.route.length;
      continue;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    // slow down for the player crossing ahead
    const pd = Math.hypot(playerPos.x - car.mesh.position.x, playerPos.z - car.mesh.position.z);
    const targetSpeed = pd < 14 ? 3 : 10 + (car.speed % 5);
    car.speed += Math.max(-14 * dt, Math.min(14 * dt, targetSpeed - car.speed));
    car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
    car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
  }
}

// --- player driving: arcade, forgiving, with drift --------------------------
export function drivePlayerCar(dt, car, input, nitro) {
  const m = car.model;
  const accel = m.accel * (nitro ? 1.9 : 1);
  if (input.forward) car.speed += accel * dt;
  if (input.back) car.speed -= accel * 0.7 * dt;
  if (!input.forward && !input.back) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 10 * dt);
  }
  if (input.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = Math.max(-14, Math.min(m.topSpeed * (nitro ? 1.35 : 1), car.speed));
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const grip = input.handbrake ? m.grip * 2.2 : m.grip;
  const turnRate = steer * grip * Math.min(1, Math.abs(car.speed) / 12) * (car.speed >= 0 ? 1 : -1);
  car.heading += turnRate * dt * (car.speed >= 0 ? 1 : -1) * (input.handbrake ? 1.4 : 1);
  car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
  car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.rotation.y = car.heading;
  // body lean into the turn, so the car feels alive
  car.mesh.rotation.z = -steer * Math.min(0.08, Math.abs(car.speed) * 0.003);
  return Math.abs(car.speed) * 3.6; // km/h
}

// --- stealing: the nearest parked, unoccupied car within reach ---------------
export function nearestStealableCar(playerPos, cars, maxDist = 5) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.isPolice) continue;
    if (car.occupied) continue;
    const d = Math.hypot(car.mesh.position.x - playerPos.x, car.mesh.position.z - playerPos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function spawnParkedCars(scene, city, count = 14) {
  const cars = [];
  const spots = [
    { x: 380, z: 300, h: 0 }, { x: 390, z: 310, h: 0 }, { x: 370, z: 290, h: 0 },
    { x: -380, z: 260, h: 1.57 }, { x: -370, z: 270, h: 1.57 },
    { x: 60, z: -60, h: 3.14 }, { x: 70, z: -70, h: 3.14 }, { x: 50, z: -50, h: 3.14 },
    { x: -120, z: 160, h: 1.57 }, { x: -130, z: 170, h: 1.57 },
    { x: 300, z: -300, h: 0 }, { x: 310, z: -290, h: 0 },
    { x: -200, z: -380, h: 1.57 }, { x: -190, z: -370, h: 1.57 },
  ];
  for (let i = 0; i < Math.min(count, spots.length); i++) {
    const s = spots[i];
    const model = i === 0 ? CAR_MODELS[0] : CAR_MODELS[1 + Math.floor(city.rng() * (CAR_MODELS.length - 1))];
    const car = createCar(model, s.x, s.z, s.h);
    car.parked = true;
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}

export function collideWithBuildings(pos, radius, colliders) {
  // Push a circle (player or car) out of every building AABB it overlaps.
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        pos.x = c.maxX + radius;
      }
      return true;
    }
  }
  return false;
}

export function onRoadSpeedBonus(x, z) {
  return isOnRoad(x, z) ? 1 : 0.55; // off-road is slower: grass and sand drag
}

export { WORLD };
