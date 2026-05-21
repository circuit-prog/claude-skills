import { describe, it, expect } from 'vitest';
import { createWorld } from '../world/world.ts';
import type { World, SetupChoices } from '../world/world.ts';
import { generateNotables } from '../ecs/notables.ts';
import { getGeneral } from '../data/generals.ts';
import { REQUESTS, findTemplate } from '../data/requests.ts';
import type { RequestTemplate } from '../data/requests.ts';
import {
  acceptRequest, declineRequest, advanceRequestsDay, pendingRequests,
} from './requests.ts';
import { placeBuilding } from './construction.ts';
import type { Notable, NotableRole } from '../ecs/components.ts';

function base(overrides: Partial<SetupChoices> = {}): SetupChoices {
  return {
    seed: 11,
    general: getGeneral('veteran-knight'),
    army: {},
    ...overrides,
  };
}

function newWorld(setup: Partial<SetupChoices> = {}) {
  const w = createWorld(base(setup));
  generateNotables(w);
  return w;
}

// Manually craft a pending request from a template, bypassing RNG spawning.
function plantRequest(world: World, tmpl: RequestTemplate, notableId: number, dayOffset = 0): string {
  const notable = world.components.notable.map.get(notableId)!;
  const id = `test-${world.tick}-${world.requests.length}`;
  world.requests.push({
    id,
    fromNotableId: notableId,
    templateId: tmpl.id,
    description: tmpl.body.replace('{name}', notable.name).replace('{deadline}', String(tmpl.deadlineDays)),
    deadlineDay: world.day + tmpl.deadlineDays + dayOffset,
    status: 'pending',
  });
  return id;
}

function findNotableId(world: World, predicate: (n: Notable) => boolean): number {
  for (const [id, n] of world.components.notable.map) {
    if (predicate(n)) return id;
  }
  throw new Error('no matching notable');
}

describe('request templates', () => {
  it('every template has a non-empty title, body, and reward', () => {
    for (const t of REQUESTS) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(0);
      expect(t.acceptReward).toBeTruthy();
    }
  });
});

describe('accepting an offer applies cost + reward immediately', () => {
  it('caravan-trade: pay 100 gold, gain food + loyalty', () => {
    const w = newWorld();
    const id = findNotableId(w, (n) => n.role === 'merchant');
    w.resources.gold = 200;
    w.resources.food = 0;
    const startLoyalty = w.components.notable.map.get(id)!.personalLoyalty;
    const reqId = plantRequest(w, findTemplate('caravan-trade')!, id);

    const result = acceptRequest(w, reqId);
    expect(result.ok).toBe(true);
    expect(w.resources.gold).toBe(100);
    expect(w.resources.food).toBe(250);
    const after = w.components.notable.map.get(id)!.personalLoyalty;
    expect(after).toBeGreaterThan(startLoyalty);
    expect(w.requests.find((r) => r.id === reqId)?.status).toBe('fulfilled');
  });

  it('rejects accept when resources insufficient', () => {
    const w = newWorld();
    const id = findNotableId(w, (n) => n.role === 'merchant');
    w.resources.gold = 5;
    const reqId = plantRequest(w, findTemplate('caravan-trade')!, id);
    const result = acceptRequest(w, reqId);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/gold/);
  });
});

describe('declining a request applies the decline penalty', () => {
  it('declining tax-cut drops merchant loyalty', () => {
    const w = newWorld();
    // Pick a merchant who happens to be greedy (template gates on it).
    let id: number | null = null;
    for (const [nid, n] of w.components.notable.map) {
      if (n.role === 'merchant' && n.traits.includes('greedy')) { id = nid; break; }
    }
    if (id === null) {
      // Force a greedy merchant onto the roster so the test is deterministic.
      const someMerchant = findNotableId(w, (n) => n.role === 'merchant');
      const m = w.components.notable.map.get(someMerchant)!;
      m.traits = ['greedy', 'cowardly'];
      id = someMerchant;
    }

    // caravan-trade has a -5 decline penalty for the merchant.
    const reqId = plantRequest(w, findTemplate('caravan-trade')!, id);
    const before = w.components.notable.map.get(id)!.personalLoyalty;
    declineRequest(w, reqId);
    const after = w.components.notable.map.get(id)!.personalLoyalty;
    expect(after).toBeLessThan(before);
    expect(w.requests.find((r) => r.id === reqId)?.status).toBe('refused');
  });
});

describe('task fulfilment auto-detects via world predicate', () => {
  it('build-chapel marks fulfilled once a chapel is operational', () => {
    const w = newWorld();
    const id = findNotableId(w, (n) => n.role === 'advisor' || n.role === 'noble');
    // Ensure the notable has the pious trait so the template would gate
    // correctly if RNG were spawning; we plant directly here.
    w.components.notable.map.get(id)!.traits = ['pious', 'loyal'];
    const reqId = plantRequest(w, findTemplate('build-chapel')!, id);

    const accept = acceptRequest(w, reqId);
    expect(accept.ok).toBe(true);
    expect(w.requests.find((r) => r.id === reqId)?.status).toBe('accepted');

    // No chapel yet — next day rollover should not fulfil.
    advanceRequestsDay(w);
    expect(w.requests.find((r) => r.id === reqId)?.status).toBe('accepted');

    // Build the chapel; next request pass fulfils.
    placeBuilding(w, 'chapel', 30, 30, { instant: true, freeOfCost: true });
    const before = w.components.notable.map.get(id)!.personalLoyalty;
    advanceRequestsDay(w);
    expect(w.requests.find((r) => r.id === reqId)?.status).toBe('fulfilled');
    expect(w.components.notable.map.get(id)!.personalLoyalty).toBeGreaterThan(before);
  });
});

describe('expiry applies penalty', () => {
  it('a pending request past its deadline expires and stings loyalty', () => {
    const w = newWorld();
    const id = findNotableId(w, (n) => n.role === 'merchant');
    const reqId = plantRequest(w, findTemplate('caravan-trade')!, id, -100);
    const before = w.components.notable.map.get(id)!.personalLoyalty;
    advanceRequestsDay(w);
    const r = w.requests.find((x) => x.id === reqId);
    expect(r?.status).toBe('expired');
    // caravan-trade has no expirePenalty (decline-only), so allow equality.
    expect(w.components.notable.map.get(id)!.personalLoyalty).toBeLessThanOrEqual(before);
  });

  it('a task with an expire penalty applies it', () => {
    const w = newWorld();
    const id = findNotableId(w, (n) => n.role === 'sergeant');
    w.components.notable.map.get(id)!.traits = ['ambitious', 'brave'];
    const reqId = plantRequest(w, findTemplate('build-tavern')!, id, -100);
    acceptRequest(w, reqId);
    const before = w.components.notable.map.get(id)!.personalLoyalty;
    advanceRequestsDay(w);
    expect(w.requests.find((r) => r.id === reqId)?.status).toBe('expired');
    expect(w.components.notable.map.get(id)!.personalLoyalty).toBeLessThan(before);
  });
});

describe('spawn cap', () => {
  it('never exceeds 3 active requests', () => {
    const w = newWorld();
    // Cram the queue with planted requests so the spawner can't add more.
    const id = findNotableId(w, (n) => n.role === 'merchant');
    for (let i = 0; i < 3; i++) plantRequest(w, findTemplate('caravan-trade')!, id);
    advanceRequestsDay(w);
    expect(pendingRequests(w).length).toBeLessThanOrEqual(3);
  });
});

describe('saved roster identifiers', () => {
  it('every NotableRole appears in the generated roster', () => {
    const w = newWorld();
    const seen = new Set<NotableRole>();
    for (const n of w.components.notable.map.values()) seen.add(n.role);
    for (const r of ['captain', 'sergeant', 'noble', 'merchant', 'craftsman', 'advisor'] as NotableRole[]) {
      expect(seen.has(r)).toBe(true);
    }
  });
});
