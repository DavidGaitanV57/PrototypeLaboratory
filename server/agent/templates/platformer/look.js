/**
 * Look Bible — art direction for this slice. Written BEFORE gameplay code; every visual module reads from here.
 * Map TDD §8 (art/atmosphere), §9 (UI) and audio notes into these fields.
 */
export const LOOK = {
  look: { preset: "candy", fog: { density: 0.006 } },
  hudTheme: { preset: "arcade", accent: "#ffd23f" },
  palette: {
    hero: 0xff5a36,
    heroAccent: 0x2b2d42,
    grass: 0x7bd389,
    earth: 0xc58b5c,
    moving: 0x9b8cff,
    bounce: 0xff4fa3,
    hazard: 0xff3b3b,
    star: 0xffd23f,
    beacon: 0x4cc9f0,
    sea: 0x7fc8ff,
    seaDeep: 0x4b7bd6,
  },
  audio: { music: "chill", ambience: "wind" },
  // First 10 seconds: orbit around the start island showing the beacon far above → title → control.
  intro: { radius: 26, height: 14, endRadius: 12, endHeight: 6, duration: 3 },
  // Wow moment: bounce pad launch with FOV kick + ring; beacon activation = slow-mo + confetti + light beam.
};
