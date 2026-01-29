import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeSettings } from "@/components/ui/theme-settings";
import { GovernanceBadge } from "@/components/governance";
import { Database, Menu, X, Bot, ChevronDown, Settings2, Shield, LogOut, LayoutDashboard, Bell, Settings, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAIApprovalGate } from "@/components/ui/ai-approval-gate";
import { usePhiGate, PhiStatusBadge } from "@/components/ui/phi-gate";
import { AI_APPROVAL_MODE_LABELS, type AIApprovalMode } from "@/lib/governance";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useGovernanceMode } from "@/hooks/useGovernanceMode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ROSStatus {
  mode: string;
  status: string;
  mock_only: boolean;
  no_network: boolean;
  allow_uploads: boolean;
  backend_connected?: boolean;
}

const navLinks = [
  { label: "Features", href: "#features", testId: "link-nav-features" },
  { label: "Workflow", href: "#workflow", testId: "link-nav-workflow" },
  { label: "Compliance", href: "#compliance", testId: "link-nav-compliance" },
  { label: "Demo", href: "#demo", testId: "link-nav-demo" },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: rosStatus } = useQuery<ROSStatus>({
    queryKey: ["/api/ros/status"],
    refetchInterval: 30000
  });

  const { user, isLoading: isAuthLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { state: approvalState, setMode, getApprovalStats } = useAIApprovalGate();
  const aiApprovalStats = getApprovalStats();
  const { phiStatus, getPhiStats } = usePhiGate();
  const phiStats = getPhiStats();

  // Use authoritative governance mode from database for consistent display
  const { mode: governanceMode } = useGovernanceMode();

  const getUserDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    return user?.email || "User";
  };

  const getUserInitial = () => {
    if (user?.firstName) {
      return user.firstName.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`
      fixed top-0 left-0 right-0 z-50 transition-all duration-300
      ${isScrolled 
        ? 'bg-background/80 backdrop-blur-lg border-b border-border shadow-sm' 
        : 'bg-transparent'}
    `} data-testid="header-main">
      <div className="container mx-auto px-6 lg:px-24">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <a href="/" className="flex items-center gap-3" data-testid="link-logo">
            <div className="w-10 h-10 rounded-lg bg-ros-primary flex items-center justify-center">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl" data-testid="text-brand-name">ResearchFlow</span>
              <div className="hidden sm:inline-flex">
                <GovernanceBadge
                  mode={(governanceMode as 'DEMO' | 'LIVE' | 'OFFLINE') || 'DEMO'}
                  showTooltip
                  clickable
                />
              </div>
            </div>
          </a>

          {/* Only show marketing nav links when NOT authenticated */}
          {!isAuthenticated && (
            <nav className="hidden lg:flex items-center gap-8" data-testid="nav-desktop">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={link.testId}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 border border-border cursor-default"
                  data-testid="header-phi-status"
                >
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <PhiStatusBadge status={phiStatus} size="sm" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p>PHI Status: {phiStats.scans} scans, {phiStats.blocked} blocked, {phiStats.overrides} overrides</p>
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-ros-workflow/10 border border-ros-workflow/20 hover-elevate cursor-pointer"
                  data-testid="header-ai-counter"
                  title="AI Approval Settings"
                >
                  <Bot className="h-3.5 w-3.5 text-ros-workflow" />
                  <span className="text-xs font-medium">
                    <span className="text-muted-foreground">AI:</span>
                    {" "}
                    <span className="text-ros-success">{aiApprovalStats.approved}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-ros-workflow">{aiApprovalStats.pending}</span>
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64" data-testid="dropdown-ai-settings">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  AI Approval Mode
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['REQUIRE_EACH', 'APPROVE_PHASE', 'APPROVE_SESSION'] as AIApprovalMode[]).map((mode) => (
                  <DropdownMenuItem
                    key={mode}
                    onClick={() => setMode(mode)}
                    className={`cursor-pointer ${approvalState.mode === mode ? 'bg-ros-workflow/10' : ''}`}
                    data-testid={`menu-item-mode-${mode.toLowerCase().replace('_', '-')}`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className={`w-2 h-2 rounded-full ${approvalState.mode === mode ? 'bg-ros-workflow' : 'bg-muted'}`} />
                      <span className={approvalState.mode === mode ? 'font-medium' : ''}>
                        {AI_APPROVAL_MODE_LABELS[mode]}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  <span className="text-ros-success font-medium">{aiApprovalStats.approved}</span> approved,{" "}
                  <span className="text-ros-workflow font-medium">{aiApprovalStats.pending}</span> pending
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Notifications Bell */}
            {isAuthenticated && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative hidden md:inline-flex"
                    asChild
                  >
                    <Link href="/notifications">
                      <Bell className="h-4 w-4" />
                      <Badge 
                        className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center bg-ros-workflow text-white text-[10px]"
                      >
                        3
                      </Badge>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Notifications (3 new)</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            <ThemeSettings variant="compact" />
            {isAuthLoading ? (
              <div className="hidden sm:flex items-center gap-3">
                <Skeleton className="h-9 w-16 rounded-md" />
                <Skeleton className="h-9 w-24 rounded-md" />
              </div>
            ) : isAuthenticated ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="hidden sm:inline-flex gap-2 px-2"
                      data-testid="button-user-menu"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={user?.profileImageUrl || undefined} alt={getUserDisplayName()} />
                        <AvatarFallback className="text-xs bg-ros-primary text-white">
                          {getUserInitial()}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56" data-testid="dropdown-user-menu">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium" data-testid="text-user-email">
                          {getUserDisplayName()}
                        </p>
                        {user?.email && user.email !== getUserDisplayName() && (
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <a href="/pipeline" data-testid="link-dashboard">
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        My Dashboard
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <a href="/settings" data-testid="link-settings">
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <a href="/notifications" data-testid="link-notifications">
                        <Bell className="h-4 w-4 mr-2" />
                        Notifications
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          3
                        </Badge>
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => logout()}
                      disabled={isLoggingOut}
                      className="cursor-pointer text-destructive focus:text-destructive"
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {isLoggingOut ? "Logging out..." : "Log Out"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button 
                  className="bg-ros-primary hover:bg-ros-primary/90"
                  data-testid="button-get-started"
                  asChild
                >
                  <a href="/pipeline">Dashboard</a>
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  className="hidden sm:inline-flex"
                  data-testid="button-login"
                  asChild
                >
                  <Link href="/login">Log In</Link>
                </Button>
                <Button 
                  className="bg-ros-primary hover:bg-ros-primary/90"
                  data-testid="button-get-started"
                  asChild
                >
                  <Link href="/login">Get Started</Link>
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-background border-b border-border"
            data-testid="nav-mobile"
          >
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-2">
              {/* Only show marketing nav links when NOT authenticated */}
              {!isAuthenticated && navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                  data-testid={`${link.testId}-mobile`}
                >
                  {link.label}
                </a>
              ))}
              {isAuthenticated ? (
                <>
                  <a
                    href="/pipeline"
                    className="px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                    data-testid="link-dashboard-mobile"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    My Dashboard
                  </a>
                  <Button 
                    variant="ghost" 
                    className="justify-start px-4 text-destructive hover:text-destructive sm:hidden"
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                    disabled={isLoggingOut}
                    data-testid="button-logout-mobile"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {isLoggingOut ? "Logging out..." : "Log Out"}
                  </Button>
                </>
              ) : (
                <Button 
                  variant="ghost" 
                  className="justify-start px-4 sm:hidden"
                  data-testid="button-login-mobile"
                  asChild
                >
                  <Link href="/login">Log In</Link>
                </Button>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
