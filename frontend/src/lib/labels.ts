/** Display names for the enum values the API returns.
 *
 * The API stores these lowercase ("dsa", "active"), and signage is
 * sentence case — so the raw value must never reach the screen. The register
 * and the session list name the same state the same way, from this one map.
 */
const NAMES: Record<string, string> = {
  // session / invite status
  pending: "Not started",
  started: "In progress",
  completed: "Complete",
  // interview status
  draft: "Draft",
  active: "Active",
  closed: "Closed",
  // DSA difficulty
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  // role
  candidate: "Candidate",
  recruiter: "Recruiter",
  // interview type
  behavioral: "Behavioral",
  dsa: "DSA",
  mixed: "Mixed",
};

/** Unmapped values fall back to their words capitalised. */
export const label = (value?: string | null): string =>
  value
    ? (NAMES[value] ??
      value
        .split(/[_\-\s]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "))
    : "";
