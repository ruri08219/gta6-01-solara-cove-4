// effects.js: the juice — explosion fireballs, smoke, muzzle flashes and
// sparks. One pool of short-lived meshes, recycled every frame, so the
// game never allocates during a chase.
import * as THREE from 'three';

export function createEffects(scene) {
  return {
    scene,
    particles: [],
    flashes: [],
  };
}

function makeParticle(effects, color, size) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 6, 5),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  effects.scene.add(mesh);
  return mesh;
}

export function spawnExplosion(effects, pos, big = false) {
  const count = big ? 26 : 12;
  for (let i = 0; i < count; i++) {
    const color = [0xff6a00, 0xffd23f, 0xff2222, 0x888888][i % 4];
    const mesh = makeParticle(effects, color, big ? 1.4 : 0.9);
    mesh.position.copy(pos);
    const a = Math.random() * Math.PI * 2;
    const up = Math.random() * 14 + 4;
    effects.particles.push({
      mesh,
      vx: Math.cos(a) * (6 + Math.random() * 10),
      vy: up,
      vz: Math.sin(a) * (6 + Math.random() * 10),
      life: 0.7 + Math.random() * 0.6,
      maxLife: 1.3,
    });
  }
}

export function spawnMuzzle(effects, pos) {
  const mesh = makeParticle(effects, 0xfff2b0, 0.5);
  mesh.position.copy(pos);
  effects.flashes.push({ mesh, life: 0.08, maxLife: 0.08 });
}

export function spawnSparks(effects, pos) {
  for (let i = 0; i < 5; i++) {
    const mesh = makeParticle(effects, 0xffe9a8, 0.3);
    mesh.position.copy(pos);
    effects.particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * 8 + 2,
      vz: (Math.random() - 0.5) * 12,
      life: 0.4,
      maxLife: 0.4,
    });
  }
}

export function updateEffects(dt, effects) {
  for (let i = effects.particles.length - 1; i >= 0; i--) {
    const p = effects.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      effects.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      effects.particles.splice(i, 1);
      continue;
    }
    p.vy -= 22 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y = Math.max(0.3, p.mesh.position.y + p.vy * dt);
    p.mesh.position.z += p.vz * dt;
    p.mesh.material.opacity = Math.max(0, p.life / p.maxLife) * 0.9;
    const s = 1 + (1 - p.life / p.maxLife) * 1.6;
    p.mesh.scale.set(s, s, s);
  }
  for (let i = effects.flashes.length - 1; i >= 0; i--) {
    const f = effects.flashes[i];
    f.life -= dt;
    if (f.life <= 0) {
      effects.scene.remove(f.mesh);
      f.mesh.geometry.dispose();
      f.mesh.material.dispose();
      effects.flashes.splice(i, 1);
    }
  }
}
