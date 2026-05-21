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
  baseFoodStorageCap: 800,
  starvationDeathThresholdPct: 25,   // % of starting population to trigger loss
  faminePanicDays: 5,
  seasonFoodMultiplier: {
    spring: 1.0,
    summer: 1.2,
    autumn: 1.0,
    winter: 0.4,
  } as const,

  // Morale (commoner pool, 0–100)
  moraleBase: 50,
  moraleHomelessPerCitizen: -1.0,
  moraleHungerWhenStarving: -25,
  moraleHungerPerDayWithoutFood: -5,
  moraleTaxPerPoint: -0.6,           // % above baseline 10
  moraleTaxBaseline: 10,
  moraleSeasonalWinter: -5,
  moraleSiegePhase: -8,
  unrestThreshold: 35,
  revoltThreshold: 15,
  unrestDaysBeforeRiot: 5,
  riotDamagePerDay: 6,               // HP/day to a random building during a riot

  // Economy
  taxBaselineRate: 10,               // %, neutral; below boosts morale, above lowers
  goldPerCitizenPerTaxPoint: 0.05,   // daily gold per citizen per tax-rate-pct

  // Combat
  attackCooldownTicks: 6,            // ticks between attacks
  combatRange: 1,                    // melee adjacency
  rangedRange: 4,                    // crossbow / tower
  soldierEngageRange: 5,             // sally hunting radius

  // Starting resources (overridden by general buff + army composition)
  startingFood: 400,
  startingGold: 500,
  startingWood: 200,
  startingStone: 100,
  startingPopulation: 120,
  startingHousingFromKeep: 40,       // the Keep shelters a small starting pop
} as const;

export type Config = typeof CONFIG;
