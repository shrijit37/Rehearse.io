import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const InterviewSetup: React.FC = () => {
	const navigate = useNavigate();
	const [title, setTitle] = useState("");
	const [targetRole, setTargetRole] = useState("");
	const [description, setDescription] = useState("");
	const [questions, setQuestions] = useState<string[]>([""]);
	const [expiresAt, setExpiresAt] = useState("");
	const [organizations, setOrganizations] = useState<any[]>([]);
	const [selectedOrgId, setSelectedOrgId] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api
			.get<{ data: any[]; total: number }>("/api/org")
			.then((data) => {
				setOrganizations(data.data || []);
				if (data.data?.length > 0) setSelectedOrgId(data.data[0]._id);
			})
			.catch(() => {});
	}, [navigate]);

	const addQuestion = () => setQuestions([...questions, ""]);
	const removeQuestion = (idx: number) => {
		if (questions.length <= 1) return;
		setQuestions(questions.filter((_, i) => i !== idx));
	};
	const updateQuestion = (idx: number, value: string) => {
		const updated = [...questions];
		updated[idx] = value;
		setQuestions(updated);
	};

	const handleSubmit = async () => {
		if (!title || !targetRole || !selectedOrgId || !expiresAt) {
			setError(
				"Please fill in title, role, organization, and expiration date.",
			);
			return;
		}
		const validQuestions = questions.filter((q) => q.trim());
		if (validQuestions.length === 0) {
			setError("Add at least one question.");
			return;
		}

		setIsSubmitting(true);
		setError(null);
		try {
			await api.post("/api/interviews", {
				title,
				targetRole,
				description,
				questions: validQuestions,
				expiresAt,
				organizationId: selectedOrgId,
				status: "active",
			});
			navigate("/recruiter");
		} catch (err: any) {
			setError(err.message || "An error occurred");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 mt-14">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Back + header */}
				<div className="flex items-center gap-4">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate(-1)}
						className="text-muted-foreground font-medium gap-1.5"
					>
						<ArrowLeft className="h-3.5 w-3.5" /> Back
					</Button>
					<div>
						<h1 className="text-xl font-bold tracking-[-0.02em] text-foreground">
							Create Interview Session
						</h1>
						<p className="text-[13px] text-muted-foreground">
							Set up a structured first-round interview.
						</p>
					</div>
				</div>

				{/* Form card */}
				<div className="border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-5">
					{error && (
						<div className="bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-lg border border-destructive/20 text-center">
							{error}
						</div>
					)}

					<div className="space-y-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Organization
						</Label>
						<select
							value={selectedOrgId}
							onChange={(e) => setSelectedOrgId(e.target.value)}
							className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] focus:border-primary/50 focus:outline-none"
						>
							{organizations.length === 0 && (
								<option value="">No organizations found</option>
							)}
							{organizations.map((org) => (
								<option key={org._id} value={org._id}>
									{org.name}
								</option>
							))}
						</select>
					</div>

					<div className="space-y-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Interview Title
						</Label>
						<Input
							placeholder="e.g., Senior Frontend Engineer — Round 1"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							maxLength={300}
							className="text-[13px]"
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Target Role
						</Label>
						<Input
							placeholder="e.g., Senior Software Engineer"
							value={targetRole}
							onChange={(e) => setTargetRole(e.target.value)}
							className="text-[13px]"
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Description (optional)
						</Label>
						<Input
							placeholder="Brief description of the interview purpose"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							maxLength={2000}
							className="text-[13px]"
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Expires At
						</Label>
						<Input
							type="datetime-local"
							value={expiresAt}
							onChange={(e) => setExpiresAt(e.target.value)}
							className="text-[13px]"
						/>
					</div>

					{/* Questions */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Questions
							</Label>
							<Button
								variant="ghost"
								size="sm"
								onClick={addQuestion}
								className="text-primary font-medium h-7 text-[12px] gap-1"
							>
								<Plus className="h-3 w-3" /> Add
							</Button>
						</div>
						<div className="space-y-2">
							{questions.map((q, idx) => (
								<div key={idx} className="flex items-start gap-2">
									<span className="text-[12px] font-bold text-muted-foreground mt-2 w-5 text-right shrink-0">
										{idx + 1}.
									</span>
									<Input
										placeholder={`Question ${idx + 1}`}
										value={q}
										onChange={(e) => updateQuestion(idx, e.target.value)}
										className="flex-1 text-[13px]"
									/>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => removeQuestion(idx)}
										className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
										disabled={questions.length <= 1}
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							))}
						</div>
					</div>

					{/* Actions */}
					<div className="flex gap-3 pt-4 border-t border-border/60">
						<Button
							onClick={handleSubmit}
							disabled={isSubmitting}
							className="font-semibold px-6 gap-2"
						>
							{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
							{isSubmitting ? "Creating..." : "Create Interview"}
						</Button>
						<Button
							variant="ghost"
							onClick={() => navigate(-1)}
							className="font-medium"
						>
							Cancel
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default InterviewSetup;
