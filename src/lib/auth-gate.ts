export const APP_PASSWORD = "insightsphere2026";
export const GATE_KEY = "insightsphere-unlocked";

export function isUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(GATE_KEY) === "1";
}

export function unlock() {
  sessionStorage.setItem(GATE_KEY, "1");
}
