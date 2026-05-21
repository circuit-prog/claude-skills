import type { NotableRole, NotableTrait } from '../ecs/components.ts';

// 'offer'   — accept/decline decision; effects apply on click.
// 'task'    — pending until a world predicate is satisfied (or deadline expires).
export type RequestKind = 'offer' | 'task';

export type FulfilmentPredicate = 'has-chapel' | 'has-tavern' | 'low-tax-pledge';

export interface RequestEffect {
  food?: number;
  gold?: number;
  wood?: number;
  stone?: number;
  // Loyalty changes: selfDelta to the requester, othersDelta to other notables
  // of the same role (so a noble feast pleases the houses).
  loyalty?: { selfDelta: number; othersDelta?: number };
  moraleDelta?: number;
}

export interface RequestTemplate {
  id: string;
  kind: RequestKind;
  fromRoles: NotableRole[];
  requiredTrait?: NotableTrait;
  deadlineDays: number;
  title: string;
  body: string;                       // tokens: {name}, {deadline}
  fulfilment?: FulfilmentPredicate;   // task-only
  acceptCost?: RequestEffect;
  acceptReward: RequestEffect;
  declinePenalty?: RequestEffect;
  expirePenalty?: RequestEffect;
}

// Hand-authored template set. Spawning logic in systems/requests.ts picks
// templates whose role/trait gates match an existing notable.
export const REQUESTS: RequestTemplate[] = [
  {
    id: 'tax-cut',
    kind: 'task',
    fromRoles: ['merchant'],
    requiredTrait: 'greedy',
    deadlineDays: 15,
    title: 'A merchant\'s plea',
    body: '{name} asks that you keep the tax rate at 8% or below for {deadline} days. In return, the markets will pay 80 gold up front.',
    fulfilment: 'low-tax-pledge',
    acceptReward: { gold: 80, loyalty: { selfDelta: 20, othersDelta: 5 } },
    expirePenalty: { loyalty: { selfDelta: -15 } },
  },
  {
    id: 'noble-feast',
    kind: 'offer',
    fromRoles: ['noble'],
    requiredTrait: 'greedy',
    deadlineDays: 8,
    title: 'A feast for the houses',
    body: '{name} demands you host a feast — 120 food and 50 gold from the treasury. The houses will sing your name.',
    acceptCost: { food: 120, gold: 50 },
    acceptReward: { loyalty: { selfDelta: 30, othersDelta: 5 } },
    declinePenalty: { loyalty: { selfDelta: -20 } },
    expirePenalty: { loyalty: { selfDelta: -10 } },
  },
  {
    id: 'caravan-trade',
    kind: 'offer',
    fromRoles: ['merchant'],
    deadlineDays: 10,
    title: 'A timely caravan',
    body: '{name} offers 250 grain for the city stores in exchange for 100 gold. The price is fair.',
    acceptCost: { gold: 100 },
    acceptReward: { food: 250, loyalty: { selfDelta: 15 } },
    declinePenalty: { loyalty: { selfDelta: -5 } },
  },
  {
    id: 'execute-rival',
    kind: 'offer',
    fromRoles: ['noble'],
    requiredTrait: 'cruel',
    deadlineDays: 7,
    title: 'A matter of blood',
    body: '{name} demands you imprison a rival noble. Refusal will be remembered. So will compliance.',
    acceptReward: { loyalty: { selfDelta: 35, othersDelta: -20 } },
    declinePenalty: { loyalty: { selfDelta: -25 } },
    expirePenalty: { loyalty: { selfDelta: -10 } },
  },
  {
    id: 'build-chapel',
    kind: 'task',
    fromRoles: ['advisor', 'noble'],
    requiredTrait: 'pious',
    deadlineDays: 25,
    title: 'A chapel for the people',
    body: '{name} asks that a chapel rise within {deadline} days. The people pray and grow restless.',
    fulfilment: 'has-chapel',
    acceptReward: { loyalty: { selfDelta: 25, othersDelta: 3 }, moraleDelta: 5 },
    expirePenalty: { loyalty: { selfDelta: -15 }, moraleDelta: -3 },
  },
  {
    id: 'build-tavern',
    kind: 'task',
    fromRoles: ['sergeant'],
    requiredTrait: 'ambitious',
    deadlineDays: 20,
    title: 'A tavern for the garrison',
    body: '{name} swears the watchmen need a place to drink. Build a tavern within {deadline} days.',
    fulfilment: 'has-tavern',
    acceptReward: { loyalty: { selfDelta: 20 } },
    expirePenalty: { loyalty: { selfDelta: -12 } },
  },
  {
    id: 'tribute-stone',
    kind: 'offer',
    fromRoles: ['craftsman'],
    deadlineDays: 10,
    title: 'A gift of stone',
    body: '{name} pledges 80 stone for the walls in exchange for 60 gold up front. Trust pays in stone, not promises.',
    acceptCost: { gold: 60 },
    acceptReward: { stone: 80, loyalty: { selfDelta: 12 } },
    declinePenalty: { loyalty: { selfDelta: -5 } },
  },
  {
    id: 'morale-bribe',
    kind: 'offer',
    fromRoles: ['advisor'],
    deadlineDays: 6,
    title: 'A coin in every hand',
    body: '{name} suggests an immediate bread-dole — 80 food into the streets quiets the talk in the alleys.',
    acceptCost: { food: 80 },
    acceptReward: { moraleDelta: 8, loyalty: { selfDelta: 10 } },
    declinePenalty: { loyalty: { selfDelta: -3 } },
  },
];

export function findTemplate(id: string): RequestTemplate | undefined {
  return REQUESTS.find((t) => t.id === id);
}
