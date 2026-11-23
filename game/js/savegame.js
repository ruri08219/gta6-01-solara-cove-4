// savegame.js: the save system — cash, jobs, respect, position, radio and
// crew cooldowns persist in localStorage, so a run survives a reload.
// One key, one version, JSON only; a corrupt save is ignored, never fatal.
export const SAVE_KEY = 'solara-cove-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      cash: Math.floor(state.cash),
      respect: state.respect,
      respectRank: state.respectRank,
      jobIndex: state.missions.jobIndex,
      stageIndex: state.missions.stageIndex,
      jobsDone: state.missions.jobsDone,
      health: state.health,
      armor: state.armor,
      kills: state.combat.kills,
      playTime: state.playTime,
      radioStation: state.radio.stationIndex,
      player: {
        x: state.player.pos.x,
        z: state.player.pos.z,
        heading: state.player.heading,
      },
      crew: {
        dax: state.crew.dax.cooldown,
        iris: state.crew.iris.cooldown,
        bram: state.crew.bram.cooldown,
      },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

export function applySave(state, data) {
  state.cash = data.cash;
  state.respect = data.respect;
  state.respectRank = data.respectRank;
  state.missions.jobIndex = Math.min(data.jobIndex, 7);
  state.missions.stageIndex = data.stageIndex;
  state.missions.jobsDone = data.jobsDone;
  state.health = data.health;
  state.armor = data.armor;
  state.combat.kills = data.kills || 0;
  state.playTime = data.playTime || 0;
  if (typeof data.radioStation === 'number') {
    state.radio.stationIndex = data.radioStation;
  }
  if (data.player) {
    state.player.pos.x = data.player.x;
    state.player.pos.z = data.player.z;
    state.player.heading = data.player.heading;
  }
}
