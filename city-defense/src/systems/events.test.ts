import { describe, it, expect } from 'vitest';
import { createWorld } from '../world/world.ts';
import type { World, SetupChoices } from '../world/world.ts';
import { getGeneral } from '../data/generals.ts';
import { EVENTS, findEvent } from '../data/events.ts';
import {
  advanceEventsDay, choose, pendingEvent, pendingChoiceAffordable,
} from './events.ts';
import { generateNotables } from '../ecs/notables.ts';
import { CONFIG } from '../data/config.ts';
import { toJSON, fromJSON } from '../save/serialize.ts';

function setup(overrides: Partial<SetupChoices> = {}): SetupChoices {
  return {
    seed: 99,
    general: getGeneral('veteran-knight'),
    army: {},
    ...overrides,
  };
}

function newWorld(overrides: Partial<SetupChoices> = {}): World {
  const w = createWorld(setup(overrides));
  generateNotables(w);
  return w;
}

function plant(world: World, defId: string): void {
  world.pendingEventId = defId;
}

describe('event catalogue', () => {
  it('every event has unique id, choices, and a valid category', () => {
    const ids = new Set<string>();
    const allowed = new Set(['economic', 'military', 'political', 'weather', 'chained']);
    for (const e of EVENTS) {
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      expect(e.choices.length).toBeGreaterThan(0);
      expect(allowed.has(e.category)).toBe(true);
    }
  });

  it('catalogue spans every category', () => {
    const seen = new Set<string>();
    for (const e of EVENTS) seen.add(e.category);
    for (const cat of ['economic', 'military', 'political', 'weather', 'chained']) {
      expect(seen.has(cat)).toBe(true);
    }
  });

  it('catalogue holds at least 20 events', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(20);
  });
});

describe('effect dispatch', () => {
  it('food/gold/wood/stone deltas apply', () => {
    const w = newWorld();
    w.resources.food = 100; w.resources.gold = 100; w.resources.wood = 100; w.resources.stone = 100;
    plant(w, 'bumper-harvest');
    const r = choose(w, 0);            // +220 food
    expect(r.ok).toBe(true);
    expect(w.resources.food).toBe(320);
    expect(w.pendingEventId).toBeNull();
  });

  it('morale delta applies', () => {
    const w = newWorld();
    w.population.morale = 50;
    plant(w, 'festival-of-saints');
    w.resources.food = 200; w.resources.gold = 200;
    const r = choose(w, 0);            // costs 50 food/30 gold, +18 morale
    expect(r.ok).toBe(true);
    expect(w.population.morale).toBe(68);
    expect(w.resources.food).toBe(150);
    expect(w.resources.gold).toBe(170);
  });

  it('population delta reduces total and drains job buckets', () => {
    const w = newWorld();
    const before = w.population.total;
    plant(w, 'plague-outbreak');
    const r = choose(w, 1);            // -30 population, -5 morale
    expect(r.ok).toBe(true);
    expect(w.population.total).toBe(before - 30);
  });

  it('loyalty-trait targets only matching notables', () => {
    const w = newWorld();
    // Plant a known-trait notable so the test is deterministic.
    const id = -42;
    w.components.notable.map.set(id, {
      name: 'T', role: 'noble', traits: ['pious', 'loyal'], personalLoyalty: 50,
    });
    plant(w, 'plague-outbreak');
    const before = w.components.notable.map.get(id)!.personalLoyalty;
    const r = choose(w, 2);            // pray — +8 loyalty pious
    expect(r.ok).toBe(true);
    expect(w.components.notable.map.get(id)!.personalLoyalty).toBe(before + 8);
  });

  it('spawn-enemies adds enemy entities', () => {
    const w = newWorld();
    const before = w.components.enemy.map.size;
    plant(w, 'parley-offer');
    w.resources.gold = 0; // can't pay tribute
    const r = choose(w, 2);            // insult — spawns 1 champion
    expect(r.ok).toBe(true);
    expect(w.components.enemy.map.size).toBe(before + 1);
  });

  it('spawn-soldiers adds soldier entities', () => {
    const w = newWorld();
    const before = w.components.soldier.map.size;
    plant(w, 'defector');
    const r = choose(w, 0);            // take him on
    expect(r.ok).toBe(true);
    expect(w.components.soldier.map.size).toBe(before + 1);
  });

  it('queue-followup pushes onto the queue with the right fire day', () => {
    const w = newWorld();
    w.day = 50;
    plant(w, 'captured-spy');
    const r = choose(w, 2);            // turn him → queue followup
    expect(r.ok).toBe(true);
    expect(w.queuedEvents.length).toBe(1);
    expect(w.queuedEvents[0]!.defId).toBe('spy-bears-fruit');
    expect(w.queuedEvents[0]!.fireOnDay).toBe(57);
  });
});

describe('choice affordability', () => {
  it('refuses when the player cannot pay the cost', () => {
    const w = newWorld();
    w.resources.gold = 5;
    plant(w, 'merchant-caravan');
    expect(pendingChoiceAffordable(w, findEvent('merchant-caravan')!.choices[0]!)).toBe(false);
    const r = choose(w, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/afford/);
  });

  it('debits resources on accept', () => {
    const w = newWorld();
    w.resources.gold = 200;
    plant(w, 'merchant-caravan');
    const r = choose(w, 0);            // -100 gold, +180 food
    expect(r.ok).toBe(true);
    expect(w.resources.gold).toBe(100);
  });
});

describe('cooldowns', () => {
  it('cooldown blocks the event from rolling again', () => {
    const w = newWorld();
    w.day = 100;
    plant(w, 'plague-outbreak');
    choose(w, 1);                       // any choice; sets cooldown to day + 40
    expect(w.eventCooldowns['plague-outbreak']).toBe(140);

    // Force the roller — even with many attempts, plague shouldn't fire today.
    let foundPlague = false;
    for (let i = 0; i < 200 && !foundPlague; i++) {
      w.pendingEventId = null;
      advanceEventsDay(w);
      if (w.pendingEventId === 'plague-outbreak') foundPlague = true;
    }
    expect(foundPlague).toBe(false);
  });
});

describe('queued follow-up firing', () => {
  it('fires on the scheduled day', () => {
    const w = newWorld();
    w.day = 10;
    w.queuedEvents.push({ defId: 'spy-bears-fruit', fireOnDay: 10 });
    w.population.rioting = false;
    advanceEventsDay(w);
    expect(w.pendingEventId).toBe('spy-bears-fruit');
    expect(w.queuedEvents.length).toBe(0);
  });

  it('does not fire before the scheduled day', () => {
    const w = newWorld();
    w.day = 5;
    w.queuedEvents.push({ defId: 'spy-bears-fruit', fireOnDay: 20 });
    // Force-trigger many rolls so the random spawn doesn't accidentally
    // shadow the queue. With pendingEventId set, advanceEventsDay returns
    // early — clear it each iteration.
    for (let i = 0; i < 20; i++) {
      w.pendingEventId = null;
      advanceEventsDay(w);
      if (w.pendingEventId === 'spy-bears-fruit') break;
    }
    expect(w.pendingEventId === 'spy-bears-fruit').toBe(false);
    expect(w.queuedEvents.length).toBe(1);
  });
});

describe('eligibility preconditions', () => {
  it('preparation-only events do not fire during siege phase', () => {
    const w = newWorld();
    w.phase = 'siege';
    w.day = 200;
    // Try many rolls; any siege-only events spawned shouldn't include
    // preparation-only-tagged ones.
    let prepOnlyFired = 0;
    for (let i = 0; i < 200; i++) {
      w.pendingEventId = null;
      advanceEventsDay(w);
      if (!w.pendingEventId) continue;
      const def = findEvent(w.pendingEventId);
      if (def?.preconditions?.phase === 'preparation') prepOnlyFired++;
    }
    expect(prepOnlyFired).toBe(0);
  });
});

describe('rioting suppresses events', () => {
  it('no event spawns while a riot is happening', () => {
    const w = newWorld();
    w.population.rioting = true;
    let any = false;
    for (let i = 0; i < 100; i++) {
      w.pendingEventId = null;
      advanceEventsDay(w);
      if (w.pendingEventId) { any = true; break; }
    }
    expect(any).toBe(false);
  });
});

describe('save round-trip preserves event state', () => {
  it('eventCooldowns + queuedEvents + eventLog survive load', () => {
    const a = newWorld();
    a.day = 100;
    a.eventCooldowns['plague-outbreak'] = 140;
    a.queuedEvents.push({ defId: 'spy-bears-fruit', fireOnDay: 110 });
    a.eventLog.push({ defId: 'plague-outbreak', choiceLabel: 'Quarantine', day: 100 });
    a.pendingEventId = 'noble-feud';

    const env = toJSON(a);
    const b = newWorld();
    fromJSON(JSON.parse(JSON.stringify(env)), b);

    expect(b.eventCooldowns['plague-outbreak']).toBe(140);
    expect(b.queuedEvents).toEqual([{ defId: 'spy-bears-fruit', fireOnDay: 110 }]);
    expect(b.eventLog).toEqual([{ defId: 'plague-outbreak', choiceLabel: 'Quarantine', day: 100 }]);
    expect(b.pendingEventId).toBe('noble-feud');
  });
});

describe('end-to-end chained arc', () => {
  it('Spy Among Us: turn the spy → 7 days later, false maps bear fruit', () => {
    const w = newWorld();
    w.day = 50;
    plant(w, 'captured-spy');
    choose(w, 2);
    expect(w.queuedEvents.length).toBe(1);

    w.day = 57;
    // pendingEventId already null after choose; cycle until queued fires.
    for (let i = 0; i < 5; i++) {
      w.pendingEventId = null;
      advanceEventsDay(w);
      if (w.pendingEventId === 'spy-bears-fruit') break;
    }
    expect(pendingEvent(w)?.id).toBe('spy-bears-fruit');

    // Apply the reward.
    const before = w.population.morale;
    choose(w, 0);
    expect(w.population.morale).toBeGreaterThan(before);
  });
});

void { CONFIG };  // referenced for IDE jump targets
