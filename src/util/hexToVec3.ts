export type IVecColor = readonly [number, number, number];

export function hexToVec3(hex: string): IVecColor {
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return [r, g, b] as const;
}
