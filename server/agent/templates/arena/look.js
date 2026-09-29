/**
 * Look Bible — art direction for this slice. Written BEFORE gameplay code; every visual module reads from here.
 * Map TDD §8 (art/atmosphere), §9 (UI) and audio notes into these fields.
 */
export const LOOK = {
  look: { preset: "neon", fog: { density: 0.012 }, bloom: { strength: 1.1 } },
  hudTheme: { preset: "arcade", accent: "#4cc9f0" },
  palette: {
    hero: 0x4cc9f0,
    heroAccent: 0x1b1f3a,
    floor: 0x232b4d,
    floorLine: 0x4a5cb0,
    rim: 0xff3df2,
    pillar: 0x343c78,
    pillarGlow: 0x4cc9f0,
    portal: 0xff3d7f,
    bullet: 0x7cf8ff,
    heal: 0x3dff8a,
    city: 0x0d1024,
    windows: [0xff3df2, 0x4cc9f0, 0xffd23f],
  },
  audio: { music: "action", ambience: "room" },
  // First 10 seconds: slow orbit over the lit ring and city → title → "WAVE 1" → portals flare and spawn.
  // Wow moment: multi-kill chain = combo text + music intensity; final wave clear = slow-mo + confetti + rim flare.
  intro: { radius: 40, height: 22, endRadius: 16, endHeight: 14, duration: 3.2 },
};
