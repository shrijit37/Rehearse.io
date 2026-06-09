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
  const isRecruiter = user?.role === "recruiter";

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-border/60 bg-background/90 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 h-14">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <div className="flex items-center">
            <button
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => navigate("/")}
              aria-label="Rehearse.io home"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-primary">
                <rect x="2" y="3" width="20" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
                <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-[15px] font-bold tracking-tight">Rehearse<span className="text-primary">.io</span></span>
            </button>
          </div>

          {/* Desktop Navigation */}
          {user && (
            <div className="hidden md:flex items-center gap-0.5 text-[13px] font-medium">
              {isRecruiter ? (
                <>
                  <button onClick={() => navigate("/recruiter")}
                    className={`px-3 py-1.5 rounded-md transition-colors ${isActive("/recruiter") || isActive("/recruiter/interviews/new") || location.pathname.startsWith("/recruiter/interviews/") ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"}`}>
                    <Building2 className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                    Recruiter
                  </button>
                  <button onClick={() => navigate("/dashboard")}
                    className={`px-3 py-1.5 rounded-md transition-colors ${isActive("/dashboard") ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"}`}>
                    Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => navigate("/dashboard")}
                    className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${isActive("/dashboard") ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"}`}>
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    My Interviews
                  </button>
                  <button onClick={() => navigate("/rehearsal")}
                    className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${isActive("/rehearsal") ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"}`}>
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
                  className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                    <div className="absolute right-0 mt-2 w-52 rounded-lg border border-border/80 bg-popover p-1 shadow-lg z-20 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 py-2.5 border-b border-border/60 mb-1">
                        <p className="text-[13px] font-semibold text-foreground truncate">{user.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        <span className="mt-1 inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded">
                          {user.role}
                        </span>
                      </div>
                      <button onClick={() => { navigate(isRecruiter ? "/recruiter" : "/dashboard"); setShowDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-secondary rounded-md flex items-center gap-2 transition-colors">
                        <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
                        {isRecruiter ? "Recruiter Dashboard" : "My Interviews"}
                      </button>
                      <button onClick={() => { navigate("/account"); setShowDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-secondary rounded-md flex items-center gap-2 transition-colors">
                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                        Account Settings
                      </button>
                      <div className="border-t border-border/60 my-1" />
                      <button onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-[13px] text-destructive hover:bg-destructive/10 rounded-md flex items-center gap-2 transition-colors">
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/signup")} className="font-medium text-[13px]">
                  Sign in
                </Button>
                <Button size="sm" onClick={() => navigate("/signup")} className="font-medium text-[13px]">
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
        <div className="md:hidden absolute top-14 left-0 w-full border-b border-border bg-popover px-4 py-4 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-col gap-1">
            {user ? (
              <>
                <div className="px-3 py-3 border-b border-border/60 mb-2">
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
                {isRecruiter ? (
                  <>
                    <button className={`text-left text-[13px] font-medium px-3 py-2 rounded-md transition-colors ${isActive("/recruiter") ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => { navigate("/recruiter"); setIsMenuOpen(false); }}>
                      <Building2 className="inline h-4 w-4 mr-2 -mt-0.5" />Recruiter Dashboard
                    </button>
                    <button className={`text-left text-[13px] font-medium px-3 py-2 rounded-md transition-colors ${isActive("/dashboard") ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => { navigate("/dashboard"); setIsMenuOpen(false); }}>
                      Dashboard
                    </button>
                  </>
                ) : (
                  <>
                    <button className={`text-left text-[13px] font-medium px-3 py-2 rounded-md transition-colors ${isActive("/dashboard") ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => { navigate("/dashboard"); setIsMenuOpen(false); }}>
                      <LayoutDashboard className="inline h-4 w-4 mr-2 -mt-0.5" />My Interviews
                    </button>
                    <button className={`text-left text-[13px] font-medium px-3 py-2 rounded-md transition-colors ${isActive("/rehearsal") ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => { navigate("/rehearsal"); setIsMenuOpen(false); }}>
                      <Users className="inline h-4 w-4 mr-2 -mt-0.5" />Practice
                    </button>
                  </>
                )}
                <button className="text-left text-[13px] font-medium px-3 py-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { navigate("/account"); setIsMenuOpen(false); }}>
                  <Settings className="inline h-4 w-4 mr-2 -mt-0.5" />Account Settings
                </button>
                <div className="border-t border-border/60 my-2" />
                <button onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[13px] text-destructive hover:bg-destructive/10 rounded-md flex items-center gap-2 font-medium transition-colors">
                  <LogOut className="h-4 w-4" /><span>Sign out</span>
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Button variant="outline" className="w-full justify-center font-medium" onClick={() => { navigate("/signup"); setIsMenuOpen(false); }}>Sign in</Button>
                <Button className="w-full justify-center font-medium" onClick={() => { navigate("/signup"); setIsMenuOpen(false); }}>Get started</Button>
              </div>
            )}
            <div className="border-t border-border/60 pt-3 mt-2 flex justify-center gap-5 text-[11px] text-muted-foreground">
              <button onClick={() => { navigate("/privacy"); setIsMenuOpen(false); }} className="hover:text-foreground transition-colors">Privacy</button>
              <button onClick={() => { navigate("/terms"); setIsMenuOpen(false); }} className="hover:text-foreground transition-colors">Terms</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
