import type { World } from '../world/world.ts';
import { CONFIG } from '../data/config.ts';

export function collectTaxesDay(world: World): number {
  const gold = world.population.total
             * world.policy.taxRate
             * CONFIG.goldPerCitizenPerTaxPoint;
  world.resources.gold += gold;
  return gold;
}
