// buildCity: the whole of Solara Cove — districts, road grid, buildings,
// palms, beach, sea and the lighthouse. Returns the lookup tables the rest
// of the game uses (district at a point, building colliders, road points).
import * as THREE from 'three';

export const WORLD = {
  half: 500,          // city ground spans -500..500 on x and z
  roadSpacing: 100,   // roads every 100 units
  roadHalf: 7,        // half width of a road
  seaLevel: -1.5,
};

export const DISTRICTS = [
  { name: 'MARINA BAY', sub: 'HARBOR & BOATS', x: -380, z: 300, r: 150 },
  { name: 'OLD CANNERY ROW', sub: 'FISH & RUST', x: -350, z: -120, r: 130 },
  { name: 'HARBOR MARKET', sub: 'STALLS & CROWDS', x: -120, z: 120, r: 140 },
  { name: 'PALM COURT', sub: 'DOWNTOWN', x: 80, z: 40, r: 170 },
  { name: 'CORAL SANDS', sub: 'BEACHFRONT', x: 380, z: 330, r: 140 },
  { name: 'THE BLUFFS', sub: 'HILLS & VIEWS', x: 360, z: -330, r: 150 },
  { name: 'THE YARD', sub: 'DOCKS & CRANES', x: -80, z: -380, r: 150 },
  { name: 'SOLARA HILLS', sub: 'QUIET STREETS', x: -380, z: -380, r: 120 },
];

const BUILDING_COLORS = [0xd8c9a3, 0xe8b48a, 0xc98a7a, 0x9ab8c9, 0xf2e3c9, 0xb8a88a, 0xe0a080, 0x8fb8a8];
const ROOF_COLORS = [0x8a5a3a, 0x5a6a7a, 0xa85848, 0x4a6a5a];

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function makePalm(scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35 * scale, 0.55 * scale, 7 * scale, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
  );
  trunk.position.y = 3.5 * scale;
  group.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(1.1 * scale, 4.5 * scale, 4),
      new THREE.MeshLambertMaterial({ color: 0x3f9e4d }),
    );
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.6 * scale, 7.2 * scale, Math.sin(a) * 1.6 * scale);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    group.add(leaf);
  }
  return group;
}

function makeBuildingBlock(cx, cz, rng) {
  const group = new THREE.Group();
  const w = 26 + rng() * 18;
  const d = 26 + rng() * 18;
  const h = 10 + rng() * rng() * 46;
  const color = BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)];
  const main = box(w, h, d, color, 0, h / 2, 0);
  group.add(main);
  const roof = box(w * 0.7, 1.2, d * 0.7, ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)], 0, h + 0.6, 0);
  group.add(roof);
  // lit windows: small bright planes on the two street faces
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const winGeo = new THREE.PlaneGeometry(2.2, 3);
  const rows = Math.max(1, Math.floor(h / 7));
  const cols = Math.max(2, Math.floor(w / 7));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.55) continue;
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(-w / 2 + 4 + c * 7, 4 + r * 7, d / 2 + 0.06);
      group.add(win);
    }
  }
  if (h > 30) {
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 8, 4),
      new THREE.MeshLambertMaterial({ color: 0x333333 }),
    );
    antenna.position.set(w * 0.2, h + 5, 0);
    group.add(antenna);
  }
  group.position.set(cx, 0, cz);
  return { group, halfW: w / 2, halfD: d / 2 };
}

function makeLighthouse() {
  const group = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 6, 34, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
  );
  tower.position.y = 17;
  group.add(tower);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0xc94f3d }),
  );
  band.position.y = 24;
  group.add(band);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 5, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
  );
  lampRoom.position.y = 36;
  group.add(lampRoom);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
  );
  lamp.position.y = 36;
  lamp.name = 'lighthouseLamp';
  group.add(lamp);
  const rock = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 18, 6, 8),
    new THREE.MeshLambertMaterial({ color: 0x6a6a62 }),
  );
  rock.position.y = 3;
  group.add(rock);
  group.position.set(-470, 0, 470);
  return group;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildCity(scene) {
  const rng = mulberry32(20261123);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const roadPoints = [];

  // --- sky, light, fog
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0xa8c8e0, 350, 1100);
  const sun = new THREE.DirectionalLight(0xffe8b0, 1.6);
  sun.position.set(180, 320, 120);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x8a7a5a, 0.9));

  // --- sea (big plane, west + south of the city) and beach rim
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshLambertMaterial({ color: 0x1f7ab8 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-260, WORLD.seaLevel, 260);
  scene.add(sea);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(1120, 1120),
    new THREE.MeshLambertMaterial({ color: 0xe8d8a8 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, -0.4, 0);
  scene.add(sand);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1020, 1020),
    new THREE.MeshLambertMaterial({ color: 0x9a9a92 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(10, -0.2, -10);
  scene.add(ground);

  // --- roads: dark strips + center dashes, on the 100-unit grid
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e34 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let g = -400; g <= 400; g += 100) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(1000, 14), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) { road.position.set(0, 0.05, g); }
      else { road.rotation.z = Math.PI / 2; road.position.set(g, 0.05, 0); }
      scene.add(road);
      for (let d = -450; d <= 450; d += 30) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.2), dashMat);
        dash.rotation.x = -Math.PI / 2;
        if (horizontal) { dash.position.set(d, 0.08, g); }
        else { dash.rotation.z = Math.PI / 2; dash.position.set(g, 0.08, d); }
        scene.add(dash);
      }
    }
    roadPoints.push({ x: g, z: 0 });
  }
  for (let g = -400; g <= 400; g += 100) {
    for (let h = -400; h <= 400; h += 100) roadPoints.push({ x: g, z: h });
  }

  // --- buildings: one block per grid cell (skip road cells and the plaza)
  for (let gx = -400; gx <= 400; gx += 100) {
    for (let gz = -400; gz <= 400; gz += 100) {
      if (gx === 0 && gz === 0) continue; // Palm Court plaza stays open
      if (rng() < 0.12) continue; // empty lot with palms
      const cx = gx + 50 + (rng() - 0.5) * 12;
      const cz = gz + 50 + (rng() - 0.5) * 12;
      const b = makeBuildingBlock(cx, cz, rng);
      scene.add(b.group);
      colliders.push({
        minX: cx - b.halfW, maxX: cx + b.halfW,
        minZ: cz - b.halfD, maxZ: cz + b.halfD,
      });
    }
  }

  // --- palms along the beachfront and plaza
  for (let i = 0; i < 60; i++) {
    const palm = makePalm(0.8 + rng() * 0.5);
    const side = rng();
    if (side < 0.5) palm.position.set(-480 + rng() * 40, 0, -450 + rng() * 900);
    else palm.position.set(-450 + rng() * 900, 0, 470 - rng() * 40);
    scene.add(palm);
  }
  for (let i = 0; i < 8; i++) {
    const palm = makePalm(1);
    const a = (i / 8) * Math.PI * 2;
    palm.position.set(Math.cos(a) * 42, 0, Math.sin(a) * 42);
    scene.add(palm);
  }

  // --- harbor: crates + cranes at Marina Bay, containers at The Yard
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xb8763a });
  for (let i = 0; i < 24; i++) {
    const crate = box(6, 6, 6, 0xb8763a, -420 + rng() * 120, 3, 220 + rng() * 120);
    crate.material = crateMat;
    scene.add(crate);
    colliders.push({ minX: crate.position.x - 3, maxX: crate.position.x + 3, minZ: crate.position.z - 3, maxZ: crate.position.z + 3 });
  }
  for (let i = 0; i < 10; i++) {
    const cont = box(14, 5, 5, [0x4a7ab8, 0xc94f3d, 0x4a9e5d][i % 3], -160 + rng() * 160, 2.5, -420 + rng() * 60);
    scene.add(cont);
    colliders.push({ minX: cont.position.x - 7, maxX: cont.position.x + 7, minZ: cont.position.z - 2.5, maxZ: cont.position.z + 2.5 });
  }

  // --- lighthouse on the point
  scene.add(makeLighthouse());
  colliders.push({ minX: -484, maxX: -456, minZ: 456, maxZ: 484 });

  // --- plaza fountain at Palm Court (0,0)
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 12, 2.5, 12),
    new THREE.MeshLambertMaterial({ color: 0x7ab8d8 }),
  );
  fountain.position.set(0, 1.2, 0);
  scene.add(fountain);
  colliders.push({ minX: -12, maxX: 12, minZ: -12, maxZ: 12 });

  return { colliders, roadPoints, rng };
}

export function districtAt(x, z) {
  let best = DISTRICTS[3]; // Palm Court default
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dd = (x - d.x) ** 2 + (z - d.z) ** 2;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

export function isOnRoad(x, z) {
  const near = (v) => {
    const m = ((v + 450) % 100 + 100) % 100;
    return Math.min(m, 100 - m) <= WORLD.roadHalf + 2;
  };
  return near(x) || near(z);
}

export function randomRoadPoint(rng) {
  const g = -400 + Math.floor(rng() * 9) * 100;
  const h = -400 + Math.floor(rng() * 9) * 100;
  return { x: g + (rng() - 0.5) * 6, z: h + (rng() - 0.5) * 6 };
}

export function clampToCity(x, z, margin = 20) {
  return {
    x: Math.max(-WORLD.half + margin, Math.min(WORLD.half - margin, x)),
    z: Math.max(-WORLD.half + margin, Math.min(WORLD.half - margin, z)),
  };
}
