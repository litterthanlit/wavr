export const ONBOARDING_STORAGE_KEY = "wavr-onboarding-seen";

/**
 * Whether the visitor has already dismissed the onboarding walkthrough. The
 * editor page checks this before loading the walkthrough code at all. Storage
 * that can't be read counts as seen, so we never nag.
 */
export function hasSeenOnboarding(): boolean {
  try {
    return Boolean(localStorage.getItem(ONBOARDING_STORAGE_KEY));
  } catch {
    return true;
  }
}
