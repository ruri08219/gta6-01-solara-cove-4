// crew.js: Mara's crew and the respect ladder. Three abilities on
// cooldowns — Dax's nitro, Iris's ghost (drops the cops), Bram's bulwark
// (armor) — and five respect ranks that climb with cash and finished jobs.
import { addHeat } from './police.js';

export const RESPECT_RANKS = [
  { name: 'NOBODY', at: 0 },
  { name: 'RUNNER', at: 100 },
  { name: 'WHEELMAN', at: 400 },
  { name: 'MADE', at: 900 },
  { name: 'COVE LEGEND', at: 1600 },
];

export function rankFor(respect) {
  let rank = RESPECT_RANKS[0].name;
  for (const r of RESPECT_RANKS) {
    if (respect >= r.at) rank = r.name;
  }
  return rank;
}

export function createCrew() {
  return {
    dax: { name: 'DAX', ability: 'NITRO', cooldown: 0, maxCooldown: 14 },
    iris: { name: 'IRIS', ability: 'GHOST', cooldown: 0, maxCooldown: 45 },
    bram: { name: 'BRAM', ability: 'BULWARK', cooldown: 0, maxCooldown: 30 },
    nitroUntil: 0,
  };
}

// Returns a line for the dialogue box, or null when the ability is on cooldown.
export function useAbility(crew, key, state) {
  const member = crew[key];
  if (!member || member.cooldown > 0) return null;
  const now = state.playTime;
  if (key === 'dax') {
    if (!state.player.vehicle) return 'DAX: Nitro needs wheels, Mara. Get in a car first.';
    member.cooldown = member.maxCooldown;
    crew.nitroUntil = now + 4;
    return 'DAX: Nitro lit! Hold on tight!';
  }
  if (key === 'iris') {
    member.cooldown = member.maxCooldown;
    state.police.heat = 0;
    state.police.wanted = 0;
    return 'IRIS: Dispatch looped — they lost you. Ghost protocol, baby.';
  }
  if (key === 'bram') {
    member.cooldown = member.maxCooldown;
    state.armor = 100;
    return 'BRAM: Bulwark up. Nothing gets through me — or you.';
  }
  return null;
}

export function updateCrewCooldowns(crew, dt) {
  for (const key of ['dax', 'iris', 'bram']) {
    if (crew[key].cooldown > 0) crew[key].cooldown -= dt;
  }
}

export function nitroActive(crew, now) {
  return now < crew.nitroUntil;
}
