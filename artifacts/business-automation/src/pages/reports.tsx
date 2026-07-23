import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Download, FileText, TrendingUp, TrendingDown, Users, ShieldCheck,
  BarChart3, Clock, CheckCircle2, AlertTriangle, Briefcase, Building2,
  Calendar, DollarSign, Activity, RefreshCw, FileSpreadsheet, Printer
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ─── Types ──────────────────────────────────────────────────────────────────
type Dept = { id: number; name: string };

type AttendanceReport = {
  summary: { total: number; present: number; absent: number; late: number; leave: number; avgHours: number; attendanceRate: number };
  byDepartment: { name: string; present: number; absent: number; total: number }[];
  rows: { id: number; date: string; status: string; checkIn: string | null; checkOut: string | null; hoursWorked: string; employeeName: string; departmentName: string | null }[];
};

type ProjectReport = {
  summary: { total: number; byStatus: Record<string, number>; totalBudget: string; avgProgress: number };
  rows: { id: number; name: string; status: string; priority: string; progress: number; startDate: string | null; endDate: string | null; budget: string | null; managerName: string; departmentName: string | null; tasks: { total: number; done: number } }[];
};

type FinancialReport = {
  summary: { total: number; totalIncome: string; totalExpense: string; netBalance: string; byCategory: Record<string, number>; byType: Record<string, number> };
  rows: { id: number; type: string; category: string; status: string; amount: string; currency: string; description: string; transactionDate: string; referenceNumber: string; submitterName: string }[];
};

type DeptReport = {
  summary: { totalDepartments: number; totalEmployees: number; overallAttendanceRate: number; totalProjects: number };
  rows: { id: number; name: string; headName: string; employeeCount: number; totalAttendance: number; presentCount: number; attendanceRate: number; totalProjects: number; completedProjects: number; avgProgress: number }[];
};

type AuditReport = {
  summary: { total: number; byAction: Record<string, number>; byResource: Record<string, number>; byUser: Record<string, number> };
  rows: { id: number; action: string; resourceType: string; description: string; ipAddress: string | null; createdAt: string; userName: string }[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCur(n: string | number) {
  return `₹${parseFloat(String(n || "0")).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}
function fmtPct(n: number) { return `${n}%`; }

const statusColors: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-amber-100 text-amber-700",
  leave: "bg-blue-100 text-blue-700",
  half_day: "bg-orange-100 text-orange-700",
  planning: "bg-slate-100 text-slate-700",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
  income: "bg-emerald-100 text-emerald-700",
  expense: "bg-red-100 text-red-700",
  transfer: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  const cls = statusColors[status] ?? "bg-slate-100 text-slate-600";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

// ─── Export Utilities ────────────────────────────────────────────────────────
function exportExcel(sheetName: string, headers: string[], rows: string[][]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${sheetName.toLowerCase().replace(/\s+/g, "-")}-report.xlsx`);
}

function exportPDF(title: string, headers: string[], rows: string[][], orientation: "p" | "l" = "l") {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 26);
  doc.setTextColor(0);
  autoTable(doc, {
    startY: 32,
    head: [headers],
    body: rows,
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 255] },
    margin: { left: 14, right: 14 },
  });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

// ─── Date Filter Bar ──────────────────────────────────────────────────────────
interface FilterBarProps {
  from: string; to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  extra?: React.ReactNode;
  onExportPDF: () => void;
  onExportExcel: () => void;
  loading?: boolean;
}
function FilterBar({ from, to, onFromChange, onToChange, extra, onExportPDF, onExportExcel, loading }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-end justify-between pb-1">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
          <Input type="date" value={from} onChange={e => onFromChange(e.target.value)} className="rounded-xl h-9 w-40" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
          <Input type="date" value={to} onChange={e => onToChange(e.target.value)} className="rounded-xl h-9 w-40" />
        </div>
        {extra}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-9" onClick={onExportExcel} disabled={loading}>
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-9" onClick={onExportPDF} disabled={loading}>
          <FileText className="h-3.5 w-3.5 text-red-500" /> PDF
        </Button>
      </div>
    </div>
  );
}

// ─── Summary Stat Card ───────────────────────────────────────────────────────
function StatCard({ label, value, sub, Icon, color }: { label: string; value: string | number; sub?: string; Icon: any; color: string }) {
  return (
    <Card className="rounded-2xl border-0 shadow-sm">
      <CardContent className="p-4">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Attendance Report Tab ────────────────────────────────────────────────────
function AttendanceTab({ depts }: { depts: Dept[] }) {
  const { toast } = useToast();
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [deptId, setDeptId] = useState("all");

  const params = new URLSearchParams({ ...(from && { from }), ...(to && { to }), ...(deptId !== "all" && { departmentId: deptId }) });
  const { data, isLoading } = useQuery<AttendanceReport>({
    queryKey: ["report-attendance", from, to, deptId],
    queryFn: () => apiFetch(`/reports/attendance?${params}`),
  });

  const headers = ["Date", "Employee", "Department", "Status", "Check In", "Check Out", "Hours"];
  const rows = (data?.rows ?? []).map(r => [r.date, r.employeeName, r.departmentName ?? "—", r.status, r.checkIn ?? "—", r.checkOut ?? "—", r.hoursWorked]);

  return (
    <div className="space-y-6">
      <FilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo} loading={isLoading}
        extra={
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Department</Label>
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger className="rounded-xl h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {depts.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
        onExportPDF={() => { if (!data) { toast({ title: "No data to export" }); return; } exportPDF("Attendance Report", headers, rows); }}
        onExportExcel={() => { if (!data) { toast({ title: "No data to export" }); return; } exportExcel("Attendance", headers, rows); }}
      />

      {isLoading ? <div className="h-48 bg-muted animate-pulse rounded-2xl" /> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Total Records" value={data.summary.total} Icon={Calendar} color="bg-blue-50 text-blue-600" />
            <StatCard label="Present" value={data.summary.present} Icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
            <StatCard label="Absent" value={data.summary.absent} Icon={AlertTriangle} color="bg-red-50 text-red-600" />
            <StatCard label="Late" value={data.summary.late} Icon={Clock} color="bg-amber-50 text-amber-600" />
            <StatCard label="On Leave" value={data.summary.leave} Icon={Calendar} color="bg-violet-50 text-violet-600" />
            <StatCard label="Attendance Rate" value={fmtPct(data.summary.attendanceRate)} Icon={TrendingUp} color="bg-indigo-50 text-indigo-600" />
            <StatCard label="Avg Hours/Day" value={data.summary.avgHours} Icon={Clock} color="bg-teal-50 text-teal-600" />
          </div>

          {data.byDepartment.length > 0 && (
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">By Department</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {data.byDepartment.map(d => (
                    <div key={d.name} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs font-semibold truncate">{d.name}</p>
                      <p className="text-lg font-bold text-primary mt-1">{d.total > 0 ? Math.round(d.present / d.total * 100) : 0}%</p>
                      <p className="text-[10px] text-muted-foreground">{d.present}/{d.total} present</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.rows.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No attendance data for selected period.</td></tr>
                  ) : data.rows.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono">{r.date}</td>
                      <td className="px-4 py-2.5 font-medium">{r.employeeName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.departmentName ?? "—"}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2.5">{r.checkIn ?? "—"}</td>
                      <td className="px-4 py-2.5">{r.checkOut ?? "—"}</td>
                      <td className="px-4 py-2.5">{r.hoursWorked !== "0" ? `${r.hoursWorked}h` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Projects Report Tab ──────────────────────────────────────────────────────
function ProjectsTab() {
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");

  const params = new URLSearchParams({ ...(from && { from }), ...(to && { to }), ...(status !== "all" && { status }) });
  const { data, isLoading } = useQuery<ProjectReport>({
    queryKey: ["report-projects", from, to, status],
    queryFn: () => apiFetch(`/reports/projects?${params}`),
  });

  const headers = ["Project", "Department", "Manager", "Status", "Priority", "Progress", "Start", "End", "Budget", "Tasks Done"];
  const rows = (data?.rows ?? []).map(r => [r.name, r.departmentName ?? "—", r.managerName, r.status, r.priority, `${r.progress}%`, r.startDate ?? "—", r.endDate ?? "—", r.budget ? fmtCur(r.budget) : "—", `${r.tasks.done}/${r.tasks.total}`]);

  const statusOptions = ["all", "planning", "active", "on_hold", "completed", "cancelled"];

  return (
    <div className="space-y-6">
      <FilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo} loading={isLoading}
        extra={
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="rounded-xl h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All Statuses" : s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
        onExportPDF={() => { if (!data) { toast({ title: "No data to export" }); return; } exportPDF("Project Progress Report", headers, rows); }}
        onExportExcel={() => { if (!data) { toast({ title: "No data to export" }); return; } exportExcel("Projects", headers, rows); }}
      />

      {isLoading ? <div className="h-48 bg-muted animate-pulse rounded-2xl" /> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Projects" value={data.summary.total} Icon={Briefcase} color="bg-blue-50 text-blue-600" />
            <StatCard label="Avg Progress" value={fmtPct(data.summary.avgProgress)} Icon={TrendingUp} color="bg-indigo-50 text-indigo-600" />
            <StatCard label="Total Budget" value={fmtCur(data.summary.totalBudget)} Icon={DollarSign} color="bg-emerald-50 text-emerald-600" />
            <StatCard label="Completed" value={data.summary.byStatus["completed"] ?? 0} Icon={CheckCircle2} color="bg-teal-50 text-teal-600" />
          </div>

          {Object.keys(data.summary.byStatus).length > 0 && (
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">By Status</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(data.summary.byStatus).map(([s, c]) => (
                    <div key={s} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50">
                      <StatusBadge status={s} />
                      <span className="text-sm font-bold">{c}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.rows.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No projects for selected filters.</td></tr>
                  ) : data.rows.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium max-w-[160px] truncate">{r.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.departmentName ?? "—"}</td>
                      <td className="px-4 py-2.5">{r.managerName}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2.5 capitalize">{r.priority}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${r.progress}%` }} />
                          </div>
                          <span>{r.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono">{r.startDate ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono">{r.endDate ?? "—"}</td>
                      <td className="px-4 py-2.5">{r.budget ? fmtCur(r.budget) : "—"}</td>
                      <td className="px-4 py-2.5">{r.tasks.done}/{r.tasks.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Financial Report Tab ─────────────────────────────────────────────────────
function FinancialTab() {
  const { toast } = useToast();
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("all");

  const params = new URLSearchParams({ ...(from && { from }), ...(to && { to }), ...(type !== "all" && { type }) });
  const { data, isLoading } = useQuery<FinancialReport>({
    queryKey: ["report-financial", from, to, type],
    queryFn: () => apiFetch(`/reports/financial?${params}`),
  });

  const headers = ["Date", "Reference", "Type", "Category", "Description", "Amount", "Currency", "Status", "Submitted By"];
  const rows = (data?.rows ?? []).map(r => [r.transactionDate, r.referenceNumber, r.type, r.category, r.description, fmtCur(r.amount), r.currency, r.status, r.submitterName]);

  return (
    <div className="space-y-6">
      <FilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo} loading={isLoading}
        extra={
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-xl h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        onExportPDF={() => { if (!data) { toast({ title: "No data to export" }); return; } exportPDF("Financial Summary Report", headers, rows); }}
        onExportExcel={() => { if (!data) { toast({ title: "No data to export" }); return; } exportExcel("Financial", headers, rows); }}
      />

      {isLoading ? <div className="h-48 bg-muted animate-pulse rounded-2xl" /> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Income" value={fmtCur(data.summary.totalIncome)} Icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
            <StatCard label="Total Expense" value={fmtCur(data.summary.totalExpense)} Icon={TrendingDown} color="bg-red-50 text-red-600" />
            <StatCard label="Net Balance" value={fmtCur(data.summary.netBalance)} Icon={DollarSign} color={parseFloat(data.summary.netBalance) >= 0 ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"} />
            <StatCard label="Transactions" value={data.summary.total} Icon={Activity} color="bg-violet-50 text-violet-600" />
          </div>

          {Object.keys(data.summary.byCategory).length > 0 && (
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">By Category</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(data.summary.byCategory).sort(([, a], [, b]) => b - a).map(([cat, amt]) => (
                    <div key={cat} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground capitalize">{cat.replace(/_/g, " ")}</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{fmtCur(amt)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.rows.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No transactions for selected period.</td></tr>
                  ) : data.rows.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono">{r.transactionDate}</td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono">{r.referenceNumber}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.type} /></td>
                      <td className="px-4 py-2.5 capitalize">{r.category.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 max-w-[180px] truncate">{r.description}</td>
                      <td className={`px-4 py-2.5 font-semibold ${r.type === "income" ? "text-emerald-700" : r.type === "expense" ? "text-red-700" : "text-blue-700"}`}>{fmtCur(r.amount)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.currency}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2.5">{r.submitterName}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-semibold text-xs">
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-right">Net Balance:</td>
                    <td className={`px-4 py-2 font-bold ${parseFloat(data.summary.netBalance) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtCur(data.summary.netBalance)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Departments Report Tab ───────────────────────────────────────────────────
function DepartmentsTab() {
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams({ ...(from && { from }), ...(to && { to }) });
  const { data, isLoading } = useQuery<DeptReport>({
    queryKey: ["report-departments", from, to],
    queryFn: () => apiFetch(`/reports/departments?${params}`),
  });

  const headers = ["Department", "Head", "Employees", "Attendance Records", "Present", "Attendance Rate", "Projects", "Completed", "Avg Progress"];
  const rows = (data?.rows ?? []).map(r => [r.name, r.headName, String(r.employeeCount), String(r.totalAttendance), String(r.presentCount), `${r.attendanceRate}%`, String(r.totalProjects), String(r.completedProjects), `${r.avgProgress}%`]);

  return (
    <div className="space-y-6">
      <FilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo} loading={isLoading}
        onExportPDF={() => { if (!data) { toast({ title: "No data to export" }); return; } exportPDF("Department Performance Report", headers, rows); }}
        onExportExcel={() => { if (!data) { toast({ title: "No data to export" }); return; } exportExcel("Departments", headers, rows); }}
      />

      {isLoading ? <div className="h-48 bg-muted animate-pulse rounded-2xl" /> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Departments" value={data.summary.totalDepartments} Icon={Building2} color="bg-blue-50 text-blue-600" />
            <StatCard label="Total Employees" value={data.summary.totalEmployees} Icon={Users} color="bg-indigo-50 text-indigo-600" />
            <StatCard label="Attendance Rate" value={fmtPct(data.summary.overallAttendanceRate)} Icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
            <StatCard label="Total Projects" value={data.summary.totalProjects} Icon={Briefcase} color="bg-violet-50 text-violet-600" />
          </div>

          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.rows.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No departments found.</td></tr>
                  ) : data.rows.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-foreground">{r.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.headName}</td>
                      <td className="px-4 py-3 font-medium">{r.employeeCount}</td>
                      <td className="px-4 py-3">{r.totalAttendance}</td>
                      <td className="px-4 py-3 text-emerald-700">{r.presentCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${r.attendanceRate >= 80 ? "bg-emerald-500" : r.attendanceRate >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${r.attendanceRate}%` }} />
                          </div>
                          <span>{r.attendanceRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{r.totalProjects}</td>
                      <td className="px-4 py-3 text-emerald-700">{r.completedProjects}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${r.avgProgress}%` }} />
                          </div>
                          <span>{r.avgProgress}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Audit Report Tab ─────────────────────────────────────────────────────────
function AuditTab() {
  const { toast } = useToast();
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [action, setAction] = useState("all");

  const params = new URLSearchParams({ ...(from && { from }), ...(to && { to }), ...(action !== "all" && { action }) });
  const { data, isLoading } = useQuery<AuditReport>({
    queryKey: ["report-audit", from, to, action],
    queryFn: () => apiFetch(`/reports/audit-report?${params}`),
  });

  const headers = ["Timestamp", "User", "Action", "Resource", "Description", "IP Address"];
  const rows = (data?.rows ?? []).map(r => [new Date(r.createdAt).toLocaleString("en-IN"), r.userName, r.action, r.resourceType, r.description, r.ipAddress ?? "—"]);

  const auditActions = ["all", "create", "read", "update", "delete", "login", "logout", "export", "import", "approve", "reject", "send", "archive"];

  return (
    <div className="space-y-6">
      <FilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo} loading={isLoading}
        extra={
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="rounded-xl h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {auditActions.map(a => <SelectItem key={a} value={a} className="capitalize">{a === "all" ? "All Actions" : a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
        onExportPDF={() => { if (!data) { toast({ title: "No data to export" }); return; } exportPDF("Audit Report", headers, rows); }}
        onExportExcel={() => { if (!data) { toast({ title: "No data to export" }); return; } exportExcel("Audit", headers, rows); }}
      />

      {isLoading ? <div className="h-48 bg-muted animate-pulse rounded-2xl" /> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Events" value={data.summary.total} Icon={ShieldCheck} color="bg-slate-50 text-slate-600" />
            <StatCard label="Most Active User" value={Object.entries(data.summary.byUser).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "—"} Icon={Users} color="bg-blue-50 text-blue-600" />
            <StatCard label="Top Action" value={Object.entries(data.summary.byAction).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "—"} Icon={Activity} color="bg-indigo-50 text-indigo-600" />
            <StatCard label="Resources Affected" value={Object.keys(data.summary.byResource).length} Icon={Briefcase} color="bg-violet-50 text-violet-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">By Action</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(data.summary.byAction).sort(([, a], [, b]) => b - a).slice(0, 8).map(([act, cnt]) => (
                    <div key={act} className="flex items-center gap-2">
                      <StatusBadge status={act} />
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(cnt / (data.summary.total || 1) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right">{cnt}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top Users</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(data.summary.byUser).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, cnt]) => (
                    <div key={name} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-28 truncate">{name}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.min(cnt / (data.summary.total || 1) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right">{cnt}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.rows.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No audit events for selected period.</td></tr>
                  ) : data.rows.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{new Date(r.createdAt).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2.5 font-medium">{r.userName}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.action} /></td>
                      <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px] rounded-full">{r.resourceType.replace(/_/g, " ")}</Badge></td>
                      <td className="px-4 py-2.5 max-w-[200px] truncate">{r.description}</td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{r.ipAddress ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────
export default function Reports() {
  const { data: depts = [] } = useQuery<Dept[]>({
    queryKey: ["report-depts"],
    queryFn: () => apiFetch("/reports/meta/departments"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate, filter, and export business reports across attendance, projects, finance, and more."
      />

      <Tabs defaultValue="attendance">
        <TabsList className="h-10 rounded-xl bg-muted p-1 flex-wrap gap-1">
          <TabsTrigger value="attendance" className="rounded-lg text-xs px-3 gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Attendance
          </TabsTrigger>
          <TabsTrigger value="projects" className="rounded-lg text-xs px-3 gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> Projects
          </TabsTrigger>
          <TabsTrigger value="financial" className="rounded-lg text-xs px-3 gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Financial
          </TabsTrigger>
          <TabsTrigger value="departments" className="rounded-lg text-xs px-3 gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Departments
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg text-xs px-3 gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Audit
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="attendance" className="mt-0"><AttendanceTab depts={depts} /></TabsContent>
          <TabsContent value="projects" className="mt-0"><ProjectsTab /></TabsContent>
          <TabsContent value="financial" className="mt-0"><FinancialTab /></TabsContent>
          <TabsContent value="departments" className="mt-0"><DepartmentsTab /></TabsContent>
          <TabsContent value="audit" className="mt-0"><AuditTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
