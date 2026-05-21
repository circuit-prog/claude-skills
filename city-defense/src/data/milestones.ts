export interface MilestoneTriggers {
  forceSiegeStart?: boolean;
  moraleDelta?: number;
  foodDelta?: number;
  unlocksRelief?: boolean;     // weakens enemies for the final stretch
}

export interface Milestone {
  id: string;
  day: number;
  act: 1 | 2 | 3;
  title: string;
  body: string;
  triggers?: MilestoneTriggers;
}

// Scripted act-break events. They fire automatically on the listed day and
// stick around in world.firedMilestones so a reload doesn't replay them.
export const MILESTONES: Milestone[] = [
  {
    id: 'word-from-road',
    day: 1, act: 1,
    title: 'Word From the Road',
    body: 'Riders from the east bring grim news. Banners are gathering in the foothills — yours is not the only city the enemy wants. You have until the herald arrives to prepare.',
  },
  {
    id: 'half-prep-gone',
    day: 15, act: 1,
    title: 'Half the Glass is Run',
    body: 'Scouts return with maps of enemy supply trains. There will be no peace this winter. Hammer and saw work day and night on your walls.',
  },
  {
    id: 'banners-sighted',
    day: 30, act: 1,
    title: 'The Banners are Sighted',
    body: 'A herald rides from the east under a white flag. The enemy host is one day\'s march away. Whatever you have built will have to hold.',
  },
  {
    id: 'one-month-held',
    day: 60, act: 2,
    title: 'One Month Under Siege',
    body: 'The walls have stood for one full month. The garrison drinks to the king from your dwindling cellar.',
    triggers: { moraleDelta: 5 },
  },
  {
    id: 'winter-descends',
    day: 90, act: 2,
    title: 'Winter Descends',
    body: 'The first frost rimes the battlements. Food production will struggle. The cold bites at the besiegers too — but they have full bellies and you do not.',
  },
  {
    id: 'foreign-army',
    day: 120, act: 3,
    title: 'A New Banner Joins the Host',
    body: 'Foreign banners — colours you have never seen — join the besieging line. The first siege engines are wheeled into view. The real war begins now.',
    triggers: { moraleDelta: -5 },
  },
  {
    id: 'three-months-held',
    day: 150, act: 3,
    title: 'Three Months Held',
    body: 'Half a year, near as makes no difference. The houses speak openly of the relief that must surely come. The garrison watches the southern road.',
    triggers: { moraleDelta: 3 },
  },
  {
    id: 'smoke-south',
    day: 170, act: 3,
    title: 'Smoke on the Southern Road',
    body: 'Riders report columns of smoke on the road from the south. Some say it is the king\'s army. Some say it is just more burning. Hold the walls.',
  },
  {
    id: 'relief-sighted',
    day: 175, act: 3,
    title: 'Relief is Sighted',
    body: 'Banners! The king\'s army is on the southern horizon. The besiegers turn to face them. Hold five more days and the siege is broken.',
    triggers: { moraleDelta: 12, unlocksRelief: true },
  },
];

export function findMilestone(id: string): Milestone | undefined {
  return MILESTONES.find((m) => m.id === id);
}

// Act label for the HUD progress bar.
export function actFor(day: number): 1 | 2 | 3 {
  if (day <= 30) return 1;
  if (day <= 119) return 2;
  return 3;
}

export const ACT_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Preparation',
  2: 'Under Siege',
  3: 'The Final Push',
};
