let clockOffset = 0;

export function now(): Date {
  return new Date(Date.now() + clockOffset);
}

export function setClockOffset(offset: number): void {
  clockOffset = offset;
}

export function resetClock(): void {
  clockOffset = 0;
}
