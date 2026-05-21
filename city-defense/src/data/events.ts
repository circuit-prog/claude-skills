import type { BuildingKind, NotableRole, NotableTrait, UnitKind, EnemyKind, EnemyFaction } from '../ecs/components.ts';

// ─── Effect DSL ────────────────────────────────────────────────────────────
// Declarative effects so events stay JSON-authorable. systems/events.ts owns
// the dispatch table that maps each `kind` to its mutation on World.

export type EventEffect =
  | { kind: 'food'; delta: number }
  | { kind: 'gold'; delta: number }
  | { kind: 'wood'; delta: number }
  | { kind: 'stone'; delta: number }
  | { kind: 'morale'; delta: number }
  | { kind: 'population'; delta: number }
  | { kind: 'loyalty-role'; role: NotableRole; delta: number }
  | { kind: 'loyalty-trait'; trait: NotableTrait; delta: number }
  | { kind: 'loyalty-all'; delta: number }
  | { kind: 'spawn-enemies'; enemy: EnemyKind; count: number; faction?: EnemyFaction; edge?: 'north' | 'south' | 'east' | 'west' }
  | { kind: 'damage-random-wall'; amount: number; count?: number }
  | { kind: 'damage-keep'; amount: number }
  | { kind: 'spawn-soldiers'; unit: UnitKind; count: number; loyalty?: number }
  | { kind: 'queue-followup'; defId: string; afterDays: number };

export interface ChoiceCost {
  gold?: number;
  food?: number;
  wood?: number;
  stone?: number;
}

export interface EventChoice {
  label: string;
  cost?: ChoiceCost;
  effects: EventEffect[];
}

export interface EventPreconditions {
  minDay?: number;
  maxDay?: number;
  phase?: 'preparation' | 'siege' | 'any';
  minMorale?: number;
  maxMorale?: number;
  hasBuilding?: BuildingKind;
  needsNotableRole?: NotableRole;
}

export type EventCategory = 'economic' | 'military' | 'political' | 'weather' | 'chained';

export interface EventDef {
  id: string;
  category: EventCategory;
  weight: number;
  title: string;
  body: string;
  preconditions?: EventPreconditions;
  cooldownDays?: number;
  choices: EventChoice[];
  /** When true, never rolled randomly — only fires via queued follow-up. */
  followUpOnly?: boolean;
}

// ─── Catalogue ─────────────────────────────────────────────────────────────
//
// ~27 events across all categories. Designed to be extended — adding entries
// here automatically makes them eligible for the random roller.

export const EVENTS: EventDef[] = [
  // ── Economic ───────────────────────────────────────────────────────────
  {
    id: 'plague-outbreak',
    category: 'economic', weight: 8,
    title: 'Plague in the Slums',
    body: 'Black sores fester in the slums. The priests burn incense, the watch burns bedding. The houses send their children away. What do you do?',
    preconditions: { phase: 'any', minDay: 20 }, cooldownDays: 40,
    choices: [
      { label: 'Quarantine the streets (-60 food, -10 morale)',
        cost: { food: 60 }, effects: [{ kind: 'morale', delta: -10 }] },
      { label: 'Let it pass through the slums (-30 population, -5 morale)',
        effects: [{ kind: 'population', delta: -30 }, { kind: 'morale', delta: -5 }] },
      { label: 'Pray and trust the Saints (-15 morale, +loyalty to pious)',
        effects: [{ kind: 'morale', delta: -15 }, { kind: 'loyalty-trait', trait: 'pious', delta: 8 }] },
    ],
  },
  {
    id: 'drought',
    category: 'economic', weight: 6,
    title: 'A Failed Harvest',
    body: 'The summer was dry. Farms outside the walls return half their expected yield. The granaries hold what they hold.',
    preconditions: { phase: 'any', minDay: 30 }, cooldownDays: 60,
    choices: [
      { label: 'Acknowledge the loss', effects: [{ kind: 'food', delta: -120 }] },
      { label: 'Buy emergency grain (-150 gold, +50 food)',
        cost: { gold: 150 }, effects: [{ kind: 'food', delta: 50 }] },
    ],
  },
  {
    id: 'bumper-harvest',
    category: 'economic', weight: 5,
    title: 'A Bountiful Field',
    body: 'A late-summer storm dropped just enough rain. The wheatfields north of the river deliver three bushels for every two expected.',
    preconditions: { phase: 'any', minDay: 10 }, cooldownDays: 60,
    choices: [
      { label: 'Take it (+220 food)', effects: [{ kind: 'food', delta: 220 }] },
      { label: 'Sell the surplus (+120 gold, +90 food)',
        effects: [{ kind: 'gold', delta: 120 }, { kind: 'food', delta: 90 }] },
    ],
  },
  {
    id: 'merchant-caravan',
    category: 'economic', weight: 6,
    title: 'A Caravan from the South',
    body: 'A merchant train slips through the besieger\'s pickets. They offer salt and dried fish, but they want gold up front.',
    preconditions: { phase: 'any', minDay: 5 }, cooldownDays: 35,
    choices: [
      { label: 'Pay their price (-100 gold, +180 food)',
        cost: { gold: 100 }, effects: [{ kind: 'food', delta: 180 }] },
      { label: 'Pay generously (-180 gold, +200 food, +loyalty merchants)',
        cost: { gold: 180 }, effects: [{ kind: 'food', delta: 200 }, { kind: 'loyalty-role', role: 'merchant', delta: 8 }] },
      { label: 'Send them on their way',
        effects: [{ kind: 'loyalty-role', role: 'merchant', delta: -3 }] },
    ],
  },
  {
    id: 'tax-evasion-scandal',
    category: 'economic', weight: 4,
    title: 'A Ledger Goes Missing',
    body: 'The collector\'s books are short. Three of the noble houses are caught funnelling silver through a back-alley counting house.',
    preconditions: { phase: 'any', minDay: 25 }, cooldownDays: 50,
    choices: [
      { label: 'Hang the collector (+30 gold, -loyalty merchants, -5 morale)',
        effects: [{ kind: 'gold', delta: 30 }, { kind: 'loyalty-role', role: 'merchant', delta: -5 }, { kind: 'morale', delta: -5 }] },
      { label: 'Quiet pardon (+60 gold, -loyalty advisors)',
        effects: [{ kind: 'gold', delta: 60 }, { kind: 'loyalty-role', role: 'advisor', delta: -10 }] },
      { label: 'Public trial (-10 gold, +loyalty everyone)',
        effects: [{ kind: 'gold', delta: -10 }, { kind: 'loyalty-all', delta: 4 }] },
    ],
  },
  {
    id: 'fire-in-market',
    category: 'economic', weight: 4,
    title: 'Fire on Market Street',
    body: 'A merchant\'s lamp is upset in the night. Half the central market burns. The fire-watch saved the granary.',
    preconditions: { phase: 'any', minDay: 15 }, cooldownDays: 60,
    choices: [
      { label: 'Compensate the merchants (-80 gold, +loyalty merchants)',
        cost: { gold: 80 }, effects: [{ kind: 'loyalty-role', role: 'merchant', delta: 12 }] },
      { label: 'Cite the city ordinance (-loyalty merchants, -5 morale)',
        effects: [{ kind: 'loyalty-role', role: 'merchant', delta: -8 }, { kind: 'morale', delta: -5 }] },
    ],
  },
  {
    id: 'iron-strike',
    category: 'economic', weight: 4,
    title: 'The Ironmongers Refuse',
    body: 'The smiths\' guild halts work over the price of charcoal. Wall repairs slow. The captain is purple with rage.',
    preconditions: { phase: 'any', minDay: 40 }, cooldownDays: 40,
    choices: [
      { label: 'Meet their price (-60 gold, +loyalty craftsmen)',
        cost: { gold: 60 }, effects: [{ kind: 'loyalty-role', role: 'craftsman', delta: 10 }] },
      { label: 'Break the strike (-loyalty craftsmen, +30 stone)',
        effects: [{ kind: 'loyalty-role', role: 'craftsman', delta: -12 }, { kind: 'stone', delta: 30 }] },
    ],
  },
  {
    id: 'lost-shipment',
    category: 'economic', weight: 4,
    title: 'A Shipment Lost on the Road',
    body: 'A stone shipment from the quarry was waylaid in the hills. The drovers came back with nothing but bruises.',
    preconditions: { phase: 'any', minDay: 10 }, cooldownDays: 45,
    choices: [
      { label: 'Send the watch to recover it (+30 stone, -5 morale)',
        effects: [{ kind: 'stone', delta: 30 }, { kind: 'morale', delta: -5 }] },
      { label: 'Write it off', effects: [{ kind: 'stone', delta: -50 }] },
    ],
  },
  {
    id: 'windfall-treasure',
    category: 'economic', weight: 3,
    title: 'A Forgotten Vault',
    body: 'Workers shoring up a tower foundation uncover an old strongbox. Inside: tarnished silver, three rings, and a deed long forgotten.',
    preconditions: { phase: 'any', minDay: 30 }, cooldownDays: 80,
    choices: [
      { label: 'To the treasury (+200 gold)', effects: [{ kind: 'gold', delta: 200 }] },
      { label: 'Distribute to the garrison (-loyalty nobles, +loyalty sergeants)',
        effects: [{ kind: 'loyalty-role', role: 'sergeant', delta: 14 }, { kind: 'loyalty-role', role: 'noble', delta: -6 }] },
    ],
  },

  // ── Military ───────────────────────────────────────────────────────────
  {
    id: 'defector',
    category: 'military', weight: 5,
    title: 'A Defector at the Postern Gate',
    body: 'A soldier in unfamiliar livery walks unarmed up to the postern gate. He says his pay is six weeks late and offers his sword.',
    preconditions: { phase: 'siege', minDay: 40 }, cooldownDays: 30,
    choices: [
      { label: 'Take him on (+1 mercenary at low loyalty)',
        effects: [{ kind: 'spawn-soldiers', unit: 'mercenary', count: 1, loyalty: 40 }] },
      { label: 'Drive him off (-3 morale)',
        effects: [{ kind: 'morale', delta: -3 }] },
      { label: 'Hang him from the wall (-5 morale, +loyalty cruel notables)',
        effects: [{ kind: 'morale', delta: -5 }, { kind: 'loyalty-trait', trait: 'cruel', delta: 6 }] },
    ],
  },
  {
    id: 'secret-tunnel',
    category: 'military', weight: 4,
    title: 'A Tunnel Beneath the Western Wall',
    body: 'A miner reports the besiegers are digging. The tunnel head is plainly heading for your western tower.',
    preconditions: { phase: 'siege', minDay: 60 }, cooldownDays: 40,
    choices: [
      { label: 'Counter-mine (-20 wood, -30 stone, no damage)',
        cost: { wood: 20, stone: 30 }, effects: [] },
      { label: 'Reinforce the wall above (-15 stone, partial damage)',
        cost: { stone: 15 }, effects: [{ kind: 'damage-random-wall', amount: 60, count: 1 }] },
      { label: 'Do nothing — let them come up where you can see them',
        effects: [{ kind: 'damage-random-wall', amount: 120, count: 1 }, { kind: 'spawn-enemies', enemy: 'soldier', count: 4 }] },
    ],
  },
  {
    id: 'parley-offer',
    category: 'military', weight: 3,
    title: 'A White Flag at the Gate',
    body: 'An envoy under truce-cloth offers terms. Open the gates, pay tribute, and the army marches away. The houses watch you closely.',
    preconditions: { phase: 'siege', minDay: 70 }, cooldownDays: 90,
    choices: [
      { label: 'Pay the tribute (-300 gold, no enemies for 10 days)',
        cost: { gold: 300 }, effects: [{ kind: 'morale', delta: 8 }] },
      { label: 'Refuse with honour (+8 morale, +loyalty brave notables)',
        effects: [{ kind: 'morale', delta: 8 }, { kind: 'loyalty-trait', trait: 'brave', delta: 6 }] },
      { label: 'Insult the envoy (-5 morale, +1 wave of enemies)',
        effects: [{ kind: 'morale', delta: -5 }, { kind: 'spawn-enemies', enemy: 'champion', count: 1 }] },
    ],
  },
  {
    id: 'wall-collapse',
    category: 'military', weight: 5,
    title: 'A Section of Wall Crumbles',
    body: 'Rain and sappers have worked at the foundation. A section of the curtain wall sags overnight. Stones lie in the moat.',
    preconditions: { phase: 'any', minDay: 50 }, cooldownDays: 30,
    choices: [
      { label: 'Patch it now (-40 stone, -10 wood)',
        cost: { stone: 40, wood: 10 }, effects: [] },
      { label: 'Patch later — the besiegers haven\'t noticed yet',
        effects: [{ kind: 'damage-random-wall', amount: 80, count: 1 }] },
    ],
  },
  {
    id: 'captured-spy',
    category: 'military', weight: 4,
    title: 'A Stranger in the Tavern',
    body: 'A man with too-clean hands buys too many drinks. The watch finds maps of the wall-walks sewn into his cloak.',
    preconditions: { phase: 'any', minDay: 30 }, cooldownDays: 30,
    choices: [
      { label: 'Hang him at dawn (+loyalty cruel, -3 morale)',
        effects: [{ kind: 'loyalty-trait', trait: 'cruel', delta: 6 }, { kind: 'morale', delta: -3 }] },
      { label: 'Interrogate first (+20 gold, then hang)',
        effects: [{ kind: 'gold', delta: 20 }, { kind: 'morale', delta: -2 }] },
      { label: 'Turn him — false maps go back over the wall',
        effects: [{ kind: 'queue-followup', defId: 'spy-bears-fruit', afterDays: 7 }] },
    ],
  },
  {
    id: 'mercenary-mutiny',
    category: 'military', weight: 4,
    title: 'Discontent in the Mercenary Camp',
    body: 'A sergeant reports the mercenary captains are talking in low voices. Three have gone over the wall in the last week.',
    preconditions: { phase: 'siege', minDay: 50 }, cooldownDays: 30,
    choices: [
      { label: 'Pay a bonus (-80 gold, +loyalty)',
        cost: { gold: 80 }, effects: [] },
      { label: 'Hang the ringleaders (-loyalty all, +loyalty cruel)',
        effects: [{ kind: 'loyalty-all', delta: -5 }, { kind: 'loyalty-trait', trait: 'cruel', delta: 4 }] },
    ],
  },
  {
    id: 'supply-cache',
    category: 'military', weight: 5,
    title: 'A Cache in the Old Armoury',
    body: 'A clerk finds an old armoury chest in a forgotten storehouse. Crossbow bolts, helmet straps, three barrels of oil.',
    preconditions: { phase: 'any', minDay: 5 }, cooldownDays: 40,
    choices: [
      { label: 'Take inventory (+30 wood, +20 stone)',
        effects: [{ kind: 'wood', delta: 30 }, { kind: 'stone', delta: 20 }] },
    ],
  },
  {
    id: 'ambush-opportunity',
    category: 'military', weight: 3,
    title: 'Foragers in the Open',
    body: 'Scouts report a foraging party of besiegers a mile from the postern, lightly guarded. A quick sally could bloody them.',
    preconditions: { phase: 'siege', minDay: 45 }, cooldownDays: 25,
    choices: [
      { label: 'Sally out (+30 morale, may lose soldiers)',
        effects: [{ kind: 'morale', delta: 30 }, { kind: 'loyalty-trait', trait: 'brave', delta: 4 }] },
      { label: 'Hold the wall (no risk, no reward)', effects: [] },
    ],
  },
  {
    id: 'tunnel-collapse',
    category: 'military', weight: 3,
    title: 'A Tower Settles',
    body: 'The besiegers fired their tunnel — a tower at the south corner sinks two feet and the merlons crack.',
    preconditions: { phase: 'siege', minDay: 80 }, cooldownDays: 40,
    choices: [
      { label: 'Curse, and pay the masons (-50 stone)',
        cost: { stone: 50 }, effects: [{ kind: 'damage-random-wall', amount: 40, count: 2 }] },
      { label: 'Abandon the tower for now',
        effects: [{ kind: 'damage-random-wall', amount: 250, count: 1 }] },
    ],
  },

  // ── Political ──────────────────────────────────────────────────────────
  {
    id: 'noble-feud',
    category: 'political', weight: 5,
    title: 'Two Houses, Old Blood',
    body: 'Two noble heads come before you with drawn knives. The grudge is older than the city wall and now spills into the streets.',
    preconditions: { phase: 'any', minDay: 20 }, cooldownDays: 35,
    choices: [
      { label: 'Side with the ambitious house (+loyalty ambitious, -loyalty loyal)',
        effects: [{ kind: 'loyalty-trait', trait: 'ambitious', delta: 10 }, { kind: 'loyalty-trait', trait: 'loyal', delta: -4 }] },
      { label: 'Side with the loyal house (-loyalty ambitious, +loyalty loyal)',
        effects: [{ kind: 'loyalty-trait', trait: 'loyal', delta: 10 }, { kind: 'loyalty-trait', trait: 'ambitious', delta: -4 }] },
      { label: 'Refuse to choose (-loyalty all nobles)',
        effects: [{ kind: 'loyalty-role', role: 'noble', delta: -6 }] },
    ],
  },
  {
    id: 'religious-uprising',
    category: 'political', weight: 4,
    title: 'A Sermon Goes Too Far',
    body: 'The high priest preaches that the siege is divine punishment. Penitents march barefoot through the streets, weeping.',
    preconditions: { phase: 'any', minDay: 60 }, cooldownDays: 50,
    choices: [
      { label: 'Endorse the sermon (+loyalty pious, -loyalty ambitious)',
        effects: [{ kind: 'loyalty-trait', trait: 'pious', delta: 8 }, { kind: 'loyalty-trait', trait: 'ambitious', delta: -4 }] },
      { label: 'Silence the priest (-loyalty pious, -10 morale)',
        effects: [{ kind: 'loyalty-trait', trait: 'pious', delta: -12 }, { kind: 'morale', delta: -10 }] },
      { label: 'Build a new chapel (-40 wood, -30 stone, +15 morale)',
        cost: { wood: 40, stone: 30 }, effects: [{ kind: 'morale', delta: 15 }] },
    ],
  },
  {
    id: 'peasant-petition',
    category: 'political', weight: 5,
    title: 'A Petition From the Streets',
    body: 'A delegation of journeymen and farmwives ask for bread relief — twenty loaves a household, paid from the city stores.',
    preconditions: { phase: 'any', minDay: 30 }, cooldownDays: 30,
    choices: [
      { label: 'Grant the bread (-90 food, +10 morale)',
        cost: { food: 90 }, effects: [{ kind: 'morale', delta: 10 }] },
      { label: 'Refuse — there isn\'t enough (-7 morale)',
        effects: [{ kind: 'morale', delta: -7 }] },
    ],
  },
  {
    id: 'festival-of-saints',
    category: 'political', weight: 4,
    title: 'The Feast of Saints',
    body: 'The priests ask for the festival as the calendar demands. Two days of bread, wine, and bonfires in the squares.',
    preconditions: { phase: 'any', minDay: 30 }, cooldownDays: 60,
    choices: [
      { label: 'Celebrate (-50 food, -30 gold, +18 morale)',
        cost: { food: 50, gold: 30 }, effects: [{ kind: 'morale', delta: 18 }] },
      { label: 'Cancel it (-8 morale, -loyalty pious)',
        effects: [{ kind: 'morale', delta: -8 }, { kind: 'loyalty-trait', trait: 'pious', delta: -8 }] },
    ],
  },
  {
    id: 'amnesty-debate',
    category: 'political', weight: 3,
    title: 'The Prisoners in the Cells',
    body: 'The gaol is overflowing — thieves, debtors, two suspected spies. Your advisor asks what to do.',
    preconditions: { phase: 'any', minDay: 40 }, cooldownDays: 60,
    choices: [
      { label: 'Amnesty all (+5 morale, +1 peasant levy)',
        effects: [{ kind: 'morale', delta: 5 }, { kind: 'spawn-soldiers', unit: 'peasant-levy', count: 1 }] },
      { label: 'Conscript the able (+3 peasant levies, -loyalty pious)',
        effects: [{ kind: 'spawn-soldiers', unit: 'peasant-levy', count: 3, loyalty: 50 }, { kind: 'loyalty-trait', trait: 'pious', delta: -4 }] },
      { label: 'Hang them all (+loyalty cruel, -10 morale)',
        effects: [{ kind: 'loyalty-trait', trait: 'cruel', delta: 8 }, { kind: 'morale', delta: -10 }] },
    ],
  },

  // ── Weather ────────────────────────────────────────────────────────────
  {
    id: 'hard-frost',
    category: 'weather', weight: 5,
    title: 'A Killing Frost',
    body: 'Three nights of frost. The farms outside are blackened. The granary holds.',
    preconditions: { phase: 'any', minDay: 80 }, cooldownDays: 60,
    choices: [
      { label: 'Acknowledge the loss', effects: [{ kind: 'food', delta: -80 }] },
    ],
  },
  {
    id: 'flood',
    category: 'weather', weight: 4,
    title: 'The River Rises',
    body: 'The spring melt comes early and the river jumps its banks. The mill is wrecked. The besiegers are flooded too — their camp moves a half-mile back.',
    preconditions: { phase: 'any', minDay: 40 }, cooldownDays: 80,
    choices: [
      { label: 'Endure it',
        effects: [{ kind: 'food', delta: -40 }, { kind: 'morale', delta: 6 }] },
    ],
  },
  {
    id: 'plague-of-rats',
    category: 'weather', weight: 3,
    title: 'Rats in the Granary',
    body: 'A bad year for rats. The granary loses three barrels in a night.',
    preconditions: { phase: 'any', minDay: 30 }, cooldownDays: 50,
    choices: [
      { label: 'Pay ratcatchers (-15 gold)',
        cost: { gold: 15 }, effects: [{ kind: 'food', delta: -30 }] },
      { label: 'Do nothing', effects: [{ kind: 'food', delta: -80 }] },
    ],
  },

  // ── Chained mini-storyline: The Spy Among Us ────────────────────────────
  {
    id: 'spy-bears-fruit',
    category: 'chained', weight: 0,
    followUpOnly: true,
    title: 'False Maps Bear Fruit',
    body: 'The maps you fed the spy worked. The enemy attacked the wrong tower and lost a wagon of siege gear scrambling away. The garrison is heartened.',
    choices: [
      { label: 'Drinks for the watch',
        effects: [{ kind: 'morale', delta: 12 }, { kind: 'loyalty-role', role: 'sergeant', delta: 8 }, { kind: 'wood', delta: 30 }] },
    ],
  },
  {
    id: 'noble-feud-aftermath',
    category: 'chained', weight: 0,
    followUpOnly: true,
    title: 'Blood Settles',
    body: 'Two weeks after the feud was settled, the wounded house quietly liquidates its town holdings. The treasury sees the windfall — and the noble loses friends.',
    choices: [
      { label: 'Take the gold (+120 gold, -loyalty nobles)',
        effects: [{ kind: 'gold', delta: 120 }, { kind: 'loyalty-role', role: 'noble', delta: -6 }] },
    ],
  },
];

export function findEvent(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}

export function rolledEvents(): EventDef[] {
  return EVENTS.filter((e) => !e.followUpOnly);
}
