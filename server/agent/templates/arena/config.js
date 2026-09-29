/**
 * Tuning — the ScriptableObject equivalent. Map every quantified TDD number here.
 */
export const META = {
  title: "NEON RING",
  subtitle: "Survive every wave",
};

export const TUNING = {
  arenaRadius: 22,
  moveSpeed: 9,
  accel: 60,
  dashSpeed: 26,
  dashTime: 0.18,
  dashCooldown: 0.9,
  fireRate: 8, // shots per second
  bulletSpeed: 40,
  bulletLife: 0.9,
  hp: 6,
  invulnTime: 0.9,
  contactDamage: 1,
  pickupChance: 0.22,
  heal: 1,
  scorePerKill: 100,
  comboWindow: 1.6,
  spawnInterval: 0.45,
  // Enemy archetypes
  enemies: {
    grunt: { hp: 2, speed: 4.2, radius: 0.6, color: 0xff3d7f, score: 100 },
    dasher: { hp: 1, speed: 7.5, radius: 0.45, color: 0xffd23f, score: 150 },
    brute: { hp: 7, speed: 2.6, radius: 1.1, color: 0x9d4dff, score: 400 },
  },
  waves: [
    { grunt: 6 },
    { grunt: 8, dasher: 3 },
    { grunt: 8, dasher: 5, brute: 1 },
    { grunt: 10, dasher: 6, brute: 2 },
    { grunt: 12, dasher: 8, brute: 4 },
  ],
};
