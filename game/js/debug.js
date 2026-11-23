// debug.js: the playtest hooks — window.__solara lets a headless driver
// set up a scene (wanted level, job, position), read the live state and
// confirm the game is really running. It calls the game's own functions;
// it never draws anything by itself.
export function installDebugHooks(api) {
  window.__solara = {
    ready: false,
    version: 'solara-cove-1',
    state: () => api.getState(),
    start: () => api.startGame(),
    setWanted: (stars) => api.setWanted(stars),
    startJob: (i) => api.startJob(i),
    teleport: (x, z) => api.teleport(x, z),
    enterNearestCar: () => api.enterNearestCar(),
    stealNearestCar: () => api.stealNearestCar(),
    giveWeapon: (i) => api.giveWeapon(i),
    shoot: () => api.shoot(),
    save: () => api.save(),
    load: () => api.loadSaveState(),
    setTimeOfDay: (t) => api.setTimeOfDay(t),
    cinematic: (x, y, z, tx, ty, tz) => api.cinematic(x, y, z, tx, ty, tz),
    releaseCamera: () => api.releaseCamera(),
    spawnPolice: (n) => api.spawnPolice(n),
    errors: [],
  };
  window.addEventListener('error', (e) => {
    window.__solara.errors.push(String(e.message || e.error || 'error'));
  });
  window.addEventListener('unhandledrejection', (e) => {
    window.__solara.errors.push(String(e.reason || 'rejection'));
  });
}
