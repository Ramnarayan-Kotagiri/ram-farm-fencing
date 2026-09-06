export type SideId = 'W' | 'N' | 'E' | 'S';
export const vertices = [
  { id: 'A', lat: 16.962411, lng: 81.215029, e: 522893, n: 1875409.3 },
  { id: 'B', lat: 16.963601, lng: 81.215126, e: 522903.2, n: 1875540.9 },
  { id: 'C', lat: 16.96302, lng: 81.219729, e: 523393.3, n: 1875477.2 },
  { id: 'D', lat: 16.962579, lng: 81.219684, e: 523388.6, n: 1875428.4 },
  { id: 'E', lat: 16.961871, lng: 81.21958, e: 523377.6, n: 1875350.1 },
  { id: 'F', lat: 16.961854, lng: 81.218728, e: 523286.8, n: 1875348.1 },
  { id: 'G', lat: 16.961396, lng: 81.215032, e: 522893.5, n: 1875297 },
];
export const sides: Record<
  SideId,
  { name: string; path: string[]; survey: number; meters: number; color: string }
> = {
  W: {
    name: 'Road / West',
    path: ['G', 'A', 'B'],
    survey: 801.48,
    meters: 244.29,
    color: '#3e9fc8',
  },
  N: {
    name: 'North / Existing',
    path: ['B', 'C'],
    survey: 1621.39,
    meters: 494.2,
    color: '#78a968',
  },
  E: {
    name: 'Back / East',
    path: ['C', 'D', 'E'],
    survey: 420.34,
    meters: 128.12,
    color: '#3e9fc8',
  },
  S: { name: 'South', path: ['E', 'F', 'G'], survey: 1599.31, meters: 487.47, color: '#c38545' },
};
export const sideIds: SideId[] = ['W', 'N', 'E', 'S'];
export const expectedEdges = [132.02, 494.2, 49.02, 79.1, 90.79, 396.68, 112.27];
export const FT = 0.3048;
