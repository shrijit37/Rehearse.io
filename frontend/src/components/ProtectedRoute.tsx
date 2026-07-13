import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "@/types";

export function ProtectedRoute({
	children,
	requireOnboarded = false,
	role,
}: {
	children: ReactNode;
	requireOnboarded?: boolean;
	/** Restrict the route to a specific user role. */
	role?: "recruiter" | "candidate";
}) {
	let user: User | null = null;
	try {
		user = JSON.parse(localStorage.getItem("user") || "null");
	} catch {
		localStorage.removeItem("user");
		localStorage.removeItem("token");
	}
	if (!user) return <Navigate to="/signup" replace />;

	// Role mismatch → send users to their own home area.
	if (role && user.role !== role) {
		return (
			<Navigate to={user.role === "recruiter" ? "/recruiter" : "/dashboard"} replace />
		);
	}

	// Onboarding is only meaningful for candidates.
	if (requireOnboarded && user.role !== "recruiter" && !user.onboarded)
		return <Navigate to="/onboarding" replace />;
	return <>{children}</>;
}
