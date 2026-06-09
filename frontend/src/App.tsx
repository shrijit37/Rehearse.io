import './App.css'
import Navbar from './components/Navbar'
import HeroSection from "./components/HeroSection";
import CookieConsent from "./components/CookieConsent";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Onboarding from "@/pages/Onboarding";
import SignUp from './pages/SignUp';
import RehearsalRoom from './pages/RehearsalRoom';
import Dashboard from './pages/Dashboard';
import RecruiterDashboard from './pages/RecruiterDashboard';
import InterviewSetup from './pages/InterviewSetup';
import CandidateInterview from './pages/CandidateInterview';
import CandidateResults from './pages/CandidateResults';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AccountSettings from './pages/AccountSettings';

function App() {
  return (
    <>
      <Router>
        <Navbar />
        <Routes>
          <Route path='/' element={<HeroSection />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/rehearsal" element={<RehearsalRoom />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Enterprise routes */}
          <Route path="/recruiter" element={<RecruiterDashboard />} />
          <Route path="/recruiter/interviews/new" element={<InterviewSetup />} />
          <Route path="/recruiter/interviews/:id" element={<CandidateResults />} />
          <Route path="/interview/accept/:token" element={<CandidateInterview />} />

          {/* Privacy & account */}
          <Route path="/account" element={<AccountSettings />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
        </Routes>
        <CookieConsent />
      </Router>
    </>
  )
}

export default App
