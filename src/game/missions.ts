// Mission card IDs (spec §3.8). Full definitions (conditions + rewards) are
// implemented in Plan 2; Plan 1 only needs stable ids to build a valid deck.
export const MISSION_IDS: readonly string[] = [
  'pioneer', // First to build 3 Habitats — 2 VP
  'ice-baron', // Control 3 Ice-adjacent buildings — 2 VP
  'engineer', // Own Comm Tower — 1 VP + 2 ENG
  'cartographer', // Routes touching all 4 terrains — 2 VP
  'geologist', // Own a building in all 4 producing terrains — 3 VP
  'long-haul', // Build 4 Route segments in one turn — 1 VP + 2 ENG
  'researcher', // Own 2 Tech Cards — 2 VP
  'industrialist', // Have 2 Domes — 2 VP
  'dustkeeper', // Place Dust Storm 3 times — 1 VP
  'stockpile', // Hold 10 resources at end of your turn — 1 VP
  'alchemist', // Trade with opponent 3 times — 1 VP + 1 RES
  'sprinter', // Win Longest Route (>=5 segments) — 2 VP
  'diversified', // Own 1 of each building type — 3 VP
  'astronomer', // Roll three 7s during the game — 1 VP
  'solar-mogul', // Control 3 Crater-adjacent buildings — 2 VP
  'networker', // Build 2nd Route extension to opponent's edge — 1 VP
  'survivor', // Take Dust Storm damage 3 times — 1 VP
  'first-light', // First to research T1 of any track — 1 VP
];
