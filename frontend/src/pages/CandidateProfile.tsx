import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	AlertCircle,
	Camera,
	CheckCircle2,
	FileText,
	ImageUp,
	Mic,
	Plus,
	RefreshCw,
	Settings,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { updateAccountName } from "@/lib/auth-client";
import { label } from "@/lib/labels";
import { readStoredUser, writeStoredUser } from "@/lib/session";
import type {
	ProfileEducation,
	ProfileExperience,
	ReadPreview,
	UserProfile,
} from "@/types";

/**
 * The candidate's own record, read back and maintained: what the platform holds
 * (resume, headshot, voice sample), what it read out of the resume, and the exact
 * text a practice round is generated from.
 *
 * Read-only facts sit on the black identity rail; everything editable sits in a
 * ruled plate beside it, each plate saving on its own so one edit never
 * discards another's.
 */

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type PlateId = "identity" | "resume" | "round" | "headshot" | "voice";
/** Which drafts a response may reset, so a save never touches another plate. */
type SyncScope = "all" | "identity" | "round" | "record";
type Note = { kind: "ok" | "warn" | "error"; text: string };

// The API's own caps, mirrored here so the page refuses the save in its own
// words instead of surfacing a validator string.
const HEADLINE_MAX = 160;
const LOCATION_MAX = 80;
const ROLE_TITLE_MAX = 120;
const ROLE_SUMMARY_MAX = 1200;
const SCHOOL_MAX = 160;
const QUALIFICATION_MAX = 120;
const SKILL_MAX = 60;
const PERIOD_MAX = 60;
const SKILLS_MAX = 30;
const ROLES_MAX = 20;
const QUALIFICATIONS_MAX = 10;
type PlateStatus =
	| { kind: "idle" }
	| { kind: "saving" }
	| { kind: "saved"; at: string }
	| { kind: "error"; message: string };

/** How the resume read names each section it filled, in the plate's own language. */
const READ_SECTION_WORD: Record<string, string> = {
	headline: "a headline",
	location: "a location",
	skills: "skills",
	experience: "roles",
	education: "education",
};

const formatDate = (value?: string | null) =>
	value
		? new Date(value).toLocaleDateString(undefined, {
				day: "numeric",
				month: "short",
				year: "numeric",
			})
		: "—";

const formatBytes = (bytes?: number | null) => {
	if (bytes == null) return "—";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Rows compared as flat tuples: a row's key order must never read as an edit. */
const experienceKey = (rows: ProfileExperience[]) =>
	rows.map((row) => [row.title ?? "", row.company ?? "", row.period ?? "", row.summary ?? ""]);

const educationKey = (rows: ProfileEducation[]) =>
	rows.map((row) => [row.school ?? "", row.qualification ?? "", row.period ?? ""]);
/** The read's value for one section, as a line the candidate can read. */
const readValue = (value: unknown): string => {
	if (Array.isArray(value)) {
		if (value.length === 0) return "—";
		return value
			.map((entry) => {
				if (typeof entry === "string") return entry;
				if (!entry || typeof entry !== "object") return "";
				const row = entry as Record<string, unknown>;
				return [row.title, row.company, row.school, row.qualification, row.period]
					.map((part) => (typeof part === "string" ? part.trim() : ""))
					.filter(Boolean)
					.join(" · ");
			})
			.filter(Boolean)
			.join("; ");
	}
	return typeof value === "string" ? value : "—";
};

/** Reads a File as the base64 data URL the API stores. */
const readFileAsDataUrl = (file: Blob) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Could not read that file"));
		reader.readAsDataURL(file);
	});

function PlateStatusMark({ status }: { status: PlateStatus }) {
	if (status.kind === "saving") {
		return (
			<span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
				<RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
				Saving
			</span>
		);
	}
	if (status.kind === "saved") {
		return (
			<span className="text-[12px] font-semibold text-success">
				<span key={status.at} className="flap">
					<span aria-hidden="true">✓</span> Saved {status.at}
				</span>
			</span>
		);
	}
	return null;
}

function Plate({
	id,
	title,
	description,
	action,
	status,
	children,
}: {
	id: PlateId;
	title: string;
	description: string;
	action: ReactNode;
	status: PlateStatus;
	children: ReactNode;
}) {
	return (
		<section
			aria-labelledby={`${id}-plate-title`}
			className="overflow-hidden rounded-md border-2 border-sign-black bg-card"
		>
			<header className="flex items-start justify-between gap-4 border-b border-border px-4 py-2.5">
				<div className="min-w-0 space-y-0.5">
					<h2 id={`${id}-plate-title`} className="text-[13px] font-bold text-foreground">
						{title}
					</h2>
					<p className="text-[11.5px] text-muted-foreground">{description}</p>
				</div>
				<div className="flex shrink-0 items-center gap-3 pt-0.5">
					<PlateStatusMark status={status} />
					{action}
				</div>
			</header>
			<div className="space-y-3.5 px-4 py-4">{children}</div>
		</section>
	);
}

function Notice({ note }: { note: Note }) {
	const tone =
		note.kind === "ok"
			? "border-success/20 bg-success/10 text-success"
			: note.kind === "warn"
				? "border-warning/20 bg-warning/10 text-warning"
				: "border-destructive/20 bg-destructive/10 text-destructive";
	const Glyph = note.kind === "ok" ? CheckCircle2 : AlertCircle;
	return (
		<p
			role={note.kind === "error" ? "alert" : "status"}
			className={`flex items-start gap-2 rounded-md border p-2.5 text-[12px] font-medium ${tone}`}
		>
			<Glyph className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
			<span>{note.text}</span>
		</p>
	);
}

function Field({
	id,
	label: text,
	hint,
	children,
}: {
	id: string;
	label: string;
	hint?: string;
	children: ReactNode;
}) {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id} className="text-muted-foreground">
				{text}
			</Label>
			{children}
			{hint && <p className="text-[11.5px] text-muted-foreground">{hint}</p>}
		</div>
	);
}

/** One row of a repeating field group, ruled rather than boxed. */
function RuledGroup({
	legend,
	removeLabel,
	onRemove,
	children,
}: {
	legend: string;
	removeLabel: string;
	onRemove: () => void;
	children: ReactNode;
}) {
	return (
		<fieldset className="space-y-2.5 border-t border-border pt-3.5 first:border-t-0 first:pt-0">
			<legend className="type-sign-label text-muted-foreground">{legend}</legend>
			{children}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={onRemove}
				className="gap-1.5 text-destructive"
			>
				<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
				{removeLabel}
			</Button>
		</fieldset>
	);
}

/** One line of the rail's checklist: mark, name, state, and the fact behind it. */
function RailRow({
	mark,
	name,
	state,
	detail,
}: {
	mark: string;
	name: string;
	state: string;
	detail: string;
}) {
	return (
		<div className="flex items-start gap-2 text-[12.5px]">
			<span aria-hidden="true" className="w-3 shrink-0 font-semibold text-sign-white">
				{mark}
			</span>
			<span className="min-w-0">
				<span className="font-semibold text-sign-white">{name}</span>{" "}
				<span className="text-sign-white/65">{state}</span>
				<span className="block break-words text-[11.5px] text-sign-white/55">{detail}</span>
			</span>
		</div>
	);
}

const CandidateProfile = () => {
	const navigate = useNavigate();
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [status, setStatus] = useState<Record<PlateId, PlateStatus>>({
		identity: { kind: "idle" },
		resume: { kind: "idle" },
		round: { kind: "idle" },
		headshot: { kind: "idle" },
		voice: { kind: "idle" },
	});
	const [lastSaved, setLastSaved] = useState<{ label: string; at: string } | null>(null);

	// The identity plate
	const [name, setName] = useState("");
	// The profile a round reads, as edited here
	const [headline, setHeadline] = useState("");
	const [location, setLocation] = useState("");
	const [skills, setSkills] = useState<string[]>([]);
	const [experience, setExperience] = useState<ProfileExperience[]>([]);
	const [education, setEducation] = useState<ProfileEducation[]>([]);
	const [skillDraft, setSkillDraft] = useState("");
	// The resume plate
	const [pendingResume, setPendingResume] = useState<{ name: string; dataUrl: string } | null>(null);
	const [reading, setReading] = useState(false);
	const [readNote, setReadNote] = useState<Note | null>(null);
	/** What the last read proposed, pending the candidate's acceptance. */
	const [readPreview, setReadPreview] = useState<ReadPreview[]>([]);
	// The sections the candidate accepts from the pending read.
	const [acceptedSections, setAcceptedSections] = useState<string[]>([]);
	const [applyingRead, setApplyingRead] = useState(false);
	const [resumeNote, setResumeNote] = useState<Note | null>(null);
	/** The round plate's own notice, for outcomes of its own save. */
	const [roundNote, setRoundNote] = useState<Note | null>(null);
	// The headshot plate
	const [photoDraft, setPhotoDraft] = useState<string | null>(null);
	const [photoNote, setPhotoNote] = useState<Note | null>(null);
	const [wantsCamera, setWantsCamera] = useState(false);
	const [cameraBusy, setCameraBusy] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const photoInputRef = useRef<HTMLInputElement>(null);
	const resumeInputRef = useRef<HTMLInputElement>(null);
	// The voice plate
	const [voiceDraft, setVoiceDraft] = useState<{ url: string; dataUrl: string } | null>(null);
	const [voiceNote, setVoiceNote] = useState<Note | null>(null);
	const [recording, setRecording] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	// Stored files, fetched separately from the record so a headshot never rides
	// on every read of the profile.
	const [storedMedia, setStoredMedia] = useState<{ photo?: string; voice?: string }>({});
	const urlsRef = useRef<string[]>([]);

	const setPlate = useCallback(
		(id: PlateId, next: PlateStatus) =>
			setStatus((prev) => ({ ...prev, [id]: next })),
		[],
	);

	/**
	 * Points a plate at the object URL that holds its stored file, or at none.
	 * Both the save path and the failure path come through here: the URL this
	 * replaces is revoked and dropped from `urlsRef` in the same step that
	 * forgets it, so no plate can be left pointing at a live URL that nothing
	 * tracks, and no revoked URL can be left behind in `urlsRef`.
	 */
	const setStoredUrl = useCallback((kind: "photo" | "voice", url?: string) => {
		setStoredMedia((prev) => {
			const current = prev[kind];
			if (current) {
				URL.revokeObjectURL(current);
				urlsRef.current = urlsRef.current.filter((entry) => entry !== current);
			}
			return { ...prev, [kind]: url };
		});
	}, []);

	/** Drops a stored blob and the object URL that made it viewable. */
	const clearStored = useCallback((kind: "photo" | "voice") => setStoredUrl(kind), [setStoredUrl]);

	/** Refreshes one stored file after it changes, or reports why it cannot load. */
	const refreshStored = useCallback(
		async (kind: "photo" | "voice") => {
			try {
				const res = await api.get<Response>(`/api/users/profile/media/${kind}`, { raw: true });
				if (!res.ok) {
					const body = await res.json().catch(() => null);
					clearStored(kind);
					const text =
						body?.message ||
						`Could not load the ${kind === "photo" ? "stored headshot" : "stored sample"} (${res.status})`;
					if (kind === "photo") setPhotoNote({ kind: "error", text });
					else setVoiceNote({ kind: "error", text });
					return;
				}
				const url = URL.createObjectURL(await res.blob());
				urlsRef.current.push(url);
				setStoredUrl(kind, url);
			} catch (err) {
				const text = err instanceof Error ? err.message : "Could not load the stored file";
				if (kind === "photo") setPhotoNote({ kind: "error", text });
				else setVoiceNote({ kind: "error", text });
			}
		},
		[clearStored, setStoredUrl],
	);

	/** Applies a fresh server record, syncing only the scope the caller changed. */
	const applyProfile = useCallback((next: UserProfile, scope: SyncScope) => {
		setProfile(next);
		if (scope === "all" || scope === "identity") setName(next.name);
		if (scope === "all" || scope === "round") {
			setHeadline(next.headline ?? "");
			setLocation(next.location ?? "");
			setSkills(next.skills);
			setExperience(next.experience);
			setEducation(next.education);
		}
	}, []);

	const loadProfile = useCallback(async () => {
		setLoadError(null);
		try {
			const res = await api.get<{ data: UserProfile }>("/api/users");
			applyProfile(res.data, "all");
			if (res.data.photo.present) await refreshStored("photo");
			if (res.data.voice.present) await refreshStored("voice");
		} catch (err) {
			setLoadError(err instanceof Error ? err.message : "Could not load your profile");
		}
	}, [applyProfile, refreshStored]);

	useEffect(() => {
		void loadProfile();
	}, [loadProfile]);

	// Release the camera, the recorder and every object URL this page created.
	useEffect(
		() => () => {
			streamRef.current?.getTracks().forEach((track) => track.stop());
			if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
			urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
		},
		[],
	);

	// The camera opens only when the candidate asks for it, and only once the
	// video element is on screen.
	useEffect(() => {
		if (!wantsCamera) return;
		let cancelled = false;
		const open = async () => {
			setCameraBusy(true);
			setPhotoNote(null);
			try {
				if (!navigator.mediaDevices?.getUserMedia) {
					throw new Error("This browser cannot open a camera.");
				}
				const video = videoRef.current;
				if (!video) throw new Error("The camera view is not ready yet.");
				const stream = await navigator.mediaDevices.getUserMedia({
					video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
				});
				if (cancelled) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}
				streamRef.current = stream;
				video.srcObject = stream;
				await video.play().catch(() => {});
			} catch (err) {
				const name = err instanceof Error ? err.name : "";
				setPhotoNote({
					kind: "error",
					text:
						name === "NotAllowedError"
							? "Camera permission was refused. You can still choose a photo file instead."
							: name === "NotFoundError"
								? "No camera was found on this device. Choose a photo file instead."
								: err instanceof Error
									? err.message
									: "Could not open the camera.",
				});
				setWantsCamera(false);
			} finally {
				if (!cancelled) setCameraBusy(false);
			}
		};
		void open();
		return () => {
			cancelled = true;
		};
	}, [wantsCamera]);

	const closeCamera = () => {
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;
		setWantsCamera(false);
	};

	const nameDirty = profile ? name.trim() !== profile.name : false;

	const roundDirty = useMemo(() => {
		if (!profile) return false;
		return (
			headline !== (profile.headline ?? "") ||
			location !== (profile.location ?? "") ||
			JSON.stringify(skills) !== JSON.stringify(profile.skills) ||
			JSON.stringify(experienceKey(experience)) !== JSON.stringify(experienceKey(profile.experience)) ||
			JSON.stringify(educationKey(education)) !== JSON.stringify(educationKey(profile.education))
		);
	}, [profile, headline, location, skills, experience, education]);

	// A plate's saved mark describes the saved state, so editing clears it.
	useEffect(() => {
		if (nameDirty) setPlate("identity", { kind: "idle" });
	}, [nameDirty, setPlate]);
	useEffect(() => {
		if (roundDirty) setPlate("round", { kind: "idle" });
	}, [roundDirty, setPlate]);

	const savePlate = async (
		id: PlateId,
		plateLabel: string,
		body: Record<string, unknown>,
		scope: SyncScope,
	) => {
		setPlate(id, { kind: "saving" });
		try {
			const res = await api.patch<{ data: UserProfile }>("/api/users/profile", body);
			applyProfile(res.data, scope);
			const at = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
			setPlate(id, { kind: "saved", at });
			setLastSaved({ label: plateLabel, at });
			return true;
		} catch (err) {
			setPlate(id, {
				kind: "error",
				message: err instanceof Error ? err.message : "Could not save",
			});
			return false;
		}
	};

	const saveName = async () => {
		const next = name.trim();
		if (!next) {
			setPlate("identity", { kind: "error", message: "A name cannot be empty." });
			return;
		}
		setPlate("identity", { kind: "saving" });
		try {
			// The sign-in service owns the name and the app rebuilds its own row
			// from its session on every sign-in, so it is written there first.
			await updateAccountName(next);
		} catch (err) {
			setPlate("identity", {
				kind: "error",
				message: `The sign-in service refused the change — ${
					err instanceof Error ? err.message : "unknown error"
				}`,
			});
			return;
		}
		if (!(await savePlate("identity", "Name", { name: next }, "identity"))) return;
		try {
			const cached = readStoredUser();
			if (cached) {
				writeStoredUser({ ...cached, name: next });
				window.dispatchEvent(new Event("storage"));
			}
		} catch {
			// Storage disabled or over quota: the cache keeps the old name until
			// the next sign-in rebuilds it. The name is saved either way — the
			// record is the truth, this is only the local cache.
		}
	};

	/** Rows with no identifying content are dropped rather than stored empty. */
	const blankRole = experience.filter((row) => !row.title.trim() && !row.company.trim()).length;
	const blankEducation = education.filter(
		(row) => !row.school.trim() && !(row.qualification ?? "").trim(),
	).length;
	const overlong = [
		headline.length > HEADLINE_MAX ? "Headline" : null,
		location.length > LOCATION_MAX ? "Location" : null,
		...experience.flatMap((row, index) => [
			row.title.length > ROLE_TITLE_MAX ? `Role ${index + 1} title` : null,
			row.company.length > ROLE_TITLE_MAX ? `Role ${index + 1} company` : null,
			(row.summary ?? "").length > ROLE_SUMMARY_MAX ? `Role ${index + 1} summary` : null,
		]),
		...education.flatMap((entry, index) => [
			entry.school.length > SCHOOL_MAX ? `Qualification ${index + 1} school` : null,
			(entry.qualification ?? "").length > QUALIFICATION_MAX
				? `Qualification ${index + 1} qualification`
				: null,
		]),
		...skills.filter((skill) => skill.length > SKILL_MAX).map((skill) => `Skill "${skill}"`),
	].filter((entry): entry is string => entry !== null);

	const saveRound = async () => {
		if (overlong.length > 0) {
			setPlate("round", {
				kind: "error",
				message: `Too long to save: ${overlong.join(", ")}. Shorten ${overlong.length === 1 ? "it" : "them"} and try again.`,
			});
			return;
		}
		setRoundNote(null);

		const dropped = blankRole + blankEducation;
		const saved = await savePlate(
			"round",
			"Profile",
			{
				headline: headline.trim(),
				location: location.trim(),
				skills,
				experience: experience.filter((row) => row.title.trim() || row.company.trim()),
				education: education.filter(
					(row) => row.school.trim() || (row.qualification ?? "").trim(),
				),
			},
			"round",
		);

		// Only a save that actually landed may claim rows were dropped, and the
		// notice belongs to the plate whose save dropped them.
		setRoundNote(
			saved && dropped > 0
				? {
						kind: "warn",
						text: `${dropped} empty ${dropped === 1 ? "row was" : "rows were"} dropped: a role needs a title or a company, a qualification a school or a degree.`,
					}
				: null,
		);
	};

	const addSkill = () => {
		const next = skillDraft.trim();
		if (!next) return;
		// The cap lives in the updater, not only on the button: a disabled submit
		// button does not stop an implicit submit from the input's Enter key.
		setSkills((prev) => {
			if (prev.length >= SKILLS_MAX) return prev;
			return prev.some((skill) => skill.toLowerCase() === next.toLowerCase())
				? prev
				: [...prev, next];
		});
		setSkillDraft("");
	};

	const removeSkill = (index: number) =>
		setSkills((prev) => prev.filter((_, at) => at !== index));

	const updateExperience = (index: number, key: keyof ProfileExperience, value: string) =>
		setExperience((prev) =>
			prev.map((row, at) => (at === index ? { ...row, [key]: value } : row)),
		);

	const updateEducation = (index: number, key: keyof ProfileEducation, value: string) =>
		setEducation((prev) =>
			prev.map((row, at) => (at === index ? { ...row, [key]: value } : row)),
		);

	const onResumeFile = async (file: File | undefined) => {
		setResumeNote(null);
		if (!file) return;
		if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
			setResumeNote({ kind: "error", text: "That is not a PDF. Your resume has to be a PDF file." });
			return;
		}
		if (file.size > MAX_FILE_BYTES) {
			setResumeNote({
				kind: "error",
				text: `That file is ${formatBytes(file.size)}; the limit is 5 MB.`,
			});
			return;
		}
		try {
			setPendingResume({ name: file.name, dataUrl: await readFileAsDataUrl(file) });
			// The plate's saved mark described the previous file.
			setPlate("resume", { kind: "idle" });
		} catch (err) {
			setResumeNote({
				kind: "error",
				text: err instanceof Error ? err.message : "Could not read that file",
			});
		}
	};

	const saveResume = async () => {
		if (!pendingResume) return;
		const saved = await savePlate(
			"resume",
			"Resume",
			{ resume: pendingResume.dataUrl, resumeName: pendingResume.name },
			"record",
		);
		if (!saved) return;
		setPendingResume(null);
		setResumeNote(null);
		setReadNote({
			kind: "warn",
			text: "A new file is on record. Read it so the profile below is filled from this one.",
		});
	};

	const openResume = async () => {
		setResumeNote(null);
		try {
			const res = await api.get<Response>("/api/users/profile/media/resume", { raw: true });
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				setResumeNote({
					kind: "error",
					text: body?.message || `Could not open the file (${res.status})`,
				});
				return;
			}
			const url = URL.createObjectURL(await res.blob());
			urlsRef.current.push(url);
			const link = document.createElement("a");
			link.href = url;
			link.target = "_blank";
			link.rel = "noopener";
			link.click();
		} catch (err) {
			setResumeNote({
				kind: "error",
				text: err instanceof Error ? err.message : "Could not open the file",
			});
		}
	};

	/**
	 * Asks the API what a read would change. It writes nothing: the candidate's
	 * corrections are the record, so a re-read proposes and they decide.
	 */
	const readResume = async () => {
		setReading(true);
		setReadNote(null);
		try {
			const res = await api.post<{ preview: ReadPreview[] }>(
				"/api/users/profile/parse-resume",
				{ apply: false },
			);
			if (res.preview.length === 0) {
				setReadPreview([]);
				setReadNote({
					kind: "warn",
					text: "The read finished without finding anything to add, so your profile is unchanged.",
				});
				return;
			}
			setReadPreview(res.preview);
			// Sections that hold nothing of the candidate's are offered by default;
			// a section they have already written into is opt-in.
			setAcceptedSections(res.preview.filter((row) => !row.replaces).map((row) => row.section));
		} catch (err) {
			setReadPreview([]);
			const status = (err as ApiError).status;
			setReadNote({
				kind: "error",
				// A reader that cannot answer is our problem, not the candidate's
				// typing, so say which happened and what to do about it.
				text:
					status !== undefined && status >= 500
						? "The reading service could not answer just now. Nothing on your record changed — try again in a moment, or type the details in yourself."
						: err instanceof Error
							? err.message
							: "Could not read the resume",
			});
		} finally {
			setReading(false);
		}
	};

	/** Writes only the sections the candidate ticked, and never over their typing. */
	const applyRead = async () => {
		if (roundDirty) {
			setReadNote({
				kind: "warn",
				text: "Save or discard your unsaved edits in the profile plate first — taking the read would replace what you are typing.",
			});
			return;
		}
		if (acceptedSections.length === 0) {
			setReadNote({
				kind: "warn",
				text: "Tick at least one section to take from the read.",
			});
			return;
		}
		setApplyingRead(true);
		try {
			const res = await api.post<{ data: UserProfile; changed: string[] }>(
				"/api/users/profile/parse-resume",
				{ apply: true, sections: acceptedSections },
			);
			applyProfile(res.data, "round");
			setPlate("round", { kind: "idle" });
			setReadPreview([]);
			setReadNote({
				kind: "ok",
				text: `Took ${res.changed
					.map((section) => READ_SECTION_WORD[section] ?? label(section))
					.join(", ")} from the read. Everything you left unticked is still yours.`,
			});
		} catch (err) {
			setReadNote({
				kind: "error",
				text: err instanceof Error ? err.message : "Could not apply the read",
			});
		} finally {
			setApplyingRead(false);
		}
	};

	const capturePhoto = () => {
		const video = videoRef.current;
		if (!video || video.videoWidth === 0) {
			setPhotoNote({
				kind: "warn",
				text: "The camera is still warming up — try capturing again in a moment.",
			});
			return;
		}
		const canvas = document.createElement("canvas");
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext("2d")?.drawImage(video, 0, 0);
		setPhotoDraft(canvas.toDataURL("image/jpeg", 0.85));
		closeCamera();
	};

	const onPhotoFile = async (file: File | undefined) => {
		setPhotoNote(null);
		if (!file) return;
		if (!/^image\/(png|jpeg)$/.test(file.type)) {
			setPhotoNote({ kind: "error", text: "Choose a PNG or JPEG image." });
			return;
		}
		if (file.size > MAX_FILE_BYTES) {
			setPhotoNote({
				kind: "error",
				text: `That image is ${formatBytes(file.size)}; the limit is 5 MB.`,
			});
			return;
		}
		try {
			setPhotoDraft(await readFileAsDataUrl(file));
		} catch (err) {
			setPhotoNote({
				kind: "error",
				text: err instanceof Error ? err.message : "Could not read that file",
			});
		}
	};

	const savePhoto = async () => {
		if (!photoDraft) return;
		if (!(await savePlate("headshot", "Headshot", { photo: photoDraft }, "record"))) return;
		setPhotoDraft(null);
		setPhotoNote(null);
		await refreshStored("photo");
	};

	/**
	 * Removes an artifact from the record. The page owns this PII, so letting go
	 * of it is part of maintaining the profile, not an account-level affair.
	 */
	const removeArtifact = async (kind: "photo" | "voice") => {
		const label = kind === "photo" ? "Headshot" : "Voice sample";
		const plate = kind === "photo" ? "headshot" : "voice";
		// Only here does the API's own name for the voice column appear.
		const payload = kind === "photo" ? { photo: "" } : { audio: "" };
		if (!(await savePlate(plate, label, payload, "record"))) return;
		// The plate must stop showing what the record no longer holds, in the same
		// frame the removal is confirmed — otherwise the notice and plate disagree.
		clearStored(kind);
		if (kind === "photo") {
			setPhotoDraft(null);
			setPhotoNote({ kind: "ok", text: "Headshot removed from your record." });
		} else {
			setVoiceDraft(null);
			setVoiceNote({ kind: "ok", text: "Voice sample removed from your record." });
		}
	};

	const startRecording = async () => {
		setVoiceNote(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream);
			mediaRecorderRef.current = recorder;
			audioChunksRef.current = [];
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) audioChunksRef.current.push(event.data);
			};
			recorder.onstop = async () => {
				const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
				stream.getTracks().forEach((track) => track.stop());
				const url = URL.createObjectURL(blob);
				urlsRef.current.push(url);
				try {
					setVoiceDraft({ url, dataUrl: await readFileAsDataUrl(blob) });
				} catch {
					setVoiceNote({
						kind: "error",
						text: "Could not prepare that recording. Try again.",
					});
				}
			};
			recorder.start();
			setRecording(true);
		} catch {
			setVoiceNote({
				kind: "error",
				text: "Could not open the microphone. Check that one is connected and that the browser is allowed to use it.",
			});
		}
	};

	const stopRecording = () => {
		if (mediaRecorderRef.current?.state === "recording") {
			mediaRecorderRef.current.stop();
			setRecording(false);
		}
	};

	const saveVoice = async () => {
		if (!voiceDraft) return;
		if (!(await savePlate("voice", "Voice sample", { audio: voiceDraft.dataUrl }, "record"))) return;
		setVoiceDraft(null);
		setVoiceNote(null);
		await refreshStored("voice");
	};

	if (!profile) {
		return (
			<div className="mt-14 min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-6xl space-y-6">
					{loadError ? (
						<div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 rounded-md border-2 border-sign-black bg-card p-8 text-center">
							<AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
							<div className="space-y-1.5">
								<h1 className="text-base font-bold text-foreground">
									Unable to load your profile
								</h1>
								<p className="text-[13px] text-muted-foreground">{loadError}</p>
							</div>
							<Button onClick={() => void loadProfile()} className="font-semibold">
								Try again
							</Button>
						</div>
					) : (
						<div className="grid animate-pulse grid-cols-1 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
							<div className="h-80 rounded-md border-2 border-sign-black bg-secondary/60" />
							<div className="space-y-6">
								<div className="h-36 rounded-md border border-border/60 bg-secondary/40" />
								<div className="h-56 rounded-md border border-border/60 bg-secondary/40" />
							</div>
						</div>
					)}
				</div>
			</div>
		);
	}

	const initials =
		profile.name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part.charAt(0))
			.join("")
			.toUpperCase() || "U";

	const headshotSrc = photoDraft ?? storedMedia.photo;
	const resumeFacts = [
		profile.resume.name ?? "resume.pdf",
		formatBytes(profile.resume.sizeBytes),
		profile.resume.updatedAt ? `added ${formatDate(profile.resume.updatedAt)}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="mt-14 min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-6xl space-y-6">
				{/* The heading, and the one place account-level settings are offered */}
				<div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end">
					<div className="space-y-1.5">
						<h1 className="type-monument text-3xl text-foreground">Your profile</h1>
						<p className="max-w-xl text-[13px] text-muted-foreground">
							What this platform holds about you, and what your next practice round
							reads.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => navigate("/account")}
						className="shrink-0 gap-2 font-semibold"
					>
						<Settings className="h-3.5 w-3.5" aria-hidden="true" />
						Account settings
					</Button>
				</div>

				<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
					{/* The identity rail: who this record is, and what it holds */}
					<aside className="on-sign overflow-hidden rounded-md border-2 border-sign-black lg:sticky lg:top-20">
						<div className="space-y-4 p-5">
							<div className="flex items-center gap-3.5">
								{storedMedia.photo ? (
									<img
										src={storedMedia.photo}
										alt="Your headshot"
										className="h-14 w-14 rounded-full border-2 border-sign-white/25 object-cover"
									/>
								) : (
									<span
										aria-hidden="true"
										className="flex h-14 w-14 items-center justify-center rounded-full border border-sign-white/25 bg-sign-white/10 text-[13px] font-bold text-sign-white"
									>
										{initials}
									</span>
								)}
								<span className="type-sign-label rounded-sm border border-sign-white/30 px-1.5 py-0.5 text-sign-white/80">
									{label(profile.role)}
								</span>
							</div>
							<h2 className="type-monument type-monument-tight text-[34px] text-sign-yellow">
								{profile.name}
							</h2>
							<dl className="space-y-1.5 text-[12px]">
								{[
									["Email", profile.email],
									["Member since", formatDate(profile.createdAt)],
								].map(([term, value]) => (
									<div key={term} className="flex gap-2">
										<dt className="w-24 shrink-0 text-sign-white/50">{term}</dt>
										<dd className="min-w-0 break-words text-sign-white">{value}</dd>
									</div>
								))}
							</dl>
						</div>

						<div className="space-y-2.5 border-t-2 border-sign-white/15 px-5 py-4">
							<p className="type-sign-label text-sign-white/50">On record</p>
							<RailRow
								mark={profile.resume.present ? "✓" : "○"}
								name="Resume"
								state={profile.resume.present ? "on record" : "not on record"}
								detail={
									profile.resume.present
										? resumeFacts
										: "Nothing to read yet — a round needs a resume or the profile below."
								}
							/>
							<RailRow
								mark={profile.photo.present ? "✓" : "○"}
								name="Headshot"
								state={profile.photo.present ? "on record" : "not on record"}
								detail="Kept with your record; optional."
							/>
							<RailRow
								mark={profile.voice.present ? "✓" : "○"}
								name="Voice sample"
								state={profile.voice.present ? "on record" : "not on record"}
								detail="A microphone check; optional."
							/>
							<RailRow
								mark={profile.resumeParsedAt ? "✓" : "○"}
								name="Profile read"
								state={
									profile.resumeParsedAt
										? `from this file, ${formatDate(profile.resumeParsedAt)}`
										: "not read yet"
								}
								detail={
									profile.roundSource.kind === "profile"
										? "Your round is generated from the profile below."
										: "A round still falls back to the raw file text."
								}
							/>
						</div>

						<p
							role="status"
							aria-live="polite"
							className="border-t-2 border-sign-white/15 px-5 py-2.5 text-[12px] text-sign-white/70"
						>
							{lastSaved ? (
								<span key={`${lastSaved.label}${lastSaved.at}`} className="flap">
									{lastSaved.label} saved {lastSaved.at}
								</span>
							) : (
								"Every save is confirmed here."
							)}
						</p>
					</aside>

					{/* The plates: one save each */}
					<div className="min-w-0 space-y-6">
						<Plate
							id="identity"
							title="Name"
							description="What recruiters see beside your interviews."
							status={status.identity}
							action={
								<Button
									size="sm"
									onClick={() => void saveName()}
									disabled={!nameDirty || status.identity.kind === "saving"}
									className="font-semibold"
								>
									Save
								</Button>
							}
						>
							<Field
								id="profile-name"
								label="Display name"
								hint="Held by the sign-in service, so it is written there first — that is what keeps it from being replaced at your next sign-in."
							>
								<Input
									id="profile-name"
									value={name}
									maxLength={100}
									autoComplete="name"
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							{status.identity.kind === "error" && (
								<Notice note={{ kind: "error", text: status.identity.message }} />
							)}
						</Plate>

						<Plate
							id="resume"
							title="Resume"
							description="The file a practice round is generated from."
							status={status.resume}
							action={
								<Button
									size="sm"
									onClick={() => void saveResume()}
									disabled={!pendingResume || status.resume.kind === "saving"}
									className="font-semibold"
								>
									Save
								</Button>
							}
						>
							{profile.resume.present ? (
								<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
									<FileText className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
									<span className="truncate text-[13px] font-semibold text-foreground">
										{profile.resume.name}
									</span>
									<span className="num text-[12px] text-muted-foreground">
										{formatBytes(profile.resume.sizeBytes)}
									</span>
									{profile.resume.updatedAt && (
										<span className="text-[12px] text-muted-foreground">
											added <span className="num">{formatDate(profile.resume.updatedAt)}</span>
										</span>
									)}
									<span className="flex-1" />
									<Button
										variant="outline"
										size="sm"
										onClick={() => void openResume()}
										className="gap-2 font-semibold"
									>
										Open
									</Button>
								</div>
							) : (
								<div className="space-y-1.5 rounded-md border-2 border-dashed border-border p-5 text-center">
									<FileText className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
									<p className="text-[13px] font-semibold text-foreground">
										No resume on record
									</p>
									<p className="mx-auto max-w-md text-[12px] text-muted-foreground">
										A practice round is generated from this file, so it is the one thing
										the platform cannot do without.
									</p>
								</div>
							)}

							<div className="flex flex-wrap items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => resumeInputRef.current?.click()}
									className="gap-2 font-semibold"
								>
									<Upload className="h-3.5 w-3.5" aria-hidden="true" />
									{profile.resume.present ? "Replace resume" : "Upload resume"}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => void readResume()}
									disabled={!profile.resume.present || reading}
									className="gap-2 font-semibold"
								>
									<RefreshCw
										className={`h-3.5 w-3.5 ${reading ? "animate-spin" : ""}`}
										aria-hidden="true"
									/>
									{reading
										? "Reading"
										: profile.resumeParsedAt
											? "Read it again"
											: "Read my resume"}
								</Button>
								<input
									ref={resumeInputRef}
									type="file"
									accept="application/pdf,.pdf"
									className="hidden"
									onChange={(event) => {
										void onResumeFile(event.target.files?.[0]);
										event.target.value = "";
									}}
								/>
							</div>

							{pendingResume && (
								<Notice
									note={{
										kind: "ok",
										text: `${pendingResume.name} (${formatBytes(
											Math.round((pendingResume.dataUrl.length * 3) / 4),
										)}) is ready. Save to put it on record.`,
									}}
								/>
							)}
							{readNote && <Notice note={readNote} />}

							{/* The read proposes; the candidate decides section by section. */}
							{readPreview.length > 0 && (
								<fieldset className="space-y-2.5 rounded-md border-2 border-sign-black bg-muted p-3.5">
									<legend className="type-sign-label px-1 text-foreground">
										The read found these — take what you want
									</legend>
									{readPreview.map((row) => {
										const ticked = acceptedSections.includes(row.section);
										return (
											<label
												key={row.section}
												className="flex cursor-pointer items-start gap-2.5 rounded-sm border border-border bg-card p-2.5"
											>
												<input
													type="checkbox"
													checked={ticked}
													onChange={(event) =>
														setAcceptedSections((prev) =>
															event.target.checked
																? [...prev, row.section]
																: prev.filter((entry) => entry !== row.section),
														)
													}
													className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#111111]"
												/>
												<span className="min-w-0 text-[12px]">
													<span className="font-semibold text-foreground">
														{row.label}
													</span>
													<span className="block break-words text-muted-foreground">
														{readValue(row.next)}
													</span>
													{row.replaces && (
														<span className="mt-0.5 block text-[11.5px] font-semibold text-warning">
															<span aria-hidden="true">▲</span> replaces what you have
														</span>
													)}
												</span>
											</label>
										);
									})}
									<div className="flex flex-wrap gap-2 pt-0.5">
										<Button
											size="sm"
											onClick={() => void applyRead()}
											disabled={applyingRead}
											className="font-semibold"
										>
											Take the ticked sections
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												setReadPreview([]);
												setAcceptedSections([]);
											}}
											className="font-semibold"
										>
											Keep what I have
										</Button>
									</div>
								</fieldset>
							)}
							{resumeNote && <Notice note={resumeNote} />}
							{status.resume.kind === "error" && (
								<Notice note={{ kind: "error", text: status.resume.message }} />
							)}
						</Plate>

						<Plate
							id="round"
							title="Profile the round reads"
							description="Read from your resume, then corrected by you. This is what a practice round is generated from."
							status={status.round}
							action={
								<Button
									size="sm"
									onClick={() => void saveRound()}
									disabled={!roundDirty || status.round.kind === "saving"}
									className="font-semibold"
								>
									Save
								</Button>
							}
						>
							{status.round.kind === "error" && (
								<Notice note={{ kind: "error", text: status.round.message }} />
							)}
							{roundNote && <Notice note={roundNote} />}
							<div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
								<Field id="profile-headline" label="Headline" hint="How you describe yourself in one line.">
									<Input
										id="profile-headline"
										value={headline}
										onChange={(event) => setHeadline(event.target.value)}
										maxLength={HEADLINE_MAX}
										placeholder="Backend engineer · distributed systems"
									/>
								</Field>
								<Field id="profile-location" label="Location">
									<Input
										id="profile-location"
										value={location}
										onChange={(event) => setLocation(event.target.value)}
										maxLength={LOCATION_MAX}
										placeholder="City, country"
									/>
								</Field>
							</div>

							<div className="space-y-2">
								<Label className="text-muted-foreground">Skills</Label>
								{skills.length > 0 ? (
									<ul className="flex flex-wrap gap-1.5">
										{skills.map((skill, index) => (
											<li
												key={`${skill}-${index}`}
												className="inline-flex items-center gap-1.5 rounded-sm border-2 border-sign-black px-2 py-0.5 text-[12.5px] font-semibold text-foreground"
											>
												{skill}
												<button
													type="button"
													onClick={() => removeSkill(index)}
													aria-label={`Remove ${skill}`}
													className="text-muted-foreground transition-colors hover:text-destructive"
												>
													<X className="h-3 w-3" aria-hidden="true" />
												</button>
											</li>
										))}
									</ul>
								) : (
									<p className="text-[12px] text-muted-foreground">
										No skills listed yet. Two skills are enough for the round to be
										generated from your own words.
									</p>
								)}
								<form
									className="flex items-center gap-2"
									onSubmit={(event) => {
										event.preventDefault();
										addSkill();
									}}
								>
									<Input
										value={skillDraft}
										onChange={(event) => setSkillDraft(event.target.value)}
										placeholder="Add a skill"
										aria-label="Add a skill"
										className="max-w-xs"
									/>
									<Button
										type="submit"
										variant="secondary"
										disabled={
											skillDraft.trim().length === 0 || skills.length >= SKILLS_MAX
										}
										title={
											skills.length >= SKILLS_MAX
												? `A profile holds up to ${SKILLS_MAX} skills`
												: undefined
										}
										className="gap-1.5"
									>
										<Plus className="h-3.5 w-3.5" aria-hidden="true" />
										Add
									</Button>
								</form>
							</div>

							<div className="space-y-3.5">
								{experience.map((role, index) => (
									<RuledGroup
										key={index}
										legend={`Role ${index + 1}`}
										removeLabel="Remove this role"
										onRemove={() =>
											setExperience((prev) => prev.filter((_, at) => at !== index))
										}
									>
										<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
											<Field id={`role-title-${index}`} label="Title">
												<Input
													id={`role-title-${index}`}
													value={role.title}
													onChange={(event) =>
														updateExperience(index, "title", event.target.value)
													}
													maxLength={ROLE_TITLE_MAX}
													placeholder="Software engineer"
												/>
											</Field>
											<Field id={`role-company-${index}`} label="Company">
												<Input
													id={`role-company-${index}`}
													value={role.company}
													onChange={(event) =>
														updateExperience(index, "company", event.target.value)
													}
													maxLength={ROLE_TITLE_MAX}
												/>
											</Field>
											<Field id={`role-period-${index}`} label="Period">
												<Input
													id={`role-period-${index}`}
													value={role.period ?? ""}
													onChange={(event) =>
														updateExperience(index, "period", event.target.value)
													}
													maxLength={PERIOD_MAX}
													placeholder="Jan 2024 – present"
												/>
											</Field>
											<Field id={`role-summary-${index}`} label="One line about it">
												<Input
													id={`role-summary-${index}`}
													value={role.summary ?? ""}
													onChange={(event) =>
														updateExperience(index, "summary", event.target.value)
													}
													maxLength={ROLE_SUMMARY_MAX}
													placeholder="What you built, and with what"
												/>
											</Field>
										</div>
									</RuledGroup>
								))}
								{experience.length === 0 && (
									<p className="text-[12px] text-muted-foreground">
										No roles listed yet. One role is enough on its own.
									</p>
								)}
								<Button
									variant="outline"
									disabled={experience.length >= ROLES_MAX}
									title={
										experience.length >= ROLES_MAX
											? `A profile holds up to ${ROLES_MAX} roles`
											: undefined
									}
									onClick={() =>
										setExperience((prev) => [
											...prev,
											{ title: "", company: "", period: "", summary: "" },
										])
									}
									className="gap-1.5 font-semibold"
								>
									<Plus className="h-3.5 w-3.5" aria-hidden="true" />
									Add a role
								</Button>
							</div>

							<div className="space-y-3.5">
								{education.map((entry, index) => (
									<RuledGroup
										key={index}
										legend={`Qualification ${index + 1}`}
										removeLabel="Remove this qualification"
										onRemove={() =>
											setEducation((prev) => prev.filter((_, at) => at !== index))
										}
									>
										<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
											<Field id={`education-school-${index}`} label="School">
												<Input
													id={`education-school-${index}`}
													value={entry.school}
													onChange={(event) =>
														updateEducation(index, "school", event.target.value)
													}
													maxLength={SCHOOL_MAX}
												/>
											</Field>
											<Field id={`education-qualification-${index}`} label="Qualification">
												<Input
													id={`education-qualification-${index}`}
													value={entry.qualification ?? ""}
													onChange={(event) =>
														updateEducation(index, "qualification", event.target.value)
													}
													maxLength={QUALIFICATION_MAX}
													placeholder="BSc Computer Science"
												/>
											</Field>
											<Field id={`education-period-${index}`} label="Period">
												<Input
													id={`education-period-${index}`}
													value={entry.period ?? ""}
													onChange={(event) =>
														updateEducation(index, "period", event.target.value)
													}
													maxLength={PERIOD_MAX}
													placeholder="2018 – 2022"
												/>
											</Field>
										</div>
									</RuledGroup>
								))}
								<Button
									variant="outline"
									size="sm"
									disabled={education.length >= QUALIFICATIONS_MAX}
									title={
										education.length >= QUALIFICATIONS_MAX
											? `A profile holds up to ${QUALIFICATIONS_MAX} qualifications`
											: undefined
									}
									onClick={() =>
										setEducation((prev) => [
											...prev,
											{ school: "", qualification: "", period: "" },
										])
									}
									className="gap-1.5 font-semibold"
								>
									<Plus className="h-3.5 w-3.5" aria-hidden="true" />
									Add a qualification
								</Button>
							</div>

							{roundDirty && (
								<Notice
									note={{
										kind: "warn",
										text: "Unsaved edits are not read yet — save this plate and the round will use them.",
									}}
								/>
							)}
							<div className="overflow-hidden rounded-md border border-border bg-muted">
								<details className="group">
									<summary className="flex cursor-pointer items-center gap-2 px-3.5 py-2 text-[12.5px] font-semibold text-foreground">
										{/* the mark rotates with the state, as every other mark in this world does */}
										<span
											aria-hidden="true"
											className="inline-block transition-transform duration-150 group-open:rotate-90"
										>
											▸
										</span>
										What your next round reads
										{profile.roundSource.kind === "profile" && (
											<span className="num font-normal text-muted-foreground">
												({profile.roundSource.text.length.toLocaleString()} characters,
												saved state)
											</span>
										)}
									</summary>
									{profile.roundSource.kind === "profile" ? (
										<pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-border px-3.5 py-3 font-mono text-[12px] leading-relaxed text-foreground">
											{profile.roundSource.text}
										</pre>
									) : (
										<p className="border-t border-border px-3.5 py-3 text-[12px] text-muted-foreground">
											{profile.roundSource.kind === "resume"
												? `Nothing above is filled yet, so a round would be generated from the raw text of ${
														profile.resume.name ?? "your resume"
													} instead. A headline, two skills, or one role is enough to switch it to your own words.`
												: "No resume on record yet, so there is nothing to generate a practice round from."}
										</p>
									)}
								</details>
							</div>
						</Plate>

						<Plate
							id="headshot"
							title="Headshot"
							description="Kept with your record. Nothing in the product shows it to a recruiter today."
							status={status.headshot}
							action={
								<Button
									size="sm"
									onClick={() => void savePhoto()}
									disabled={!photoDraft || status.headshot.kind === "saving"}
									className="font-semibold"
								>
									Save
								</Button>
							}
						>
							{photoNote && <Notice note={photoNote} />}
							{status.headshot.kind === "error" && (
								<Notice note={{ kind: "error", text: status.headshot.message }} />
							)}
							{wantsCamera ? (
								<div className="space-y-2.5">
									<div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-md border border-border bg-sign-black">
										{cameraBusy && (
											<div className="absolute inset-0 z-10 flex items-center justify-center bg-sign-black/80">
												<RefreshCw
													className="h-5 w-5 animate-spin text-sign-white"
													aria-hidden="true"
												/>
											</div>
										)}
										<video
											ref={videoRef}
											autoPlay
											playsInline
											muted
											className={`h-full w-full object-cover ${
												cameraBusy ? "opacity-0" : ""
											}`}
										/>
									</div>
									<div className="flex gap-2">
										<Button
											size="sm"
											onClick={capturePhoto}
											disabled={cameraBusy}
											className="gap-2 font-semibold"
										>
											<Camera className="h-3.5 w-3.5" aria-hidden="true" />
											Capture
										</Button>
										<Button variant="ghost" size="sm" onClick={closeCamera}>
											Cancel
										</Button>
									</div>
								</div>
							) : headshotSrc ? (
								<div className="flex flex-wrap items-center gap-4">
									<img
										src={headshotSrc}
										alt="Your headshot"
										className="h-20 w-20 rounded-full border-2 border-sign-black object-cover"
									/>
									<div className="flex flex-wrap gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => setWantsCamera(true)}
											className="gap-2 font-semibold"
										>
											<Camera className="h-3.5 w-3.5" aria-hidden="true" />
											Take a new one
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => photoInputRef.current?.click()}
											className="gap-2 font-semibold"
										>
											<ImageUp className="h-3.5 w-3.5" aria-hidden="true" />
											Choose a file
										</Button>
										{profile.photo.present && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => void removeArtifact("photo")}
												className="gap-1.5 text-destructive"
											>
												<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
												Remove the photo
											</Button>
										)}
									</div>
								</div>
							) : (
								<div className="space-y-3 rounded-md border-2 border-dashed border-border p-5 text-center">
									<Camera
										className="mx-auto h-5 w-5 text-muted-foreground"
										aria-hidden="true"
									/>
									<div className="space-y-1">
										<p className="text-[13px] font-semibold text-foreground">
											No headshot on record
										</p>
										<p className="mx-auto max-w-md text-[12px] text-muted-foreground">
											Optional. Use the camera, or choose a PNG or JPEG already on this
											machine.
										</p>
									</div>
									<div className="flex flex-wrap justify-center gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => setWantsCamera(true)}
											className="gap-2 font-semibold"
										>
											<Camera className="h-3.5 w-3.5" aria-hidden="true" />
											Turn on the camera
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => photoInputRef.current?.click()}
											className="gap-2 font-semibold"
										>
											<ImageUp className="h-3.5 w-3.5" aria-hidden="true" />
											Choose a file
										</Button>
									</div>
								</div>
							)}
							<input
								ref={photoInputRef}
								type="file"
								accept="image/png,image/jpeg"
								className="hidden"
								onChange={(event) => {
									void onPhotoFile(event.target.files?.[0]);
									event.target.value = "";
								}}
							/>
						</Plate>

						<Plate
							id="voice"
							title="Voice sample"
							description="A microphone check for you. Spoken rounds are captured live; this sample is not scored."
							status={status.voice}
							action={
								<Button
									size="sm"
									onClick={() => void saveVoice()}
									disabled={!voiceDraft || status.voice.kind === "saving"}
									className="font-semibold"
								>
									Save
								</Button>
							}
						>
							{voiceNote && <Notice note={voiceNote} />}
							{status.voice.kind === "error" && (
								<Notice note={{ kind: "error", text: status.voice.message }} />
							)}
							{voiceDraft ? (
								<div className="space-y-2.5">
									<audio src={voiceDraft.url} controls className="h-9 w-full" />
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setVoiceDraft(null)}
										className="gap-1.5 text-destructive"
									>
										<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
										Discard this recording
									</Button>
								</div>
							) : recording ? (
								<div className="flex flex-wrap items-center gap-3">
									<Button
										variant="destructive"
										size="sm"
										onClick={stopRecording}
										className="gap-2 font-semibold"
									>
										Stop recording
									</Button>
									<span role="status" className="text-[12px] font-semibold text-destructive">
										Recording…
									</span>
								</div>
							) : (
								<div className="space-y-3">
									{storedMedia.voice ? (
										<audio src={storedMedia.voice} controls className="h-9 w-full" />
									) : (
										<p className="text-[12px] text-muted-foreground">
											{profile.voice.present
												? "The sample on record could not be loaded."
												: "No sample on record."}
										</p>
									)}
									<div className="rounded-md border border-border bg-muted px-3.5 py-2.5">
										<p className="type-sign-label text-muted-foreground">Read this aloud</p>
										<p className="text-[13px] italic leading-relaxed text-foreground">
											“I am recording this line to hear how my microphone sounds before a
											spoken round.”
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => void startRecording()}
											className="gap-2 font-semibold"
										>
											<Mic className="h-3.5 w-3.5" aria-hidden="true" />
											Record a sample
										</Button>
										{profile.voice.present && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => void removeArtifact("voice")}
												className="gap-1.5 text-destructive"
											>
												<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
												Remove the sample
											</Button>
										)}
									</div>
								</div>
							)}
						</Plate>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CandidateProfile;
