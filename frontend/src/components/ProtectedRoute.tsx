import { Navigate } from "react-router-dom";

export function ProtectedRoute({
	children,
	requireOnboarded = false,
}: {
	children: React.ReactNode;
	requireOnboarded?: boolean;
}) {
	let user = null;
	try {
		user = JSON.parse(localStorage.getItem("user") || "null");
	} catch {
		localStorage.removeItem("user");
		localStorage.removeItem("token");
	}
	if (!user) return <Navigate to="/signup" replace />;
	if (requireOnboarded && !user.onboarded)
		return <Navigate to="/onboarding" replace />;
	return <>{children}</>;
}
