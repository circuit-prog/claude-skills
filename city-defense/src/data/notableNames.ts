import type { NotableRole, NotableTrait } from '../ecs/components.ts';

export const GIVEN_MALE: readonly string[] = [
  'Halric', 'Olwen', 'Tomas', 'Verren', 'Cael', 'Edric', 'Roland', 'Aldric',
  'Garrick', 'Mikael', 'Conn', 'Davus', 'Rurik', 'Ferren', 'Bertrand',
  'Walden', 'Kael', 'Osric', 'Yannick', 'Hadwin', 'Tristan', 'Owain',
];

export const GIVEN_FEMALE: readonly string[] = [
  'Brenna', 'Maesa', 'Liana', 'Sera', 'Mira', 'Lyssa', 'Tora', 'Anwyn',
  'Carys', 'Ivetta', 'Edda', 'Nessa', 'Ysolde', 'Brida', 'Wynne', 'Helsa',
  'Rowena', 'Aelis', 'Brynna', 'Sefa', 'Morwen',
];

export const FAMILY: readonly string[] = [
  'Tallow', 'Greystone', 'Ravenhill', 'Ashvale', 'Blackford', 'Highmarch',
  'Stonebrook', 'Marrowfen', 'Whitlow', 'Thornhill', 'Westmark', 'Eastwatch',
  'Goldsborough', 'Crowley', 'Wynter', 'Lake', 'Thornberry', 'Ivygate',
  'Oakhollow', 'Briar', 'Holm', 'Hartshorn',
];

export function honorific(role: NotableRole, female: boolean): string {
  switch (role) {
    case 'captain': return 'Captain';
    case 'sergeant': return 'Sergeant';
    case 'noble': return female ? 'Lady' : 'Lord';
    case 'merchant': return female ? 'Mistress' : 'Master';
    case 'craftsman': return female ? 'Mistress' : 'Master';
    case 'advisor': return 'Counsellor';
  }
}

// Higher weight = more likely to be drawn for that role. Roles not listed
// default to 1 (so every role has some chance of any non-conflicting trait).
export const ROLE_TRAIT_WEIGHTS: Record<NotableRole, Partial<Record<NotableTrait, number>>> = {
  captain:   { brave: 4, loyal: 3, ambitious: 2 },
  sergeant:  { brave: 3, ambitious: 3, cruel: 1 },
  noble:     { greedy: 3, ambitious: 2, cruel: 1, pious: 1 },
  merchant:  { greedy: 5, cowardly: 1, loyal: 1 },
  craftsman: { pious: 3, loyal: 3 },
  advisor:   { loyal: 3, pious: 2, ambitious: 1 },
};

export const ALL_TRAITS: readonly NotableTrait[] = [
  'greedy', 'pious', 'brave', 'cowardly', 'ambitious', 'loyal', 'cruel',
];

// Pairs that cannot coexist on the same notable.
export const TRAIT_CONFLICTS: ReadonlyArray<readonly [NotableTrait, NotableTrait]> = [
  ['brave', 'cowardly'],
  ['loyal', 'ambitious'],
];
