/**
 * Look Bible — art direction for this slice. Written BEFORE gameplay code; every visual module reads from here.
 * Map TDD §8 (art/atmosphere), §9 (UI) and audio notes into these fields.
 */
export const LOOK = {
  // LookKit preset: sunny | candy | dusk | night | neon | liminal | noir | underwater | studio
  look: {
    preset: "sunny",
    bloom: { strength: 0.3 },
    grade: { saturation: 1.22 },
  },
  hudTheme: "arcade",
  groundColor: 0x6fb85a,
  palette: {
    player: 0xff4d3d,
    rivals: [0x3a86ff, 0xffbe0b, 0x8338ec, 0x06d6a0],
    asphalt: 0x3b4048,
    curbA: 0xe53935,
    curbB: 0xf5f5f5,
    arch: 0x23263a,
    archGlow: 0xffd23f,
    itemBox: 0x4cc9f0,
    boostPad: 0xff7b00,
    trees: [0x4caf50, 0x3f9c4a, 0x66bb6a],
  },
  audio: { music: "arcade", ambience: "wind" },
  // First 10 seconds (storyboard): orbit intro over the start arch → title card → 3-2-1-GO → engines roar
  intro: { radius: 38, height: 18, endRadius: 9, endHeight: 3.5, duration: 3.2 },
  // Wow moment: final-lap title + music intensity up; finish = slow-mo, FOV kick, confetti burst under the arch
};
