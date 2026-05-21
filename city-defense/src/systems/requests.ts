import type { World, NotableRequest } from '../world/world.ts';
import type { Notable } from '../ecs/components.ts';
import {
  REQUESTS, findTemplate,
} from '../data/requests.ts';
import type { RequestTemplate, RequestEffect, FulfilmentPredicate } from '../data/requests.ts';
import { nextFloat, nextInt } from '../engine/rng.ts';

const MAX_ACTIVE = 3;
const SPAWN_CHANCE_PER_DAY = 0.25;

export interface AcceptResult {
  ok: boolean;
  reason?: string;
}

// Daily entry point. Spawns at most one new request, advances task
// fulfilment, expires anything past its deadline.
export function advanceRequestsDay(world: World): void {
  expireAndFulfil(world);
  maybeSpawnRequest(world);
}

function expireAndFulfil(world: World): void {
  for (const r of world.requests) {
    if (r.status !== 'pending' && r.status !== 'accepted') continue;
    const tmpl = findTemplate(r.templateId);
    if (!tmpl) continue;

    if (r.status === 'accepted' && tmpl.fulfilment
        && checkFulfilment(world, tmpl.fulfilment)) {
      applyEffect(world, r.fromNotableId, tmpl.acceptReward);
      r.status = 'fulfilled';
      continue;
    }

    if (world.day >= r.deadlineDay) {
      if (tmpl.expirePenalty) applyEffect(world, r.fromNotableId, tmpl.expirePenalty);
      r.status = 'expired';
    }
  }
}

function maybeSpawnRequest(world: World): void {
  const active = world.requests.filter((r) => r.status === 'pending' || r.status === 'accepted');
  if (active.length >= MAX_ACTIVE) return;
  if (nextFloat(world.rng) > SPAWN_CHANCE_PER_DAY) return;

  const eligible: Array<{ tmpl: RequestTemplate; id: number; n: Notable }> = [];
  for (const tmpl of REQUESTS) {
    if (active.some((r) => r.templateId === tmpl.id)) continue;
    for (const [id, n] of world.components.notable.map) {
      if (!tmpl.fromRoles.includes(n.role)) continue;
      if (tmpl.requiredTrait && !n.traits.includes(tmpl.requiredTrait)) continue;
      eligible.push({ tmpl, id, n });
    }
  }
  if (eligible.length === 0) return;

  const chosen = eligible[nextInt(world.rng, eligible.length)]!;
  const tmpl = chosen.tmpl;
  const description = tmpl.body
    .replace('{name}', chosen.n.name)
    .replace('{deadline}', String(tmpl.deadlineDays));

  const req: NotableRequest = {
    id: `req-${world.day}-${world.tick}-${nextInt(world.rng, 1_000_000)}`,
    fromNotableId: chosen.id,
    templateId: tmpl.id,
    description,
    deadlineDay: world.day + tmpl.deadlineDays,
    status: 'pending',
  };
  world.requests.push(req);
}

export function acceptRequest(world: World, requestId: string): AcceptResult {
  const r = world.requests.find((x) => x.id === requestId);
  if (!r) return { ok: false, reason: 'unknown request' };
  if (r.status !== 'pending') return { ok: false, reason: `request is ${r.status}` };
  const tmpl = findTemplate(r.templateId);
  if (!tmpl) return { ok: false, reason: 'unknown template' };

  if (tmpl.acceptCost) {
    const c = tmpl.acceptCost;
    if (c.food && world.resources.food < c.food) return { ok: false, reason: 'not enough food' };
    if (c.gold && world.resources.gold < c.gold) return { ok: false, reason: 'not enough gold' };
    if (c.wood && world.resources.wood < c.wood) return { ok: false, reason: 'not enough wood' };
    if (c.stone && world.resources.stone < c.stone) return { ok: false, reason: 'not enough stone' };
    if (c.food) world.resources.food -= c.food;
    if (c.gold) world.resources.gold -= c.gold;
    if (c.wood) world.resources.wood -= c.wood;
    if (c.stone) world.resources.stone -= c.stone;
  }

  if (tmpl.kind === 'offer') {
    applyEffect(world, r.fromNotableId, tmpl.acceptReward);
    r.status = 'fulfilled';
  } else {
    // tasks stay open until the world predicate flips
    r.status = 'accepted';
  }
  return { ok: true };
}

export function declineRequest(world: World, requestId: string): void {
  const r = world.requests.find((x) => x.id === requestId);
  if (!r || r.status !== 'pending') return;
  const tmpl = findTemplate(r.templateId);
  if (!tmpl) return;
  if (tmpl.declinePenalty) applyEffect(world, r.fromNotableId, tmpl.declinePenalty);
  r.status = 'refused';
}

function checkFulfilment(world: World, kind: FulfilmentPredicate): boolean {
  if (kind === 'has-chapel') return hasOperational(world, 'chapel');
  if (kind === 'has-tavern') return hasOperational(world, 'tavern');
  if (kind === 'low-tax-pledge') return world.policy.taxRate <= 8;
  return false;
}

function hasOperational(world: World, kind: string): boolean {
  for (const b of world.components.building.map.values()) {
    if (b.kind === kind && b.state === 'operational') return true;
  }
  return false;
}

function applyEffect(world: World, fromId: number, eff: RequestEffect): void {
  if (eff.food) world.resources.food += eff.food;
  if (eff.gold) world.resources.gold += eff.gold;
  if (eff.wood) world.resources.wood += eff.wood;
  if (eff.stone) world.resources.stone += eff.stone;

  if (eff.loyalty) {
    const self = world.components.notable.map.get(fromId);
    if (self) self.personalLoyalty = clamp(self.personalLoyalty + eff.loyalty.selfDelta);

    if (eff.loyalty.othersDelta && self) {
      for (const [otherId, other] of world.components.notable.map) {
        if (otherId === fromId) continue;
        if (other.role !== self.role) continue;
        other.personalLoyalty = clamp(other.personalLoyalty + eff.loyalty.othersDelta);
      }
    }
  }
  if (eff.moraleDelta) {
    world.population.morale = clamp(world.population.morale + eff.moraleDelta);
  }
}

export function pendingRequests(world: World): NotableRequest[] {
  return world.requests.filter((r) => r.status === 'pending' || r.status === 'accepted');
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
