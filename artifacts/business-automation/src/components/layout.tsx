import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Building2, Users, Network, CalendarCheck, Briefcase,
  CreditCard, Megaphone, BarChart3, LogOut, Menu, ChevronDown, UserCheck,
  FileText, Package, DollarSign, CalendarDays, Share2, ShieldCheck, Receipt,
  ClipboardList, UserCircle, KeyRound, Settings, Bell, Search, X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Badge } from "./ui/badge";

interface LayoutProps { children: ReactNode; }
interface NavItem { name: string; href: string; icon: any; roles: string[]; badge?: string; }
interface NavGroup { label: string; items: NavItem[]; }

// Role pill colors
const roleStyles: Record<string, string> = {
  super_admin:    "bg-violet-500/20 text-violet-200",
  org_admin:      "bg-blue-500/20 text-blue-200",
  department_head:"bg-teal-500/20 text-teal-200",
  employee:       "bg-slate-500/20 text-slate-300",
};
const roleLabel: Record<string, string> = {
  super_admin: "Super Admin",
  org_admin: "Org Admin",
  department_head: "Dept Head",
  employee: "Employee",
};

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  if (!user) return <>{children}</>;

  const navGroups: NavGroup[] = [
    {
      label: "Overview",
      items: [
        { name: "Dashboard",  href: "/",         icon: LayoutDashboard, roles: ["super_admin","org_admin","department_head","employee"] },
        { name: "Analytics",  href: "/analytics", icon: BarChart3,       roles: ["super_admin","org_admin","department_head"] },
      ],
    },
    {
      label: "HR & People",
      items: [
        { name: "Organizations", href: "/organizations", icon: Building2,    roles: ["super_admin"] },
        { name: "Users",         href: "/users",         icon: Users,        roles: ["super_admin","org_admin","department_head"] },
        { name: "Departments",   href: "/departments",   icon: Network,      roles: ["super_admin","org_admin"] },
        { name: "Attendance",    href: "/attendance",    icon: CalendarCheck,roles: ["super_admin","org_admin","department_head","employee"] },
      ],
    },
    {
      label: "Work",
      items: [
        { name: "Projects",   href: "/projects",   icon: Briefcase,    roles: ["super_admin","org_admin","department_head","employee"] },
        { name: "Calendar",   href: "/calendar",   icon: CalendarDays, roles: ["super_admin","org_admin","department_head","employee"] },
        { name: "Documents",  href: "/documents",  icon: FileText,     roles: ["super_admin","org_admin","department_head","employee"] },
      ],
    },
    {
      label: "Business",
      items: [
        { name: "Clients",        href: "/clients",   icon: UserCheck, roles: ["super_admin","org_admin","department_head"] },
        { name: "Bills & Invoices",href: "/bills",    icon: Receipt,   roles: ["super_admin","org_admin"] },
        { name: "Finance",        href: "/finance",   icon: DollarSign,roles: ["super_admin","org_admin"] },
        { name: "Inventory",      href: "/inventory", icon: Package,   roles: ["super_admin","org_admin","department_head"] },
      ],
    },
    {
      label: "Marketing",
      items: [
        { name: "Campaigns",        href: "/marketing",        icon: Megaphone, roles: ["super_admin","org_admin"] },
        { name: "Digital Marketing",href: "/digital-marketing",icon: Share2,    roles: ["super_admin","org_admin"] },
      ],
    },
    {
      label: "Platform",
      items: [
        { name: "Billing",    href: "/billing",   icon: CreditCard,   roles: ["super_admin","org_admin"] },
        { name: "Reports",    href: "/reports",   icon: ClipboardList,roles: ["super_admin","org_admin","department_head"] },
        { name: "Audit Log",  href: "/audit",     icon: ShieldCheck,  roles: ["super_admin","org_admin"] },
        { name: "Settings",   href: "/settings",  icon: Settings,     roles: ["super_admin","org_admin","department_head","employee"] },
      ],
    },
  ];

  const toggleGroup = (label: string) =>
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* ── Logo ─────────────────────────────────────────────── */}
      <div className="flex h-[64px] shrink-0 items-center px-4 gap-3 border-b border-white/[0.07]">
        <div className="bg-white rounded-xl px-2 py-1 shadow-md flex items-center justify-center shrink-0">
          <img src="/bfp-logo.png" alt="BFP Logo" className="h-10 w-auto object-contain" />
        </div>
        <div>
          <span className="text-[13px] font-display font-bold text-white tracking-tight leading-none">BUSINESS FLOW PRO</span>
          <p className="text-white/30 tracking-wider uppercase mt-0.5 text-[7px]">Business Automation Process</p>
        </div>
      </div>

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(item => item.roles.includes(user.role));
          if (visibleItems.length === 0) return null;
          const isCollapsed = collapsedGroups[group.label];
          return (
            <div key={group.label}>
              {/* Section label */}
              <button
                className="flex items-center justify-between w-full px-2 mb-1.5 group"
                onClick={() => toggleGroup(group.label)}
              >
                <span className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-white/30 group-hover:text-white/50 transition-colors">
                  {group.label}
                </span>
                <span className={`text-white/20 group-hover:text-white/40 transition-all ${isCollapsed ? "" : "rotate-90"}`}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                    className="overflow-hidden space-y-0.5"
                  >
                    {visibleItems.map((item) => {
                      const isActive = location === item.href ||
                        (item.href !== "/" && location.startsWith(item.href));
                      return (
                        <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                          <span className={`
                            group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium
                            transition-all duration-150 cursor-pointer select-none
                            ${isActive
                              ? "bg-primary text-white"
                              : "text-white/60 hover:bg-white/[0.07] hover:text-white"
                            }
                          `}
                          style={isActive ? { boxShadow: "0 4px 12px hsl(244 75% 59% / 0.35)" } : undefined}
                          >
                            {/* Active left-bar indicator */}
                            {isActive && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-white/70" />
                            )}
                            <item.icon className={`h-[16px] w-[16px] shrink-0 transition-colors ${isActive ? "text-white" : "text-white/40 group-hover:text-white/80"}`} />
                            <span className="flex-1 leading-none">{item.name}</span>
                            {item.badge && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/15 text-white/80">
                                {item.badge}
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* ── User Card ─────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-3 border-t border-white/[0.07]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.07] transition-colors group">
              <Avatar className="h-8 w-8 shrink-0 ring-2 ring-white/10">
                <AvatarImage src={user.avatar || ""} />
                <AvatarFallback className="bg-primary/80 text-white text-xs font-bold">
                  {user.firstName[0]}{user.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-semibold text-white truncate leading-tight">
                  {user.firstName} {user.lastName}
                </p>
                <p className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 mt-0.5 w-fit ${roleStyles[user.role] ?? "bg-white/10 text-white/50"}`}>
                  {roleLabel[user.role] ?? user.role}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-white/30 group-hover:text-white/50 transition-colors shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52 rounded-xl mb-1">
            <DropdownMenuLabel className="font-normal py-2">
              <p className="text-sm font-semibold">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Link href="/profile">
              <DropdownMenuItem className="cursor-pointer rounded-lg">
                <UserCircle className="mr-2 h-4 w-4" /> My Profile
              </DropdownMenuItem>
            </Link>
            <Link href="/settings">
              <DropdownMenuItem className="cursor-pointer rounded-lg">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <motion.aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[260px] bg-[#292e4e] flex flex-col
          lg:translate-x-0 lg:static lg:shrink-0
          transition-transform duration-300 ease-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{ boxShadow: "4px 0 24px 0 rgb(41 46 78 / 0.2)" }}
      >
        <SidebarContent />
      </motion.aside>

      {/* ── Main Area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top Header ──────────────────────────────────── */}
        <header className="h-[64px] shrink-0 flex items-center justify-between px-5 lg:px-7 bg-white border-b border-border sticky top-0 z-30"
          style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 2px 8px 0 rgb(0 0 0 / 0.04)" }}>

          {/* Mobile: hamburger + brand */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <span className="font-display font-bold text-[14px] text-foreground">BUSINESS FLOW PRO</span>
          </div>

          {/* Desktop: breadcrumb / page context */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {navGroups.flatMap(g => g.items).find(i => i.href === location || (i.href !== "/" && location.startsWith(i.href)))?.name ?? "Dashboard"}
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button className="relative h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
              <Bell className="h-4.5 w-4.5 text-muted-foreground" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
            </button>

            {/* User dropdown (desktop) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 h-9 pl-2 pr-3 rounded-xl hover:bg-muted transition-colors">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user.avatar || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {user.firstName[0]}{user.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium text-foreground leading-none">{user.firstName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl mt-1">
                <DropdownMenuLabel className="font-normal py-2">
                  <p className="text-sm font-semibold">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/profile">
                  <DropdownMenuItem className="cursor-pointer rounded-lg">
                    <UserCircle className="mr-2 h-4 w-4" /> My Profile
                  </DropdownMenuItem>
                </Link>
                <Link href="/profile">
                  <DropdownMenuItem className="cursor-pointer rounded-lg">
                    <KeyRound className="mr-2 h-4 w-4" /> Change Password
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 cursor-pointer rounded-lg">
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ── Page Content ────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mx-auto max-w-7xl p-5 sm:p-6 lg:p-8 h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
