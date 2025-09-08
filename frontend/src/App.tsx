import './App.css'
import Navbar from './components/Navbar'
import HeroSection from "./components/HeroSection";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Onboarding from "@/pages/Onboarding";
import SignUp from './pages/SignUp';
function App() {
  return (
    <>

      <Router>
        <Navbar />
        <Routes>
          <Route path='/' element={<HeroSection />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </Router>

    </>
  )
}

export default App
