import { useSyncExternalStore } from "react";

// Session-only targets let successive chat links reuse the same panel tab.
const targets = new Map<string, { path: string; sequence: number }>();
const listeners = new Set<() => void>();
let sequence = 0;
export function requestFile(threadId: string, path: string) {
  targets.set(threadId, { path, sequence: ++sequence });
  listeners.forEach(listener => listener());
}
export function clearFileRequests() {
  targets.clear(); listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useFileRequest(threadId: string) {
  return useSyncExternalStore(subscribe, () => targets.get(threadId));
}
