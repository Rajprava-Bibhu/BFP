import { useAuth } from "@/hooks/use-auth";
import { StatCard } from "@/components/stat-card";
import { useGetAnalyticsOverview, useListProjects } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import {
  Building2, Users, DollarSign, Activity, Briefcase, CheckCircle2,
  Clock, CalendarX, TrendingUp, FileText, ShoppingCart, Target,
  ArrowRight, CircleUser, AlertCircle, Package, UserCheck, Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, Legend,
} from "recharts";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Link } from "wouter";

const COLORS = ["#4f46e5", "#10b981", "#f97316", "#f43f5e", "#06b6d4", "#7c3aed"];

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-base font-display font-bold text-slate-800 dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href}>
          <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary h-7 px-2">
            {action.label} <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</CardTitle>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const tooltipStyle = {
  contentStyle: { borderRadius: "12px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)", fontSize: "12px" },
  cursor: { fill: "rgba(0,0,0,0.03)" },
};

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
              {greeting()}, {user.firstName}! 👋
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {format(new Date(), "EEEE, MMMM d, yyyy")} — Here's your workspace overview.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-white/5 px-3 py-2 rounded-xl border border-border/50">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>All systems operational</span>
          </div>
        </div>
      </motion.div>

      {user.role === "super_admin" && <SuperAdminDashboard />}
      {user.role === "org_admin" && <OrgAdminDashboard />}
      {user.role === "department_head" && <DeptHeadDashboard />}
      {user.role === "employee" && <EmployeeDashboard userId={user.id} />}
    </div>
  );
}

function SuperAdminDashboard() {
  const { data: analytics, isLoading } = useGetAnalyticsOverview();
  const { data: auditData } = useQuery({
    queryKey: ["audit-recent"],
    queryFn: () => apiFetch<any[]>("/audit"),
  });

  const weeklyUserData = [
    { day: "Mon", users: 45 }, { day: "Tue", users: 52 }, { day: "Wed", users: 49 },
    { day: "Thu", users: 63 }, { day: "Fri", users: 58 }, { day: "Sat", users: 21 }, { day: "Sun", users: 18 },
  ];

  if (isLoading || !analytics) return <DashboardSkeleton cols={4} />;

  const sparkRevenue = analytics.revenueByMonth?.map((m: any) => m.revenue) || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard delay={0.05} title="Total Organizations" value={analytics.totalTenants} icon={<Building2 className="h-5 w-5" />} trend={{ value: 12, isPositive: true, label: "vs last month" }} accentColor="violet" sparkData={[3,4,4,5,5,6,6,7]} />
        <StatCard delay={0.1} title="Total Users" value={analytics.totalUsers} icon={<Users className="h-5 w-5" />} trend={{ value: 5, isPositive: true, label: "vs last month" }} accentColor="blue" sparkData={[80,85,90,88,95,100,analytics.totalUsers]} />
        <StatCard delay={0.15} title="Total Revenue" value={`₹${(analytics.totalRevenue || 0).toLocaleString("en-IN")}`} icon={<DollarSign className="h-5 w-5" />} trend={{ value: 8, isPositive: true, label: "vs last month" }} accentColor="emerald" sparkData={sparkRevenue.slice(-6)} />
        <StatCard delay={0.2} title="Active Projects" value={analytics.activeProjects} icon={<Briefcase className="h-5 w-5" />} trend={{ value: 3, isPositive: true, label: "new this week" }} accentColor="orange" sparkData={[10,12,11,14,13,15,analytics.activeProjects]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title="Revenue Growth" subtitle="Monthly revenue across all organizations">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.revenueByMonth}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip {...tooltipStyle} formatter={(v: any) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: "#4f46e5", strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <ChartCard title="Users by Role" subtitle="Distribution across roles">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.usersByRole} dataKey="count" nameKey="role" cx="50%" cy="45%" outerRadius={75} innerRadius={40} paddingAngle={3}>
                  {analytics.usersByRole?.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip {...tooltipStyle} />
                <Legend formatter={(v) => <span className="text-xs capitalize">{v?.toString().replace("_", " ")}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Daily Active Users" subtitle="This week's activity">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyUserData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <RechartsTooltip {...tooltipStyle} />
                <Bar dataKey="users" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(Array.isArray(auditData) ? auditData : []).slice(0, 5).map((e: any, i: number) => (
              <div key={e.id || i} className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    <span className="capitalize">{e.action?.replace("_", " ")}</span>
                    {e.resourceType && <span className="text-slate-400"> · {e.resourceType}</span>}
                  </p>
                  <p className="text-xs text-slate-400">{e.createdAt ? format(new Date(e.createdAt), "MMM d, h:mm a") : ""}</p>
                </div>
              </div>
            )) || (
              <p className="text-xs text-slate-400 text-center py-4">No recent activity</p>
            )}
            <Link href="/audit">
              <Button variant="ghost" size="sm" className="w-full text-xs text-primary mt-1 h-7">
                View all activity <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrgAdminDashboard() {
  const { data: analytics, isLoading } = useGetAnalyticsOverview();
  const { data: finData } = useQuery({
    queryKey: ["finance-summary"],
    queryFn: () => apiFetch<any>("/finance/summary"),
  });
  const { data: clientsData } = useQuery({
    queryKey: ["clients-recent"],
    queryFn: () => apiFetch<any[]>("/clients"),
  });
  const { data: auditData } = useQuery({
    queryKey: ["audit-recent-org"],
    queryFn: () => apiFetch<any[]>("/audit"),
  });

  const weeklyAttendance = [
    { day: "Mon", present: 42, late: 5, absent: 3 },
    { day: "Tue", present: 45, late: 3, absent: 2 },
    { day: "Wed", present: 40, late: 6, absent: 4 },
    { day: "Thu", present: 48, late: 2, absent: 0 },
    { day: "Fri", present: 44, late: 4, absent: 2 },
  ];

  if (isLoading || !analytics) return <DashboardSkeleton cols={4} />;

  const monthlyFinance = finData?.byMonth || [
    { month: "Jan", income: 45000, expense: 32000 },
    { month: "Feb", income: 52000, expense: 38000 },
    { month: "Mar", income: 48000, expense: 35000 },
    { month: "Apr", income: 61000, expense: 42000 },
    { month: "May", income: 58000, expense: 39000 },
    { month: "Jun", income: 67000, expense: 44000 },
  ];

  const projectStatusData = analytics.projectsByStatus?.map((p: any, i: number) => ({
    ...p, fill: COLORS[i % COLORS.length],
  })) || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard delay={0.05} title="Total Employees" value={analytics.totalUsers} icon={<Users className="h-5 w-5" />} trend={{ value: 3, isPositive: true, label: "this month" }} accentColor="blue" sparkData={[40,42,44,43,46,48,analytics.totalUsers]} />
        <StatCard delay={0.1} title="Attendance Rate" value={`${analytics.attendanceRate}%`} icon={<Activity className="h-5 w-5" />} trend={{ value: 2, isPositive: true, label: "vs last week" }} accentColor="emerald" sparkData={[85,87,86,89,88,90,analytics.attendanceRate]} badge={analytics.attendanceRate >= 90 ? "Excellent" : "Good"} />
        <StatCard delay={0.15} title="Active Projects" value={analytics.activeProjects} icon={<Briefcase className="h-5 w-5" />} trend={{ value: 1, isPositive: true, label: "new this week" }} accentColor="violet" sparkData={[8,9,10,10,11,12,analytics.activeProjects]} />
        <StatCard delay={0.2} title="Monthly Revenue" value={`₹${(finData?.totalIncome || 0).toLocaleString("en-IN")}`} icon={<DollarSign className="h-5 w-5" />} trend={{ value: 8, isPositive: true, label: "vs last month" }} accentColor="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title="Income vs Expenses" subtitle="Monthly financial performance">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyFinance}>
                  <defs>
                    <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip {...tooltipStyle} formatter={(v: any, n: string) => [`₹${v.toLocaleString("en-IN")}`, n === "income" ? "Income" : "Expenses"]} />
                  <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2.5} fill="url(#incGrad)" dot={false} />
                  <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2.5} fill="url(#expGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-1 justify-end text-xs">
              <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><span className="text-slate-500">Income</span></div>
              <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-rose-500" /><span className="text-slate-500">Expenses</span></div>
            </div>
          </ChartCard>
        </div>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={projectStatusData} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="count" cornerRadius={4} />
                  <Legend formatter={(v) => <span className="text-xs capitalize">{v?.replace("_", " ")}</span>} />
                  <RechartsTooltip {...tooltipStyle} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Weekly Attendance" subtitle="Present / Late / Absent breakdown">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyAttendance} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <RechartsTooltip {...tooltipStyle} />
                <Bar dataKey="present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Present" />
                <Bar dataKey="late" stackId="a" fill="#f97316" name="Late" />
                <Bar dataKey="absent" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-1 justify-end text-xs">
            {[["#10b981", "Present"], ["#f97316", "Late"], ["#f43f5e", "Absent"]].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} /><span className="text-slate-500">{l}</span></div>
            ))}
          </div>
        </ChartCard>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent Clients</CardTitle>
              <Link href="/clients">
                <Button variant="ghost" size="sm" className="text-xs text-primary h-7 px-2">View all <ArrowRight className="h-3 w-3 ml-1" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(Array.isArray(clientsData) ? clientsData : []).slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{c.name?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.company || c.email}</p>
                  </div>
                </div>
                <Badge className={`text-xs px-2 py-0 ${
                  c.status === "active" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                  c.status === "lead" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                  "bg-slate-100 text-slate-500"
                } border`}>{c.status}</Badge>
              </div>
            )) || <p className="text-xs text-slate-400 text-center py-4">No clients found</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { title: "Pending Invoices", value: "12", sub: "Due this week", icon: Receipt, color: "text-orange-500 bg-orange-500/10", href: "/bills" },
          { title: "Low Stock Items", value: "4", sub: "Need restocking", icon: Package, color: "text-rose-500 bg-rose-500/10", href: "/inventory" },
          { title: "Pending Documents", value: "7", sub: "Awaiting approval", icon: FileText, color: "text-blue-500 bg-blue-500/10", href: "/documents" },
        ].map((item, i) => (
          <Link key={i} href={item.href}>
            <Card className="rounded-2xl border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xl font-display font-bold text-slate-800 dark:text-white">{item.value}</p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.sub}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DeptHeadDashboard() {
  const { data: projects, isLoading } = useListProjects();
  const { data: auditData } = useQuery({
    queryKey: ["audit-recent-dept"],
    queryFn: () => apiFetch<any[]>("/audit"),
  });

  const teamAttendance = [
    { day: "Mon", present: 12, late: 2 },
    { day: "Tue", present: 13, late: 1 },
    { day: "Wed", present: 11, late: 3 },
    { day: "Thu", present: 14, late: 0 },
    { day: "Fri", present: 13, late: 1 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard delay={0.05} title="Team Members" value={14} icon={<Users className="h-5 w-5" />} accentColor="blue" sparkData={[12,13,13,14,14,14,14]} />
        <StatCard delay={0.1} title="Attendance Rate" value="91%" icon={<Activity className="h-5 w-5" />} trend={{ value: 3, isPositive: true }} accentColor="emerald" />
        <StatCard delay={0.15} title="Active Projects" value={projects?.filter((p: any) => p.status === "in_progress").length || 0} icon={<Briefcase className="h-5 w-5" />} accentColor="violet" />
        <StatCard delay={0.2} title="Tasks Complete" value="73%" icon={<CheckCircle2 className="h-5 w-5" />} trend={{ value: 5, isPositive: true }} accentColor="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Team Attendance This Week">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamAttendance} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <RechartsTooltip {...tooltipStyle} />
                <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} name="Present" />
                <Bar dataKey="late" fill="#f97316" radius={[4, 4, 0, 0]} name="Late" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project Progress</CardTitle>
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="text-xs text-primary h-7 px-2">View all <ArrowRight className="h-3 w-3 ml-1" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
            ) : (
              projects?.slice(0, 4).map((p: any) => (
                <div key={p.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate pr-2">{p.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-xs px-1.5 py-0 border ${
                        p.status === "in_progress" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                        p.status === "completed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                        "bg-slate-100 text-slate-500 border-slate-200"
                      }`}>{p.status?.replace("_", " ")}</Badge>
                      <span className="text-xs font-bold text-slate-600">{p.progress}%</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.progress}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className={`h-full rounded-full ${p.progress >= 80 ? "bg-emerald-500" : p.progress >= 50 ? "bg-primary" : "bg-orange-500"}`}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmployeeDashboard({ userId }: { userId: number }) {
  const { data: projects, isLoading } = useListProjects();

  const personalData = [
    { week: "W1", days: 5 }, { week: "W2", days: 4 }, { week: "W3", days: 5 },
    { week: "W4", days: 5 },
  ];

  const taskProgress = [
    { name: "Design Review", progress: 100, status: "done" },
    { name: "API Integration", progress: 65, status: "in_progress" },
    { name: "User Testing", progress: 30, status: "in_progress" },
    { name: "Documentation", progress: 10, status: "todo" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Present Days" value={18} description="This month" icon={<CheckCircle2 className="h-5 w-5" />} delay={0.05} accentColor="emerald" sparkData={personalData.map(d => d.days)} />
        <StatCard title="Late Check-ins" value={2} description="This month" icon={<Clock className="h-5 w-5" />} delay={0.1} accentColor="orange" />
        <StatCard title="Leave Balance" value={14} description="Days remaining" icon={<CalendarX className="h-5 w-5" />} delay={0.15} accentColor="blue" />
        <StatCard title="Tasks Done" value="8/12" description="This sprint" icon={<Target className="h-5 w-5" />} delay={0.2} accentColor="violet" trend={{ value: 2, isPositive: true, label: "vs last sprint" }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">My Projects</CardTitle>
              <Link href="/projects"><Button variant="ghost" size="sm" className="text-xs text-primary h-7 px-2">View all <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)
            ) : projects?.slice(0, 4).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/30 transition-colors">
                <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${p.status === "in_progress" ? "bg-blue-500" : p.status === "completed" ? "bg-emerald-500" : "bg-slate-300"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{p.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">My Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {taskProgress.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`h-4 w-4 rounded-full flex-shrink-0 flex items-center justify-center ${t.status === "done" ? "bg-emerald-500" : "border-2 border-slate-200"}`}>
                  {t.status === "done" && <CheckCircle2 className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-xs font-medium ${t.status === "done" ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-300"}`}>{t.name}</p>
                    <span className="text-xs text-slate-400">{t.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${t.status === "done" ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${t.progress}%` }} />
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Link href="/projects"><Button variant="ghost" size="sm" className="w-full text-xs text-primary h-7">View all tasks <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <ChartCard title="My Attendance — This Month" subtitle="Daily check-in record">
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={personalData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[0, 5]} />
              <RechartsTooltip {...tooltipStyle} formatter={(v: any) => [v, "Days Present"]} />
              <Bar dataKey="days" fill="#4f46e5" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}

function DashboardSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      <div className={`grid grid-cols-2 lg:grid-cols-${cols} gap-4`}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 dark:bg-white/5 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-[300px] bg-slate-100 dark:bg-white/5 rounded-2xl" />
        <div className="h-[300px] bg-slate-100 dark:bg-white/5 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-[260px] bg-slate-100 dark:bg-white/5 rounded-2xl" />
        <div className="h-[260px] bg-slate-100 dark:bg-white/5 rounded-2xl" />
      </div>
    </div>
  );
}
