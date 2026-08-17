export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const cycle = (frame: number, total: number, phase = 0) =>
  (frame / total + phase) % 1;

export const wave = (frame: number, total: number, phase = 0) =>
  Math.sin(2 * Math.PI * (frame / total + phase));
