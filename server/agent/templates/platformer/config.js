/**
 * Tuning — the ScriptableObject equivalent. Map every quantified TDD number here.
 */
export const META = {
  title: "SKY HOPPER",
  subtitle: "Collect stars · reach the beacon",
};

export const TUNING = {
  moveSpeed: 7.5,
  groundAccel: 55,
  airAccel: 24,
  friction: 14,
  jumpVel: 11.5,
  doubleJumpVel: 10,
  jumpCut: 0.45, // releasing jump early multiplies upward velocity
  gravity: 30,
  fallGravityMul: 1.55,
  maxFall: 28,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  bounceVel: 21,
  lives: 3,
  starsToOpen: 15,
  timeLimit: 150,
  killY: -8,
  knockback: 9,
};
