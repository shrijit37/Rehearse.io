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
