// pedestrians.js: the people of Solara Cove — walking the sidewalks,
// crossing at corners, fleeing when shots ring out.
import * as THREE from 'three';
import { randomRoadPoint, clampToCity } from './city.js';

const SHIRT_COLORS = [0xe86a6a, 0x6a9ae8, 0x6ae88a, 0xe8d86a, 0xb86ae8, 0xffffff, 0x333333, 0xff9de2];

function makePedestrianMesh(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.42, 1.1, 6),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = 0.95;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8a878 }),
  );
  head.position.y = 1.75;
  group.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  for (const lx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), legMat);
    leg.position.set(lx, 0.25, 0);
    leg.name = 'leg';
    group.add(leg);
  }
  return group;
}

export function spawnPedestrians(scene, city, count = 26) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const color = SHIRT_COLORS[Math.floor(city.rng() * SHIRT_COLORS.length)];
    const mesh = makePedestrianMesh(color);
    const p = randomRoadPoint(city.rng);
    // stand beside the road, not on it
    mesh.position.set(p.x + 12, 0, p.z + 12);
    scene.add(mesh);
    peds.push({
      mesh,
      heading: city.rng() * Math.PI * 2,
      speed: 1.2 + city.rng() * 1.2,
      target: null,
      fleeing: false,
      panic: 0,
      walkPhase: city.rng() * 10,
      alive: true,
    });
  }
  return peds;
}

export function updatePedestrians(dt, peds, city, dangerPos, gunfire) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    if (gunfire) ped.panic = Math.max(ped.panic, 3);
    const dDanger = Math.hypot(ped.mesh.position.x - dangerPos.x, ped.mesh.position.z - dangerPos.z);
    if (dDanger < 26) ped.panic = Math.max(ped.panic, 2);
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.fleeing = true;
    } else ped.fleeing = false;
    if (!ped.target || Math.hypot(ped.target.x - ped.mesh.position.x, ped.target.z - ped.mesh.position.z) < 4) {
      const t = randomRoadPoint(city.rng);
      ped.target = { x: t.x + 12, z: t.z + 12 };
    }
    let tx = ped.target.x;
    let tz = ped.target.z;
    if (ped.fleeing) {
      // run away from the danger, down the sidewalk
      const dx = ped.mesh.position.x - dangerPos.x;
      const dz = ped.mesh.position.z - dangerPos.z;
      const d = Math.hypot(dx, dz) || 1;
      tx = ped.mesh.position.x + (dx / d) * 40;
      tz = ped.mesh.position.z + (dz / d) * 40;
    }
    const dx = tx - ped.mesh.position.x;
    const dz = tz - ped.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.5) {
      const want = Math.atan2(dx, dz);
      let diff = want - ped.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
      const speed = ped.fleeing ? ped.speed * 3.2 : ped.speed;
      ped.mesh.position.x += Math.sin(ped.heading) * speed * dt;
      ped.mesh.position.z += Math.cos(ped.heading) * speed * dt;
      ped.mesh.rotation.y = ped.heading;
      ped.walkPhase += dt * speed * 3;
      const swing = Math.sin(ped.walkPhase) * 0.35;
      for (const child of ped.mesh.children) {
        if (child.name === 'leg') child.rotation.x = swing * (child.position.x < 0 ? 1 : -1);
      }
    }
    const clamped = clampToCity(ped.mesh.position.x, ped.mesh.position.z, 12);
    ped.mesh.position.x = clamped.x;
    ped.mesh.position.z = clamped.z;
  }
}

export function nearestPedestrian(peds, pos, maxDist = 60) {
  let best = null;
  let bestD = maxDist;
  for (const ped of peds) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.mesh.position.x - pos.x, ped.mesh.position.z - pos.z);
    if (d < bestD) { bestD = d; best = ped; }
  }
  return best;
}
