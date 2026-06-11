import { Menu, X, LogOut, LayoutDashboard, Settings, Building2, Users } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "./ui/button";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      if (storedUser && storedToken) {
        try { setUser(JSON.parse(storedUser)); }
        catch { setUser(null); }
      } else { setUser(null); }
    };
    checkAuth();
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setShowDropdown(false);
    navigate("/");
  };

  const getUserInitials = () => {
    if (!user?.name) return "U";
    return user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  };

  const isActive = (path: string) => location.pathname === path;

  /** True when a recruiter nav link should be underlined */
  const isRecruiterActive = () =>
    isActive("/recruiter") || isActive("/recruiter/interviews/new") || location.pathname.startsWith("/recruiter/interviews/");

  const isRecruiter = user?.role === "recruiter";

  /** Verge-style mint inset underline for active nav items */
  const activeMintUnderline = "shadow-[0px_-1px_0px_0px_inset_#3cffd0] text-foreground";
  const inactiveNavLink = "text-muted-foreground hover:text-[#3860be]";

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-border bg-[#131313] h-14">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo — Display font (Anton substitute for Manuka) */}
          <div className="flex items-center">
            <button
              className="flex items-center gap-2 rounded-[4px] px-1.5 py-1 text-foreground hover:text-[#3860be] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => navigate("/")}
              aria-label="Rehearse.io home"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-primary">
                <rect x="2" y="3" width="20" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
                <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="font-display text-lg tracking-[1.07px]">Rehearse<span className="text-primary">.io</span></span>
            </button>
          </div>

          {/* Desktop Navigation — mono uppercase links */}
          {user && (
            <div className="hidden md:flex items-center gap-0.5 font-mono text-xs uppercase tracking-[1.5px]">
              {isRecruiter ? (
                <>
                  <button onClick={() => navigate("/recruiter")}
                    className={`px-3 py-1.5 rounded-[4px] transition-colors ${isRecruiterActive() ? activeMintUnderline : inactiveNavLink}`}>
                    <Building2 className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                    Recruiter
                  </button>
                  <button onClick={() => navigate("/dashboard")}
                    className={`px-3 py-1.5 rounded-[4px] transition-colors ${isActive("/dashboard") ? activeMintUnderline : inactiveNavLink}`}>
                    Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => navigate("/dashboard")}
                    className={`px-3 py-1.5 rounded-[4px] transition-colors flex items-center gap-1.5 ${isActive("/dashboard") ? activeMintUnderline : inactiveNavLink}`}>
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    My Interviews
                  </button>
                  <button onClick={() => navigate("/rehearsal")}
                    className={`px-3 py-1.5 rounded-[4px] transition-colors flex items-center gap-1.5 ${isActive("/rehearsal") ? activeMintUnderline : inactiveNavLink}`}>
                    <Users className="h-3.5 w-3.5" />
                    Practice
                  </button>
                </>
              )}
            </div>
          )}

          {/* Desktop CTA / Profile */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 rounded-full p-1 transition-colors hover:text-[#3860be] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="User menu"
                  aria-expanded={showDropdown}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground select-none">
                    {getUserInitials()}
                  </div>
                </button>

                {showDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-52 rounded-[20px] border border-border bg-popover p-1 z-20 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 py-2.5 border-b border-border mb-1">
                        <p className="text-[13px] font-semibold text-foreground truncate">{user.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        <span className="mt-1 inline-block px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-primary bg-primary/10 rounded-[4px]">
                          {user.role}
                        </span>
                      </div>
                      <button onClick={() => { navigate(isRecruiter ? "/recruiter" : "/dashboard"); setShowDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:text-[#3860be] rounded-[4px] flex items-center gap-2 transition-colors">
                        <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
                        {isRecruiter ? "Recruiter Dashboard" : "My Interviews"}
                      </button>
                      <button onClick={() => { navigate("/account"); setShowDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:text-[#3860be] rounded-[4px] flex items-center gap-2 transition-colors">
                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                        Account Settings
                      </button>
                      <div className="border-t border-border my-1" />
                      <button onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-[13px] text-destructive hover:text-destructive/80 rounded-[4px] flex items-center gap-2 transition-colors">
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate("/signup")}>
                  Sign in
                </Button>
                <Button size="pill" onClick={() => navigate("/signup")}>
                  Get started
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
              {isMenuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-14 left-0 w-full border-b border-border bg-popover px-4 py-4 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-col gap-1">
            {user ? (
              <>
                <div className="px-3 py-3 border-b border-border mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground select-none">
                      {getUserInitials()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{user.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </div>
                <div className="font-mono text-xs uppercase tracking-[1.5px]">
                  {isRecruiter ? (
                    <>
                      <button className={`text-left w-full px-3 py-2 rounded-[4px] transition-colors ${isRecruiterActive() ? activeMintUnderline : inactiveNavLink}`}
                        onClick={() => { navigate("/recruiter"); setIsMenuOpen(false); }}>
                        <Building2 className="inline h-4 w-4 mr-2 -mt-0.5" />Recruiter Dashboard
                      </button>
                      <button className={`text-left w-full px-3 py-2 rounded-[4px] transition-colors ${isActive("/dashboard") ? activeMintUnderline : inactiveNavLink}`}
                        onClick={() => { navigate("/dashboard"); setIsMenuOpen(false); }}>
                        Dashboard
                      </button>
                    </>
                  ) : (
                    <>
                      <button className={`text-left w-full px-3 py-2 rounded-[4px] transition-colors ${isActive("/dashboard") ? activeMintUnderline : inactiveNavLink}`}
                        onClick={() => { navigate("/dashboard"); setIsMenuOpen(false); }}>
                        <LayoutDashboard className="inline h-4 w-4 mr-2 -mt-0.5" />My Interviews
                      </button>
                      <button className={`text-left w-full px-3 py-2 rounded-[4px] transition-colors ${isActive("/rehearsal") ? activeMintUnderline : inactiveNavLink}`}
                        onClick={() => { navigate("/rehearsal"); setIsMenuOpen(false); }}>
                        <Users className="inline h-4 w-4 mr-2 -mt-0.5" />Practice
                      </button>
                    </>
                  )}
                  <button className="text-left w-full px-3 py-2 rounded-[4px] text-muted-foreground hover:text-[#3860be] transition-colors"
                    onClick={() => { navigate("/account"); setIsMenuOpen(false); }}>
                    <Settings className="inline h-4 w-4 mr-2 -mt-0.5" />Account Settings
                  </button>
                </div>
                <div className="border-t border-border my-2" />
                <button onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[13px] text-destructive hover:text-destructive/80 rounded-[4px] flex items-center gap-2 font-medium transition-colors">
                  <LogOut className="h-4 w-4" /><span>Sign out</span>
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Button variant="outline" className="w-full justify-center" onClick={() => { navigate("/signup"); setIsMenuOpen(false); }}>Sign in</Button>
                <Button className="w-full justify-center" onClick={() => { navigate("/signup"); setIsMenuOpen(false); }}>Get started</Button>
              </div>
            )}
            <div className="border-t border-border pt-3 mt-2 flex justify-center gap-5 text-[11px] text-muted-foreground">
              <button onClick={() => { navigate("/privacy"); setIsMenuOpen(false); }} className="hover:text-[#3860be] transition-colors">Privacy</button>
              <button onClick={() => { navigate("/terms"); setIsMenuOpen(false); }} className="hover:text-[#3860be] transition-colors">Terms</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
