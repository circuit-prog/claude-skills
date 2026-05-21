// District name labels rendered over the map as a parchment-style overlay.
// Positions are in tile coordinates (converted to pixels at render time).

export interface District {
  name: string;
  x: number;          // centre tile x
  y: number;          // centre tile y
  size?: 'small' | 'medium' | 'large';
}

export const DISTRICTS: District[] = [
  // Inside-the-wall districts (player builds here)
  { name: 'Northern Slums', x: 40, y: 8,  size: 'large' },
  { name: 'The Brooks',     x: 26, y: 25, size: 'medium' },
  { name: 'Middle Town',    x: 36, y: 28, size: 'large' },
  { name: 'Darkgate',       x: 20, y: 38, size: 'medium' },
  { name: 'Dark Hall',      x: 44, y: 42, size: 'large' },
  { name: 'Light Garden',   x: 56, y: 42, size: 'medium' },
  { name: 'Southern Slums', x: 40, y: 52, size: 'small' },

  // Outside-the-wall named regions
  { name: 'Eastern Orchards', x: 65, y: 22, size: 'medium' },
  { name: 'Blackbark Edge',   x: 65, y: 35, size: 'small' },
  { name: 'Western Wood',     x: 10, y: 20, size: 'small' },
];
