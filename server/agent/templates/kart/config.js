/**
 * Tuning — the ScriptableObject equivalent. Map every quantified TDD number here.
 */
export const META = {
  title: "TURBO LOOP",
  subtitle: "3 laps · drift to charge boosts",
};

export const TUNING = {
  laps: 3,
  rivals: 3,
  maxSpeed: 30,
  reverseSpeed: 9,
  accel: 17,
  brake: 34,
  coastDrag: 0.45,
  steerRate: 2.1,
  driftSteerMul: 1.45,
  driftMinSpeed: 12,
  driftSlide: 0.18,
  miniTurbo: [0.7, 1.5], // seconds of drift for blue / orange spark tiers
  boostSpeed: 42,
  boostTime: [0.6, 1.1],
  offroadMul: 0.55,
  trackWidth: 13,
  itemBoxRespawn: 3,
  turboItemTime: 1.4,
  shockSlowTime: 1.6,
  aiSkill: [0.9, 0.97, 1.02],
  rubberBand: 0.08,
  countdown: 3,
};
