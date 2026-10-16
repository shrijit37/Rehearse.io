/** The version of the storage notice, and of the consent it records.
 *
 * Every surface that writes `users.consentVersion` reads this one constant, so
 * the record says which notice the user actually answered. Bump it when the
 * notice's text changes — the banner re-asks on a version mismatch.
 */
export const CONSENT_VERSION = "2026-10";
