/**
 * Tuning — the ScriptableObject equivalent. Map every quantified TDD number here.
 */
export const META = {
  title: "LIGHTS OUT",
  subtitle: "Find the keycards · reach the exit · stay unseen",
};

export const TUNING = {
  cell: 4,
  gridW: 13,
  gridH: 13,
  braid: 0.18, // fraction of dead ends opened into loops
  wallHeight: 3.2,
  keys: 5,
  walkSpeed: 3.6,
  sprintSpeed: 6.4,
  stamina: 5,
  staminaRegen: 0.4,
  eyeHeight: 1.6,
  radius: 0.3,
  battery: 120,
  flashlightRange: 22,
  // Stalker
  patrolSpeed: 2.1,
  chaseSpeed: 4.7,
  sightRange: 15,
  sightRangeLit: 22, // when your flashlight is on
  sightHalfAngle: 55, // degrees
  detectRate: 1.2, // per second in full view
  forgetRate: 0.45,
  loseTrackTime: 4,
  catchDistance: 1.1,
  graceTime: 6, // seconds before it starts hunting
};
