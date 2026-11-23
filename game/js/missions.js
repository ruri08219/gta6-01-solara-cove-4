// missions.js: the story — eight numbered jobs for Mara Voss, each with
// stages, a target on the map, dialogue from the crew, and a payout.
// A job advances when the player reaches its marker; finishing one pays
// cash, earns respect and unlocks the next.

export const JOBS = [
  {
    title: 'First Light',
    payout: 800,
    stages: [
      { objective: 'Pick up the package at Marina Bay docks.', target: { x: -400, z: 280 }, say: ['DAX', 'Package is at the docks, Mara. Don\'t keep the man waiting — he pays in cash.'] },
      { objective: 'Deliver the package to Palm Court plaza.', target: { x: 30, z: 30 }, say: ['MARA', 'One delivery. Easy money. That\'s what I keep telling myself.'] },
    ],
  },
  {
    title: 'Hot Wheels',
    payout: 1500,
    stages: [
      { objective: 'Steal the yellow Sunray GT at Coral Sands (press E).', target: { x: 380, z: 300 }, say: ['IRIS', 'The GT is parked at Coral Sands, top of the beach lot. Walk up and take it — E is all it takes.'] },
      { objective: 'Bring the Sunray GT to the lockup in The Yard.', target: { x: -80, z: -360 }, say: ['DAX', 'Nice. That paint job alone is worth more than my apartment.'] },
    ],
  },
  {
    title: 'The Cannery Run',
    payout: 2200,
    stages: [
      { objective: 'Collect the crates at Old Cannery Row.', target: { x: -350, z: -120 }, say: ['BRAM', 'Crates are heavy, Mara. Drive smooth or we lose half of them on the first corner.'] },
      { objective: 'Smuggle the crates through to Harbor Market.', target: { x: -120, z: 120 }, say: ['IRIS', 'PD put a roadblock on the main drag. Take the back streets.'] },
      { objective: 'Drop the crates at the market stall.', target: { x: -100, z: 140 }, say: ['MARA', 'Done. The fishmongers never saw a thing.'] },
    ],
  },
  {
    title: 'Static',
    payout: 2600,
    stages: [
      { objective: 'Pick up Iris at Palm Court.', target: { x: 80, z: 40 }, say: ['IRIS', 'I need the relay tower on The Bluffs. Five minutes of quiet and the whole PD radio is ours.'] },
      { objective: 'Drive Iris to the relay tower on The Bluffs.', target: { x: 360, z: -330 }, say: ['IRIS', 'They\'re coming. Keep the car running and don\'t stop for anything.'] },
      { objective: 'Hold the tower while Iris hacks (stay within 30 m).', target: { x: 360, z: -330 }, holdSeconds: 12, say: ['IRIS', 'Almost in... their dispatch is looping. Thirty more seconds of this and we own the airwaves.'] },
    ],
  },
  {
    title: 'Payday at the Yard',
    payout: 4200,
    stages: [
      { objective: 'Grab the cash from the Yard office.', target: { x: -80, z: -380 }, say: ['BRAM', 'The office is unguarded for once. Walk in, take the bag, walk out. Simple.'] },
      { objective: 'Escape to Coral Sands with the cash — expect company.', target: { x: 380, z: 330 }, say: ['MARA', 'Three stars and climbing. If Air One shows up, we lose the beach.'] },
    ],
  },
  {
    title: 'Air One',
    payout: 5000,
    stages: [
      { objective: 'Lose the helicopter: reach the Bluffs tunnel.', target: { x: 360, z: -300 }, say: ['DAX', 'Air One is on you. The tunnel under The Bluffs kills their spotlight — get under cover!'] },
      { objective: 'Shake the last patrol car, then reach the lighthouse.', target: { x: -470, z: 470 }, say: ['IRIS', 'Spotlight\'s gone. You\'re a ghost again — for now.'] },
    ],
  },
  {
    title: 'The Longshoreman',
    payout: 5600,
    stages: [
      { objective: 'Meet Bram at the Marina Bay docks.', target: { x: -400, z: 300 }, say: ['BRAM', 'The deal is at the docks. If it goes sideways, it goes sideways loud.'] },
      { objective: 'Defend the deal on foot — take down 3 enforcers.', target: { x: -380, z: 280 }, killsNeeded: 3, say: ['MARA', 'On foot. Fine. I\'ve done worse with less.'] },
      { objective: 'Collect the payment and get clear.', target: { x: -360, z: 320 }, say: ['BRAM', 'Payment\'s in the bag. You fight like the cove owes you money.'] },
    ],
  },
  {
    title: 'Solara Sunrise',
    payout: 9000,
    stages: [
      { objective: 'Steal the getaway car from Solara Hills.', target: { x: -380, z: -380 }, say: ['IRIS', 'Last job, Mara. The ferry leaves at sunrise and it does not wait.'] },
      { objective: 'Pick up the crew at Palm Court.', target: { x: 80, z: 40 }, say: ['DAX', 'All three of us, one car. Just like the old days.'] },
      { objective: 'Outrun the lockdown to the lighthouse point.', target: { x: -470, z: 470 }, say: ['MARA', 'Sunrise over the cove. We made it out — all of us, together.'] },
    ],
  },
];

export function createMissions(state) {
  return {
    state,
    jobIndex: 0,
    stageIndex: 0,
    holdTimer: 0,
    killsThisStage: 0,
    marker: null,
    done: false,
    jobsDone: 0,
  };
}

export function currentJob(missions) {
  return JOBS[missions.jobIndex];
}

export function currentStage(missions) {
  const job = currentJob(missions);
  return job ? job.stages[missions.stageIndex] : null;
}

export function advanceStage(missions, onEvent) {
  const job = currentJob(missions);
  missions.stageIndex++;
  missions.holdTimer = 0;
  missions.killsThisStage = 0;
  if (missions.stageIndex >= job.stages.length) {
    // job complete
    missions.state.cash += job.payout;
    missions.state.respect += 120 + missions.jobIndex * 40;
    missions.jobsDone++;
    onEvent('jobDone', job);
    missions.jobIndex++;
    missions.stageIndex = 0;
    if (missions.jobIndex >= JOBS.length) {
      missions.done = true;
      onEvent('storyDone', null);
    } else {
      onEvent('jobStart', currentJob(missions));
    }
  } else {
    onEvent('stageStart', currentStage(missions));
  }
}

export function updateMissions(dt, missions, playerPos, onEvent) {
  if (missions.done) return;
  const stage = currentStage(missions);
  if (!stage) return;
  const d = Math.hypot(stage.target.x - playerPos.x, stage.target.z - playerPos.z);
  if (stage.killsNeeded) {
    if (missions.killsThisStage >= stage.killsNeeded) advanceStage(missions, onEvent);
    return;
  }
  if (stage.holdSeconds) {
    if (d < 30) {
      missions.holdTimer += dt;
      if (missions.holdTimer >= stage.holdSeconds) advanceStage(missions, onEvent);
    } else {
      missions.holdTimer = Math.max(0, missions.holdTimer - dt * 2);
    }
    return;
  }
  if (d < 14) advanceStage(missions, onEvent);
}

export function stageDistance(missions, playerPos) {
  const stage = currentStage(missions);
  if (!stage) return 0;
  return Math.round(Math.hypot(stage.target.x - playerPos.x, stage.target.z - playerPos.z));
}

export function markerPosition(missions) {
  const stage = currentStage(missions);
  return stage ? stage.target : null;
}
