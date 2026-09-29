/**
 * Look Bible — art direction for this slice. Written BEFORE gameplay code; every visual module reads from here.
 * Map TDD §8 (art/atmosphere), §9 (UI) and audio notes into these fields.
 * Horror rule: darkness is a material — readable silhouettes, few strong light pools, fog that eats corridors.
 */
export const LOOK = {
  look: {
    preset: "night",
    sun: { intensity: 0.04, shadows: false, disc: false },
    hemi: { sky: 0x2a3550, ground: 0x07080a, intensity: 0.22 },
    fog: { color: 0x07090d, density: 0.075 },
    env: 0.12,
    exposure: 1.35,
    bloom: { strength: 1.0, threshold: 0.55 },
    vignette: 0.6,
    grain: 0.055,
    chroma: 0.003,
  },
  hudTheme: "stealth",
  palette: {
    wall: 0x5d6168,
    wallTile: 0x6b6f76,
    grout: 0x3b3e44,
    floor: 0x2e3238,
    ceiling: 0x24272c,
    lamp: 0xdfe8ff,
    lampWarm: 0xffc98a,
    key: 0x31e1a0,
    exitLocked: 0xff3b3b,
    exitOpen: 0x3dff8a,
    stalker: 0x050505,
    stalkerEyes: 0xff2a2a,
  },
  audio: { music: "tense", ambience: "hum" },
  // First 10 seconds: black → title card → lamp flickers on → first corridor with a keycard glow in sight.
  // Wow moment: the stalker steps into a lamp pool at the end of a corridor; music intensity + heartbeat ramp.
};
