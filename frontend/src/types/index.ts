export interface User {
	_id: string;
	id?: string;
	name: string;
	email: string;
	role: "recruiter" | "candidate";
	onboarded?: boolean;
	organization?: string | null;
	resumeName?: string;
	resume?: string;
	photo?: string;
	audio?: string;
	consentGiven?: boolean;
	consentDate?: string;
	consentVersion?: string;
	onboardingCompleted?: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export interface AuthUser {
	id: string;
	email: string;
	name?: string;
	role: "recruiter" | "candidate";
	onboarded?: boolean;
}

export interface OrganizationMember {
	user: User;
	role: "admin" | "recruiter";
	joinedAt?: string;
}

export interface Organization {
	_id: string;
	name: string;
	slug: string;
	members: OrganizationMember[];
	createdBy: string | User;
	createdAt?: string;
	updatedAt?: string;
}

export interface DsaExample {
	input: string;
	output: string;
	explanation?: string;
}

export interface DsaProblem {
	_id?: string;
	title: string;
	description: string;
	difficulty: "easy" | "medium" | "hard" | string;
	constraints?: string;
	examples?: DsaExample[];
	topics?: string[];
	starterCode?: {
		python?: string;
		javascript?: string;
		java?: string;
		cpp?: string;
	};
	expectedApproach?: string;
}

export interface Interview {
	_id: string;
	title: string;
	description: string;
	targetRole: string;
	questions: string[];
	dsaProblems: DsaProblem[];
	status: "draft" | "active" | "closed";
	inviteLink?: string;
	completionsCount?: number;
	expiresAt?: string;
	organization?: string | Organization;
	interviewType?: "behavioral" | "dsa" | "mixed";
	createdAt?: string;
	updatedAt?: string;
}

export interface ResultItem {
	question: string;
	transcription: string;
	score: number | null;
	feedback: string;
}

export interface DsaResultItem {
	problemId?: string;
	problemTitle: string;
	problemIndex?: number;
	language: string;
	code: string;
	score: number | null;
	correctness?: number | null;
	codeQuality?: number | null;
	timeComplexity?: string;
	spaceComplexity?: string;
	feedback: string;
	strengths?: string[];
	improvements?: string[];
	timeSpentSeconds?: number;
}

export interface RehearsalSession {
	_id: string;
	user: string;
	targetRole: string;
	sessionType: "behavioral" | "dsa" | "mixed";
	results: ResultItem[];
	dsaResults: DsaResultItem[];
	createdAt: string;
	updatedAt?: string;
}

export interface CandidateInvite {
	_id: string;
	interview: string | Interview;
	candidate: string | User;
	inviteToken: string;
	status: "pending" | "started" | "completed";
	currentRound: "behavioral" | "dsa" | "done";
	invitedAt: string;
	startedAt?: string;
	completedAt?: string;
	results: ResultItem[];
	dsaResults: DsaResultItem[];
	createdAt: string;
	updatedAt?: string;
}

export interface NormalizedSession {
	_id: string;
	title: string;
	targetRole: string;
	dateStr: string;
	avg: string;
	status?: string;
	organization?: string;
	results: ResultItem[];
	dsaResults?: DsaResultItem[];
	sessionKind?: "behavioral" | "dsa" | "mixed";
	scoreSum: number;
}

/** One role in the candidate-maintained profile. */
export interface ProfileExperience {
	title: string;
	company: string;
	period?: string;
	summary?: string;
}

/** One qualification in the candidate-maintained profile. */
export interface ProfileEducation {
	school: string;
	qualification?: string;
	period?: string;
}

/** A stored file, as the profile reports it — the bytes are fetched separately. */
export interface ProfileArtifact {
	present: boolean;
	name?: string | null;
	sizeBytes?: number | null;
	updatedAt?: string | null;
}

/** What a practice round is generated from, and where that text comes from. */
export type RoundSource =
	| { kind: "profile"; text: string }
	| { kind: "resume"; text: null }
	| { kind: "none"; text: null };

/** The candidate's own record, as `GET /api/users` returns it. */
export interface UserProfile {
	_id: string;
	id: string;
	name: string;
	email: string;
	role: "candidate" | "recruiter";
	createdAt: string;
	onboardingCompleted: boolean;
	onboarded: boolean;
	headline: string | null;
	location: string | null;
	skills: string[];
	experience: ProfileExperience[];
	education: ProfileEducation[];
	resumeParsedAt: string | null;
	resume: ProfileArtifact;
	photo: ProfileArtifact;
	voice: ProfileArtifact;
	consent: { given: boolean; date: string | null; version: string | null };
	roundSource: RoundSource;
}

/** One section the resume read would change, as a proposal. */
export interface ReadPreview {
	section: "headline" | "location" | "skills" | "experience" | "education";
	label: string;
	current: unknown;
	next: unknown;
	/** True when the read would replace something the candidate already set. */
	replaces: boolean;
}
