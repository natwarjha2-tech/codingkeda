/** "Save" list for lessons, kept in this browser (like the desktop app's Watchlist). */
export type SavedLesson = { lessonId: string; courseId: string; title: string; courseTitle: string; savedAt: number };

const key = (who: string) => `ck_watchlist_${who || "me"}`;

export function readWatchlist(who: string): SavedLesson[] {
  try { return JSON.parse(localStorage.getItem(key(who)) || "[]"); } catch { return []; }
}
function write(who: string, list: SavedLesson[]) {
  try { localStorage.setItem(key(who), JSON.stringify(list)); } catch { /* storage full or blocked */ }
}
export function isSaved(who: string, lessonId: string) {
  return readWatchlist(who).some((x) => x.lessonId === lessonId);
}
/** Adds the lesson, or removes it if already saved. Returns the new saved state. */
export function toggleSaved(who: string, item: Omit<SavedLesson, "savedAt">): boolean {
  const list = readWatchlist(who);
  const has = list.some((x) => x.lessonId === item.lessonId);
  write(who, has ? list.filter((x) => x.lessonId !== item.lessonId) : [{ ...item, savedAt: Date.now() }, ...list]);
  return !has;
}
export function removeSaved(who: string, lessonId: string) {
  write(who, readWatchlist(who).filter((x) => x.lessonId !== lessonId));
}
