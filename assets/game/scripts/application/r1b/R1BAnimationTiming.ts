export interface FlightTiming {
  staggerMs: number;
  flightMs: number;
  totalMs: number;
}

export const flightTimingMsFor = (pathLength: number): FlightTiming => {
  if (!Number.isInteger(pathLength) || pathLength < 1) {
    throw new Error('Flight timing requires a positive integer path length');
  }
  const staggerMs = Math.max(18, Math.min(28, 180 / pathLength));
  const flightMs = 320;
  return {
    staggerMs,
    flightMs,
    totalMs: (pathLength - 1) * staggerMs + flightMs,
  };
};
