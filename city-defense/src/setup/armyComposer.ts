import type { ArmyComposition, GeneralChoice } from '../world/world.ts';
import type { UnitKind } from '../ecs/components.ts';
import { UNITS, STARTING_UNIT_KINDS } from '../data/units.ts';
import { CONFIG } from '../data/config.ts';
import { armyGoldCost, armyDailyFoodCost, armyDailyUpkeep, totalSoldiers } from '../systems/recruitment.ts';

export interface ArmyComposer {
  root: HTMLElement;
  composition(): ArmyComposition;
  setGeneral(g: GeneralChoice): void;
}

const DEFAULT_COMP: ArmyComposition = {
  spearman: 8,
  crossbowman: 4,
  'men-at-arms': 2,
  knight: 0,
};

export function createArmyComposer(): ArmyComposer {
  const root = document.createElement('div');
  root.style.cssText = 'display: flex; flex-direction: column; gap: 0.6rem;';

  const comp: ArmyComposition = { ...DEFAULT_COMP };
  let general: GeneralChoice | null = null;

  const header = document.createElement('div');
  header.style.cssText = 'color:#d4a050; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em;';
  header.textContent = 'Starting Army';
  root.append(header);

  const rows = new Map<UnitKind, { count: HTMLElement; row: HTMLElement }>();
  for (const k of STARTING_UNIT_KINDS) {
    const def = UNITS[k];
    const row = document.createElement('div');
    row.style.cssText = `
      display: grid; grid-template-columns: 8.5rem 5.5rem 1fr;
      gap: 0.4rem; align-items: center;
      background: #2a1f15; border: 1px solid #5a4530;
      padding: 0.4rem 0.6rem;
    `;

    const label = document.createElement('div');
    label.innerHTML = `
      <div style="font-weight:bold; color:#e6dcc8;">${def.label}</div>
      <div style="font-size:0.7rem; color:#9a8e74;">${def.goldCost}g · A${def.attack}/D${def.defence}${def.ranged ? ' · ranged' : ''}</div>
    `;

    const stepper = document.createElement('div');
    stepper.style.cssText = 'display:flex; gap:0.25rem; align-items:center;';
    const minus = stepBtn('−');
    const count = document.createElement('div');
    count.style.cssText = 'min-width: 1.8rem; text-align: center; font-variant-numeric: tabular-nums;';
    count.textContent = String(comp[k] ?? 0);
    const plus = stepBtn('+');
    minus.addEventListener('click', () => { adjust(k, -1); });
    plus.addEventListener('click', () => { adjust(k, +1); });
    stepper.append(minus, count, plus);

    const blurb = document.createElement('div');
    blurb.style.cssText = 'font-size: 0.75rem; color: #9a8e74; line-height: 1.3;';
    blurb.textContent = def.blurb;

    row.append(label, stepper, blurb);
    root.append(row);
    rows.set(k, { count, row });
  }

  // Metrics panel
  const metrics = document.createElement('div');
  metrics.style.cssText = `
    background: #1f1810; border: 1px solid #3a2a1a; padding: 0.7rem;
    font-size: 0.85rem; line-height: 1.5;
  `;
  root.append(metrics);

  function adjust(k: UnitKind, delta: number) {
    const next = Math.max(0, (comp[k] ?? 0) + delta);
    const trial: ArmyComposition = { ...comp, [k]: next };
    if (delta > 0 && armyGoldCost(trial) > availableGold()) return; // can't afford
    comp[k] = next;
    refresh();
  }

  function availableGold(): number {
    const base = CONFIG.startingGold;
    const bonus = general?.buff.startingGoldBonus ?? 0;
    return base + bonus;
  }

  function refresh() {
    for (const k of STARTING_UNIT_KINDS) {
      const r = rows.get(k)!;
      r.count.textContent = String(comp[k] ?? 0);
    }
    const spent = armyGoldCost(comp);
    const avail = availableGold();
    const left = avail - spent;
    const totalSoldierCount = totalSoldiers(comp);
    const dailyFood = armyDailyFoodCost(comp) * (1 + (general?.buff.foodConsumptionPct ?? 0) / 100);
    const dailyUpkeep = armyDailyUpkeep(comp);
    const startingFood = CONFIG.startingFood + (general?.buff.startingFoodBonus ?? 0);
    const dailyCitizenFood = CONFIG.startingPopulation * CONFIG.foodPerCitizenPerDay
                            * (1 + (general?.buff.foodConsumptionPct ?? 0) / 100);
    const totalDaily = dailyCitizenFood + dailyFood;
    const daysOfFood = totalDaily > 0 ? Math.floor(startingFood / totalDaily) : Infinity;

    metrics.innerHTML = `
      <div><strong>Total soldiers:</strong> ${totalSoldierCount}</div>
      <div><strong>Gold:</strong> ${spent} spent · <span style="color:${left < 0 ? '#e06060' : '#90c090'}">${left} remaining</span> of ${avail}</div>
      <div><strong>Daily food cost:</strong> ${dailyFood.toFixed(1)} (army) + ${dailyCitizenFood.toFixed(1)} (city) = ${totalDaily.toFixed(1)}</div>
      <div><strong>Daily upkeep:</strong> ${dailyUpkeep.toFixed(1)}g</div>
      <div style="margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px dashed #5a4530;">
        <strong>Days of starting food at this army size:</strong>
        <span style="color:${daysOfFood < 5 ? '#e06060' : daysOfFood < 10 ? '#d4a050' : '#90c090'}; font-size: 1.05rem;"> ${daysOfFood} days</span>
      </div>
    `;
  }
  refresh();

  return {
    root,
    composition() {
      // Strip zero entries so the save doesn't carry them.
      const out: ArmyComposition = {};
      for (const k of STARTING_UNIT_KINDS) if ((comp[k] ?? 0) > 0) out[k] = comp[k];
      return out;
    },
    setGeneral(g) { general = g; refresh(); },
  };
}

function stepBtn(label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = `
    width: 1.5rem; height: 1.5rem;
    background: #5a4530; color: #f0e4c8; border: 1px solid #8a6a45;
    cursor: pointer; font-family: inherit; font-size: 0.95rem;
    padding: 0; line-height: 1;
  `;
  return b;
}
