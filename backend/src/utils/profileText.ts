import type { ProfileEducation, ProfileExperience } from "../db/schema";

/** The structured profile columns, as the row carries them. */
export interface StructuredProfile {
    headline: string | null;
    location: string | null;
    skills: string[] | null;
    experience: ProfileExperience[] | null;
    education: ProfileEducation[] | null;
}

/** Joins the parts of a line, dropping the ones that are absent. */
const join = (parts: Array<string | null | undefined>, separator: string): string =>
    parts.map((part) => (part ?? "").trim()).filter(Boolean).join(separator);

/**
 * True when the maintained profile carries enough to generate a round from. A
 * bare headline is enough: the candidate typed it deliberately, and it beats
 * handing the model a scan the candidate never got to correct.
 */
export function profileHasContent(profile: StructuredProfile): boolean {
    if ((profile.headline ?? "").trim().length > 0) return true;
    if ((profile.skills ?? []).length >= 2) return true;
    return (profile.experience ?? []).length >= 1;
}

/**
 * The exact text a practice round is generated from when the candidate's own
 * corrected profile is used, instead of a raw PDF extraction.
 *
 * The same function renders the preview on the profile page, so what the
 * candidate reads there is what the model is handed — not a description of it.
 */
export function profileToRoundText(profile: StructuredProfile): string {
    const lines: string[] = [];

    const identity = join([profile.headline, profile.location ? `(${profile.location})` : ""], " ");
    if (identity) lines.push(identity);

    const skills = (profile.skills ?? []).map((skill) => skill.trim()).filter(Boolean);
    if (skills.length > 0) lines.push(`Skills: ${skills.join(", ")}`);

    const experience = (profile.experience ?? []).filter((role) => role.title || role.company);
    if (experience.length > 0) {
        lines.push("Experience:");
        for (const role of experience) {
            const head = join([role.title, role.company ? `at ${role.company}` : ""], " ");
            lines.push(`- ${join([head, role.period ? `(${role.period})` : ""], " ")}${role.summary ? ` — ${role.summary.trim()}` : ""}`);
        }
    }

    const education = (profile.education ?? []).filter((entry) => entry.school || entry.qualification);
    if (education.length > 0) {
        lines.push("Education:");
        for (const entry of education) {
            const head = join([entry.qualification, entry.school ? `· ${entry.school}` : ""], " ");
            lines.push(`- ${join([head, entry.period ? `(${entry.period})` : ""], " ")}`);
        }
    }

    return lines.join("\n").trim();
}
