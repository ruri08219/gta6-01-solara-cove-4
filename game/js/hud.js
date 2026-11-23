// hud.js: everything the player reads — mission panel, dispatch list,
// cash and stars, the round minimap, speed and crew chips. All DOM reads
// happen once here; updateHud is called every frame.
import { DISTRICTS, districtAt } from './city.js';
import { currentJob, currentStage, stageDistance, JOBS } from './missions.js';
import { policeDistanceList } from './police.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  return {
    minimap: $('minimap'),
    ctx: $('minimap').getContext('2d'),
    lastDistrict: '',
    lastDialogue: '',
  };
}

function starRow(n) {
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += `<span class="${i < n ? 'lit' : 'dim'}">&#9733;</span>`;
  }
  return out;
}

export function setDialogue(hud, speaker, text) {
  const box = $('dialogue-box');
  box.querySelector('.speaker').textContent = speaker;
  $('dialogue-text').textContent = text;
}

export function showToast(text, ms = 2600) {
  const t = $('toast');
  t.textContent = text;
  t.style.display = 'block';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { t.style.display = 'none'; }, ms);
}

export function updateHud(hud, state) {
  const { missions, police, player, crew } = state;
  // --- mission panel
  if (missions.done) {
    $('job-no').textContent = 'STORY COMPLETE — 8 / 8 JOBS';
    $('job-title').textContent = 'Solara Sunrise';
    $('job-stage').textContent = 'All jobs done. The ferry leaves at sunrise.';
    $('job-objective').textContent = 'Free roam: explore the cove, keep your cash.';
    $('job-dist').textContent = '';
  } else {
    const job = currentJob(missions);
    const stage = currentStage(missions);
    $('job-no').textContent = `JOB ${missions.jobIndex + 1} / 8 — STORY`;
    $('job-title').textContent = job.title;
    $('job-stage').textContent = `Stage ${missions.stageIndex + 1} of ${job.stages.length} — $${job.payout.toLocaleString()}`;
    $('job-objective').textContent = stage.objective;
    let dist = `${stageDistance(missions, player.pos)} m`;
    if (stage.holdSeconds) dist += ` — HOLD ${Math.max(0, Math.ceil(stage.holdSeconds - missions.holdTimer))}s`;
    if (stage.killsNeeded) dist += ` — ${missions.killsThisStage}/${stage.killsNeeded} DOWN`;
    $('job-dist').textContent = dist;
    $('job-list').innerHTML = JOBS.map((j, i) =>
      `<div class="${i < missions.jobIndex ? 'done' : i === missions.jobIndex ? 'current' : ''}">${i + 1}. ${j.title}${i === missions.jobIndex ? ' ◀' : ''}</div>`,
    ).join('');
  }
  // --- district banner
  const d = districtAt(player.pos.x, player.pos.z);
  if (d.name !== hud.lastDistrict) {
    hud.lastDistrict = d.name;
    $('district-banner').innerHTML = `${d.name}<small>${d.sub} &middot; SOLARA COVE</small>`;
  }
  // --- stats
  $('cash').textContent = `$${Math.floor(state.cash).toLocaleString()}`;
  $('respect').textContent = `RESPECT: ${state.respectRank} · ${state.respect} XP`;
  const hours = 9 + Math.floor(state.playTime / 3600);
  const mins = Math.floor((state.playTime % 3600) / 60);
  $('clock').textContent = `DAY 1 · ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  $('radio-ticker').textContent = `${state.radio.name} — ${state.radio.track}`;
  $('stars').innerHTML = starRow(police.wanted);
  // --- dispatch list
  const units = policeDistanceList(police, player.pos);
  if (units.length === 0) {
    $('dispatch-list').textContent = 'All units clear. No active calls.';
  } else {
    $('dispatch-list').innerHTML = units.map((u) => {
      const cls = u.air ? 'unit-air' : u.roadblock ? 'unit-roadblock' : '';
      const dist = u.air ? 'AIR' : `${u.dist} m`;
      return `<div class="${cls}">${u.name} — ${dist} — ${u.status}</div>`;
    }).join('') + (police.dispatchLog[0] ? `<div style="color:#ffb347">${police.dispatchLog[0]}</div>` : '');
  }
  // --- speed / vehicle
  const kmh = player.vehicle ? Math.round(Math.abs(player.vehicle.speed) * 3.6) : 0;
  $('speed').innerHTML = `${player.vehicle ? kmh : Math.round(player.walkSpeed * 3.6)} <small>KM/H</small>`;
  $('vehicle-name').textContent = player.vehicle ? player.vehicle.model.name.toUpperCase() : 'ON FOOT';
  $('cond-fill').style.width = `${player.vehicle ? Math.max(0, player.vehicle.condition) : 100}%`;
  $('health-fill').style.width = `${Math.max(0, state.health)}%`;
  $('armor-fill').style.width = `${Math.max(0, state.armor)}%`;
  // --- weapons
  for (let i = 0; i < 3; i++) {
    const slot = $(`slot-${i + 1}`);
    slot.classList.toggle('active', state.combat.weaponIndex === i);
  }
  // --- crew chips
  for (const [key, id] of [['dax', 'crew-dax'], ['iris', 'crew-iris'], ['bram', 'crew-bram']]) {
    const chip = $(id);
    const c = crew[key];
    chip.classList.toggle('ready', c.cooldown <= 0);
    chip.querySelector('.cd').textContent = c.cooldown > 0 ? `COOLDOWN ${Math.ceil(c.cooldown)}s` : 'READY';
  }
  // --- objective arrow: points toward the mission marker
  const target = state.missionTarget;
  if (target) {
    const dx = target.x - player.pos.x;
    const dz = target.z - player.pos.z;
    const bearing = Math.atan2(dx, dz);
    const rel = bearing - player.heading;
    const deg = Math.round(((rel * 180) / Math.PI + 360) % 360);
    const arrow = deg < 45 || deg > 315 ? '▲ AHEAD' : deg < 135 ? '▶ RIGHT' : deg < 225 ? '▼ BEHIND' : '◀ LEFT';
    $('objective-arrow').textContent = `${arrow} — ${Math.round(Math.hypot(dx, dz))} m to objective`;
  } else {
    $('objective-arrow').textContent = '';
  }
  drawMinimap(hud, state);
}

function drawMinimap(hud, state) {
  const ctx = hud.ctx;
  const S = 220;
  const half = 500;
  const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#0d2033';
  ctx.fillRect(0, 0, S, S);
  // sea
  ctx.fillStyle = '#1f6fa8';
  ctx.fillRect(0, 0, 28, S);
  ctx.fillRect(0, S - 28, S, 28);
  // beach
  ctx.fillStyle = '#c9b078';
  ctx.fillRect(28, 0, 8, S);
  ctx.fillRect(0, S - 36, S, 8);
  // roads
  ctx.strokeStyle = '#3a3a44';
  ctx.lineWidth = 4;
  for (let g = -400; g <= 400; g += 100) {
    const [x1, y1] = toMap(g, -500);
    const [x2, y2] = toMap(g, 500);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const [x3, y3] = toMap(-500, g);
    const [x4, y4] = toMap(500, g);
    ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
  }
  // districts
  ctx.fillStyle = '#8fd8ff';
  ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) {
    const [x, y] = toMap(d.x, d.z);
    ctx.fillText(d.name, x, y);
  }
  // mission marker (pulsing yellow diamond)
  const target = state.missionTarget;
  if (target) {
    const [x, y] = toMap(target.x, target.z);
    const pulse = 6 + Math.sin(performance.now() / 200) * 2;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(x, y - pulse); ctx.lineTo(x + pulse, y); ctx.lineTo(x, y + pulse); ctx.lineTo(x - pulse, y);
    ctx.closePath(); ctx.fill();
  }
  // traffic (white dots), police (red), player (green arrow)
  ctx.fillStyle = '#ffffff';
  for (const car of state.traffic) {
    const [x, y] = toMap(car.mesh.position.x, car.mesh.position.z);
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  ctx.fillStyle = '#ff4444';
  for (const car of state.police.cars) {
    const [x, y] = toMap(car.mesh.position.x, car.mesh.position.z);
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
  if (state.police.heliActive) {
    const [x, y] = toMap(state.police.heli.position.x, state.police.heli.position.z);
    ctx.strokeStyle = '#8fd8ff';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
  }
  const [px, py] = toMap(state.player.pos.x, state.player.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.player.heading);
  ctx.fillStyle = '#7dff9a';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // north tick
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('N', S / 2, 12);
}
