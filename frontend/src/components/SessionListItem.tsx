import React from "react";
import { Calendar, ChevronRight } from "lucide-react";
import type { NormalizedSession } from "@/types";

interface SessionListItemProps {
	session: NormalizedSession;
	isSelected: boolean;
	onClick: () => void;
	showStatus?: boolean;
}

const SessionListItem: React.FC<SessionListItemProps> = ({
	session,
	isSelected,
	onClick,
	showStatus,
}) => {
	const statusColor =
		session.status === "completed"
			? "bg-success/10 text-success border-success/20"
			: session.status === "started"
				? "bg-warning/10 text-warning border-warning/20"
				: "bg-secondary text-muted-foreground border-border";

	return (
		<button
			onClick={onClick}
			className={`w-full text-left p-3.5 border rounded-[20px] transition-all flex items-center justify-between select-none ${
				isSelected
					? "bg-card border-primary/60 "
					: "bg-card border-border/60 hover:border-primary/30"
			}`}
		>
			<div className="space-y-1 min-w-0 pr-3">
				<p className="text-[13px] font-semibold text-foreground truncate">
					{session.title}
				</p>
				<div className="flex items-center gap-2">
					<span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/15 rounded">
						{session.targetRole}
					</span>
					{showStatus && session.status && (
						<span
							className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider border ${statusColor}`}
						>
							{session.status}
						</span>
					)}
				</div>
				<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
					<Calendar className="w-3 h-3" />
					<span>{session.dateStr}</span>
					{session.organization && (
						<>
							<span>·</span>
							<span>{session.organization}</span>
						</>
					)}
				</div>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				<div className="text-right">
					<p className="text-[9px] font-bold text-muted-foreground uppercase">
						Avg
					</p>
					<p className="text-sm font-bold text-foreground">
						{session.avg}
						<span className="text-[10px] text-muted-foreground">/10</span>
					</p>
				</div>
				<ChevronRight
					className={`h-3.5 w-3.5 transition-transform ${isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground/50"}`}
				/>
			</div>
		</button>
	);
};

export default SessionListItem;
