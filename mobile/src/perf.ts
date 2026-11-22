const marks = new Map<string, number>();

/** Notes when something began, for `since` to time against. */
export function mark(name: string) {
  marks.set(name, performance.now());
}

/** Logs how long ago `name` was marked, once, as `[perf] label 123 ms`, readable in a release build's log. */
export function since(name: string, label: string) {
  const at = marks.get(name);

  if (at === undefined) return;
  marks.delete(name);
  console.log(`[perf] ${label} ${Math.round(performance.now() - at)} ms`);
}

/** Logs how long since `name` was marked without ending it, for the steps in between. */
export function lap(name: string, label: string) {
  const at = marks.get(name);

  if (at === undefined) return;
  console.log(`[perf] ${label} ${Math.round(performance.now() - at)} ms`);
}
