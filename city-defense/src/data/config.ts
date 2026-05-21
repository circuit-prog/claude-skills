// Global tuning knobs. Changing values here re-balances the game.

export const CONFIG = {
  // Simulation
  tickMs: 100,                 // 10 sim ticks per real second at 1x speed
  ticksPerGameDay: 300,        // 30 real seconds per game day at 1x

  // Map
  mapWidth: 80,
  mapHeight: 60,
  tileSize: 32,

  // Win / loss
  daysUntilSiege: 30,          // length of preparation phase
  daysToSurvive: 180,          // win condition

  // Food
  foodPerCitizenPerDay: 1,
  foodPerSoldierPerDay: 2,
  starvationDeathThresholdPct: 25,
  faminePanicDays: 5,

  // Morale thresholds (commoner pool, 0–100)
  unrestThreshold: 35,
  revoltThreshold: 15,
  unrestDaysBeforeRiot: 5,

  // Starting resources (overridden by general buff + army composition)
  startingFood: 400,
  startingGold: 500,
  startingWood: 200,
  startingStone: 100,
  startingPopulation: 120,
} as const;

export type Config = typeof CONFIG;
