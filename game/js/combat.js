// combat.js: fighting on foot — fists, pistol and SMG, with ammo, damage,
// muzzle flashes and the wanted heat a gunshot brings. Targets are live
// references: damage lands on the pedestrian / car / enforcer itself.
import * as THREE from 'three';

export const WEAPONS = [
  { name: 'FISTS', damage: 25, range: 3.2, rate: 0.45, ammo: Infinity, auto: false },
  { name: 'PISTOL', damage: 34, range: 55, rate: 0.32, ammo: 24, auto: false },
  { name: 'SMG', damage: 20, range: 45, rate: 0.09, ammo: 90, auto: true },
];

export function createCombat(scene) {
  return {
    scene,
    weaponIndex: 0,
    ammo: [Infinity, 24, 90],
    cooldown: 0,
    kills: 0,
    raycaster: new THREE.Raycaster(),
  };
}

export function switchWeapon(combat, index) {
  if (index < 0 || index >= WEAPONS.length) return;
  combat.weaponIndex = index;
  return WEAPONS[index];
}

export function currentWeapon(combat) {
  return WEAPONS[combat.weaponIndex];
}

function damageTarget(combat, target, damage) {
  const o = target.ref;
  o.hp = (o.hp === undefined ? 50 : o.hp) - damage;
  if (o.hp <= 0 && o.alive !== false) {
    o.alive = false;
    combat.kills++;
    return true; // killed
  }
  return false;
}

// Fire from the camera toward the crosshair. Returns a report the main loop
// turns into effects, heat and kills: { hit, target, kind, pos, killed }.
export function fireWeapon(combat, camera, targets, dt) {
  combat.cooldown -= dt;
  const weapon = currentWeapon(combat);
  if (combat.cooldown > 0) return null;
  if (combat.ammo[combat.weaponIndex] <= 0) {
    combat.cooldown = 0.4;
    return { dry: true, weapon };
  }
  combat.cooldown = weapon.rate;
  if (combat.ammo[combat.weaponIndex] !== Infinity) combat.ammo[combat.weaponIndex]--;
  if (weapon.name === 'FISTS') {
    let best = null;
    let bestD = weapon.range;
    for (const t of targets) {
      if (t.ref.alive === false) continue;
      const to = new THREE.Vector3().subVectors(t.pos, camera.position);
      const d = to.length();
      if (d > weapon.range) continue;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      if (to.normalize().dot(forward) < 0.5) continue;
      if (d < bestD) { bestD = d; best = t; }
    }
    if (best) {
      const killed = damageTarget(combat, best, weapon.damage);
      return { hit: true, target: best, weapon, pos: best.pos.clone(), killed };
    }
    return { hit: false, weapon, pos: null };
  }
  // guns: a ray from the camera through the screen center
  combat.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  combat.raycaster.far = weapon.range;
  const meshes = [];
  for (const t of targets) {
    if (t.ref.alive === false || !t.mesh) continue;
    meshes.push(t.mesh);
  }
  const hits = combat.raycaster.intersectObjects(meshes, true);
  if (hits.length > 0) {
    const hit = hits[0];
    let obj = hit.object;
    while (obj.parent && !obj.userData.targetRef) obj = obj.parent;
    const target = obj.userData.targetRef || null;
    if (target) {
      const killed = damageTarget(combat, target, weapon.damage);
      return { hit: true, target, weapon, pos: hit.point.clone(), killed };
    }
    return { hit: true, target: null, weapon, pos: hit.point.clone() };
  }
  return { hit: false, weapon, pos: null };
}

// Build the shootable target list from the live world: pedestrians, police
// cars and enforcers. Each entry keeps its live object in `ref`.
export function buildTargets(peds, policeCars, enforcers) {
  const targets = [];
  for (const ped of peds) {
    if (ped.hp === undefined) ped.hp = 50;
    targets.push({
      kind: 'pedestrian', mesh: ped.mesh,
      pos: ped.mesh.position, ref: ped,
    });
  }
  for (const car of policeCars) {
    if (car.hp === undefined) car.hp = 120;
    targets.push({
      kind: 'police', mesh: car.mesh,
      pos: car.mesh.position, ref: car,
    });
  }
  for (const e of enforcers) {
    targets.push({ kind: 'enforcer', mesh: e.mesh, pos: e.mesh.position, ref: e });
  }
  return targets;
}

export function linkTargetRefs(targets) {
  for (const t of targets) {
    if (t.mesh) t.mesh.userData.targetRef = t;
  }
}
