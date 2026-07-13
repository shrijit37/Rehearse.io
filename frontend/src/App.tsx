import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import CookieConsent from "./components/CookieConsent";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Onboarding from "@/pages/Onboarding";
import SignUp from "./pages/SignUp";
import RehearsalRoom from "./pages/RehearsalRoom";
import DsaPractice from "./pages/DsaPractice";
import Dashboard from "./pages/Dashboard";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import InterviewSetup from "./pages/InterviewSetup";
import CandidateInterview from "./pages/CandidateInterview";
import CandidateResults from "./pages/CandidateResults";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import AccountSettings from "./pages/AccountSettings";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

function App() {
	return (
		<>
			<Router>
				<Navbar />
				<Routes>
					<Route path="/" element={<HeroSection />} />
					<Route
						path="/onboarding"
						element={
							<ProtectedRoute>
								<Onboarding />
							</ProtectedRoute>
						}
					/>
					<Route path="/signup" element={<SignUp />} />
					<Route
						path="/rehearsal"
						element={
							<ProtectedRoute role="candidate" requireOnboarded>
								<RehearsalRoom />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/practice/dsa"
						element={
							<ProtectedRoute role="candidate" requireOnboarded>
								<DsaPractice />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/dashboard"
						element={
							<ProtectedRoute role="candidate" requireOnboarded>
								<Dashboard />
							</ProtectedRoute>
						}
					/>

					{/* Enterprise routes */}
					<Route
						path="/recruiter"
						element={
							<ProtectedRoute role="recruiter">
								<RecruiterDashboard />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/recruiter/interviews/new"
						element={
							<ProtectedRoute role="recruiter">
								<InterviewSetup />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/recruiter/interviews/:id"
						element={
							<ProtectedRoute role="recruiter">
								<CandidateResults />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/interview/accept/:token"
						element={<CandidateInterview />}
					/>

					{/* Privacy & account */}
					<Route
						path="/account"
						element={
							<ProtectedRoute>
								<AccountSettings />
							</ProtectedRoute>
						}
					/>
					<Route path="/privacy" element={<PrivacyPolicy />} />
					<Route path="/terms" element={<TermsOfService />} />

					{/* 404 catch-all */}
					<Route path="*" element={<NotFound />} />
				</Routes>
				<CookieConsent />
			</Router>
		</>
	);
}

export default App;
