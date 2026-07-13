import React, { useCallback } from "react";

export type CodeLanguage = "python" | "javascript" | "java" | "cpp";

const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
	python: "Python",
	javascript: "JavaScript",
	java: "Java",
	cpp: "C++",
};

interface CodeEditorProps {
	value: string;
	onChange: (value: string) => void;
	language: CodeLanguage;
	onLanguageChange?: (lang: CodeLanguage) => void;
	readOnly?: boolean;
	minHeight?: string;
	showLanguageSelect?: boolean;
	className?: string;
}

/**
 * Lightweight monospace code editor (no heavy Monaco dependency).
 * Supports tab indentation and basic keyboard affordances.
 */
const CodeEditor: React.FC<CodeEditorProps> = ({
	value,
	onChange,
	language,
	onLanguageChange,
	readOnly = false,
	minHeight = "320px",
	showLanguageSelect = true,
	className = "",
}) => {
	const resolvedMinHeight = minHeight === "100%" ? "280px" : minHeight;
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Tab") {
				e.preventDefault();
				const el = e.currentTarget;
				const start = el.selectionStart;
				const end = el.selectionEnd;
				const next = value.substring(0, start) + "    " + value.substring(end);
				onChange(next);
				// Restore caret after React re-render
				requestAnimationFrame(() => {
					el.selectionStart = el.selectionEnd = start + 4;
				});
			}
		},
		[value, onChange],
	);

	const lineCount = Math.max(1, value.split("\n").length);

	return (
		<div
			className={`border border-border rounded-[12px] overflow-hidden bg-[#0d0d0d] flex flex-col ${className}`}
		>
			{/* Toolbar */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/20">
				<div className="flex items-center gap-2">
					<span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
						Editor
					</span>
					<span className="text-[10px] text-muted-foreground/50">·</span>
					<span className="text-[10px] font-mono text-primary">
						{LANGUAGE_LABELS[language]}
					</span>
				</div>
				{showLanguageSelect && onLanguageChange && !readOnly && (
					<select
						value={language}
						onChange={(e) => onLanguageChange(e.target.value as CodeLanguage)}
						className="h-7 px-2 rounded-[6px] border border-border bg-background text-[11px] font-mono text-foreground focus:outline-none focus:border-primary/50"
						aria-label="Programming language"
					>
						{(Object.keys(LANGUAGE_LABELS) as CodeLanguage[]).map((lang) => (
							<option key={lang} value={lang}>
								{LANGUAGE_LABELS[lang]}
							</option>
						))}
					</select>
				)}
			</div>

			{/* Editor body */}
			<div className="flex flex-1 min-h-0 overflow-hidden">
				{/* Line numbers */}
				<div
					className="select-none py-3 px-2 text-right font-mono text-[11px] leading-5 text-muted-foreground/40 bg-[#0a0a0a] border-r border-border/50 overflow-hidden shrink-0"
					aria-hidden
					style={{ minHeight: resolvedMinHeight }}
				>
					{Array.from({ length: lineCount }, (_, i) => (
						<div key={i}>{i + 1}</div>
					))}
				</div>
				<textarea
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={handleKeyDown}
					readOnly={readOnly}
					spellCheck={false}
					autoCapitalize="off"
					autoCorrect="off"
					className="flex-1 w-full py-3 px-3 font-mono text-[12px] leading-5 text-[#e8e8e8] bg-transparent resize-none focus:outline-none caret-primary"
					style={{ minHeight: resolvedMinHeight, tabSize: 4 }}
					aria-label="Code editor"
				/>
			</div>
		</div>
	);
};

export default CodeEditor;
