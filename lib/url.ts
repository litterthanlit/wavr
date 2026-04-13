import { GradientState } from "./store";
import { exportProjectStateForUrl, ProjectState } from "./projects";

export function encodeState(state: GradientState): string {
  const data = exportProjectStateForUrl(state);
  const json = JSON.stringify(data);
  // Base64url encode
  const base64 = btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64;
}

export function decodeState(hash: string): Partial<GradientState> | null {
  try {
    // Remove #s= prefix if present
    let data = hash;
    if (data.startsWith("#s=")) data = data.slice(3);
    if (data.startsWith("s=")) data = data.slice(2);
    if (!data) return null;

    // Base64url decode
    let base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const json = atob(base64);
    const parsed = JSON.parse(json) as ProjectState;

    // Validate minimally
    if (!parsed || typeof parsed !== "object") return null;

    return parsed as unknown as Partial<GradientState>;
  } catch {
    return null;
  }
}

export function getShareUrl(state: GradientState): string {
  const encoded = encodeState(state);
  const url = new URL(window.location.href);
  url.hash = `s=${encoded}`;
  return url.toString();
}

export function copyShareUrl(state: GradientState): Promise<void> {
  const url = getShareUrl(state);
  window.history.replaceState(null, "", `#s=${encodeState(state)}`);
  return navigator.clipboard.writeText(url);
}
