import { Menu, X, LogOut, LayoutDashboard, Settings, Building2, Users, Code2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { signOut } from "../lib/auth-client";
import { label } from "@/lib/labels";

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
      if (storedUser) {
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

  const handleLogout = async () => {
    await signOut().catch(() => {});
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

  /** True when a recruiter nav link should read as the lit destination */
  const isRecruiterActive = () =>
    isActive("/recruiter") || isActive("/recruiter/interviews/new") || location.pathname.startsWith("/recruiter/interviews/");

  const isRecruiter = user?.role === "recruiter";

  /** The lit plate: one destination reads as illuminated among dark ones */
  const activePlate = "bg-card text-foreground";
  const inactiveNavLink = "text-sign-white/75 hover:text-sign-white";

  return (
    <nav className="on-sign fixed top-0 w-full z-50 bg-sign-black h-14">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          {/* The name set in type is the only brand mark — there is no logo */}
          <div className="flex items-center">
            <button
              className="flex items-center rounded-md px-1.5 py-1 text-sign-white transition-colors hover:bg-white/10"
              onClick={() => navigate("/")}
              aria-label="Rehearse.io home"
            >
              <span className="type-monument text-lg tracking-[-0.01em]">
                Rehearse.io
              </span>
            </button>
          </div>

          {/* Desktop navigation — sentence case, as signage is */}
          {user && (
            <div className="hidden md:flex items-center gap-1 text-[13px] font-semibold">
              {isRecruiter ? (
                <>
                  <button onClick={() => navigate("/recruiter")}
                    className={`px-3 py-1.5 rounded-md transition-colors ${isRecruiterActive() ? activePlate : inactiveNavLink}`}>
                    <Building2 className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                    Recruiter
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => navigate("/dashboard")}
                    className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${isActive("/dashboard") ? activePlate : inactiveNavLink}`}>
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    My interviews
                  </button>
                  <button onClick={() => navigate("/rehearsal")}
                    className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${isActive("/rehearsal") ? activePlate : inactiveNavLink}`}>
                    <Users className="h-3.5 w-3.5" />
                    Practice
                  </button>
                  <button onClick={() => navigate("/practice/dsa")}
                    className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${isActive("/practice/dsa") ? activePlate : inactiveNavLink}`}>
                    <Code2 className="h-3.5 w-3.5" />
                    DSA
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
                  className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-white/10"
                  aria-label="User menu"
                  aria-expanded={showDropdown}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-card text-[11px] font-bold text-foreground select-none">
                    {getUserInitials()}
                  </div>
                </button>

                {showDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-52 rounded-md border border-border bg-popover p-1 z-20 text-foreground animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 py-2.5 border-b border-border mb-1">
                        <p className="text-[13px] font-semibold text-foreground truncate">{user.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        {user.role && (
                          <span className="mt-1 inline-block px-1.5 py-0.5 type-sign-label bg-sign-black text-sign-white rounded-sm">
                            {label(user.role)}
                          </span>
                        )}
                      </div>
                      <button onClick={() => { navigate(isRecruiter ? "/recruiter" : "/dashboard"); setShowDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-surface-active rounded-md flex items-center gap-2 transition-colors">
                        <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
                        {isRecruiter ? "Recruiter dashboard" : "My interviews"}
                      </button>
                      <button onClick={() => { navigate("/account"); setShowDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-surface-active rounded-md flex items-center gap-2 transition-colors">
                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                        Account settings
                      </button>
                      <div className="border-t border-border my-1" />
                      <button onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-[13px] text-destructive hover:bg-surface-active rounded-md flex items-center gap-2 transition-colors">
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
          <div className="md:hidden flex items-center text-sign-white">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sign-white hover:bg-white/10" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
              {isMenuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-14 left-0 w-full border-b-2 border-border bg-popover text-foreground px-4 py-4 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-col gap-1">
            {user ? (
              <>
                <div className="px-3 py-3 border-b border-border mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sign-black text-xs font-bold text-sign-white select-none">
                      {getUserInitials()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{user.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </div>
                <div className="text-[13px] font-semibold">
                  {isRecruiter ? (
                    <>
                      <button className={`text-left w-full px-3 py-2 rounded-md transition-colors ${isRecruiterActive() ? "bg-sign-black text-sign-white" : "text-foreground hover:bg-surface-active"}`}
                        onClick={() => { navigate("/recruiter"); setIsMenuOpen(false); }}>
                        <Building2 className="inline h-4 w-4 mr-2 -mt-0.5" />Recruiter dashboard
                      </button>
                    </>
                  ) : (
                    <>
                      <button className={`text-left w-full px-3 py-2 rounded-md transition-colors ${isActive("/dashboard") ? "bg-sign-black text-sign-white" : "text-foreground hover:bg-surface-active"}`}
                        onClick={() => { navigate("/dashboard"); setIsMenuOpen(false); }}>
                        <LayoutDashboard className="inline h-4 w-4 mr-2 -mt-0.5" />My interviews
                      </button>
                      <button className={`text-left w-full px-3 py-2 rounded-md transition-colors ${isActive("/rehearsal") ? "bg-sign-black text-sign-white" : "text-foreground hover:bg-surface-active"}`}
                        onClick={() => { navigate("/rehearsal"); setIsMenuOpen(false); }}>
                        <Users className="inline h-4 w-4 mr-2 -mt-0.5" />Practice
                      </button>
                      <button className={`text-left w-full px-3 py-2 rounded-md transition-colors ${isActive("/practice/dsa") ? "bg-sign-black text-sign-white" : "text-foreground hover:bg-surface-active"}`}
                        onClick={() => { navigate("/practice/dsa"); setIsMenuOpen(false); }}>
                        <Code2 className="inline h-4 w-4 mr-2 -mt-0.5" />DSA practice
                      </button>
                    </>
                  )}
                  <button className="text-left w-full px-3 py-2 rounded-md text-foreground hover:bg-surface-active transition-colors"
                    onClick={() => { navigate("/account"); setIsMenuOpen(false); }}>
                    <Settings className="inline h-4 w-4 mr-2 -mt-0.5" />Account settings
                  </button>
                </div>
                <div className="border-t border-border my-2" />
                <button onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[13px] text-destructive hover:bg-surface-active rounded-md flex items-center gap-2 font-semibold transition-colors">
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
              <button onClick={() => { navigate("/privacy"); setIsMenuOpen(false); }} className="hover:text-foreground underline-offset-4 hover:underline transition-colors">Privacy</button>
              <button onClick={() => { navigate("/terms"); setIsMenuOpen(false); }} className="hover:text-foreground underline-offset-4 hover:underline transition-colors">Terms</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
