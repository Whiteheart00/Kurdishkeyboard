import { EmojiHistoryStore, EmojiHistoryUpdateStrategy } from '../types/keyboard';

export function recordHistoryUsage(
  store: EmojiHistoryStore,
  value: string,
  strategy: EmojiHistoryUpdateStrategy,
  recentMaxSize: number
): EmojiHistoryStore {
  const clean = value.trim();
  if (!clean) return store;

  // Pinned items stay in pinned and are not duplicated in recent
  if (store.pinned.includes(clean)) {
    return store;
  }

  const maxSize = Math.max(5, Math.min(120, recentMaxSize || 40));
  const exists = store.recent.includes(clean);

  if (strategy === 'manual_prepend' || strategy === 'manual_append') {
    if (exists) {
      // Manual sort preserves existing position
      return store;
    }
    const nextRecent =
      strategy === 'manual_append'
        ? [...store.recent, clean].slice(-maxSize)
        : [clean, ...store.recent].slice(0, maxSize);
    return { pinned: store.pinned, recent: nextRecent };
  }

  // Auto sort moves used item to front (prepend) or back (append)
  const filtered = store.recent.filter((item) => item !== clean);
  const nextRecent =
    strategy === 'auto_append'
      ? [...filtered, clean].slice(-maxSize)
      : [clean, ...filtered].slice(0, maxSize);

  return { pinned: store.pinned, recent: nextRecent };
}

export function togglePinHistoryItem(
  store: EmojiHistoryStore,
  value: string,
  pinnedMaxSize: number,
  recentMaxSize: number
): EmojiHistoryStore {
  const clean = value.trim();
  if (!clean) return store;

  const isPinned = store.pinned.includes(clean);
  if (isPinned) {
    // Unpin: move to front of recent
    const nextPinned = store.pinned.filter((item) => item !== clean);
    const nextRecent = [clean, ...store.recent.filter((item) => item !== clean)].slice(
      0,
      Math.max(5, recentMaxSize || 40)
    );
    return { pinned: nextPinned, recent: nextRecent };
  }

  // Pin: remove from recent and add to front of pinned
  const maxPin = Math.max(4, Math.min(80, pinnedMaxSize || 24));
  const nextPinned = [clean, ...store.pinned.filter((item) => item !== clean)].slice(0, maxPin);
  const nextRecent = store.recent.filter((item) => item !== clean);
  return { pinned: nextPinned, recent: nextRecent };
}

export function moveHistoryItem(
  store: EmojiHistoryStore,
  value: string,
  bucket: 'pinned' | 'recent',
  delta: -1 | 1
): EmojiHistoryStore {
  const list = [...store[bucket]];
  const idx = list.indexOf(value);
  if (idx === -1) return store;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= list.length) return store;
  const [removed] = list.splice(idx, 1);
  list.splice(targetIdx, 0, removed);
  return bucket === 'pinned'
    ? { pinned: list, recent: store.recent }
    : { pinned: store.pinned, recent: list };
}

export function removeHistoryItem(store: EmojiHistoryStore, value: string): EmojiHistoryStore {
  return {
    pinned: store.pinned.filter((item) => item !== value),
    recent: store.recent.filter((item) => item !== value),
  };
}
