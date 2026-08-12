export function formatPrice(huf: number): string {
  return `${new Intl.NumberFormat("hu-HU").format(huf)} Ft`;
}

/** Capitalizes only the first character — Hungarian weekday/month names are
 * lowercase mid-sentence, so CSS `text-transform: capitalize` (which
 * capitalizes every word) is wrong for them. Use this at the start of a
 * standalone label instead. */
export function capitalizeFirst(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} perc`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} óra`;
  return `${hours} óra ${rest} perc`;
}
