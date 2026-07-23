import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, Search, Eye, Pencil, Trash2, LogIn, LogOut, Download, Send,
  Archive, Check, X, RefreshCw, Upload, FileText, Plus, ChevronDown,
  ChevronUp, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  BarChart3, FileSpreadsheet, Printer, IndianRupee, Calendar
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────
type AuditEntry = {
  id: number; action: string; resourceType: string; resourceId?: string;
  description: string; userName: string; userEmail: string;
  ipAddress?: string; createdAt: string;
};

type BankStatement = {
  id: number; fileName: string; fileType: string; period?: string;
  bankName?: string; accountNumber?: string; totalEntries: number;
  totalCredits: string; totalDebits: string; createdAt: string;
};

type BankEntry = {
  id: number; statementId: number; date: string; description?: string;
  credit: string; debit: string; balance?: string; referenceNo?: string;
};

type CashbookEntry = {
  id: number; date: string; description?: string; credit: string;
  debit: string; referenceNo?: string; category?: string;
  entrySource: string; createdAt: string;
};

type ReconciliationReport = {
  id: number; reportName: string; period?: string;
  matchedCount: number; unmatchedBankCount: number; unmatchedCashbookCount: number;
  totalBankCredits: string; totalBankDebits: string;
  totalCashbookCredits: string; totalCashbookDebits: string;
  differenceCredits: string; differenceDebits: string; createdAt: string;
};

type FullReport = {
  report: ReconciliationReport;
  data: {
    matched: { bank: BankEntry; cashbook: CashbookEntry; dateDiff: number; type: string }[];
    unmatchedBank: BankEntry[];
    unmatchedCashbook: CashbookEntry[];
  };
};

// ─── Audit Log Icons ────────────────────────────────────────────────────────
const actionConfig: Record<string, { color: string; icon: any; bg: string }> = {
  create: { color: "text-emerald-700", bg: "bg-emerald-100", icon: RefreshCw },
  read: { color: "text-blue-700", bg: "bg-blue-100", icon: Eye },
  update: { color: "text-amber-700", bg: "bg-amber-100", icon: Pencil },
  delete: { color: "text-red-700", bg: "bg-red-100", icon: Trash2 },
  login: { color: "text-indigo-700", bg: "bg-indigo-100", icon: LogIn },
  logout: { color: "text-slate-700", bg: "bg-slate-100", icon: LogOut },
  export: { color: "text-purple-700", bg: "bg-purple-100", icon: Download },
  import: { color: "text-teal-700", bg: "bg-teal-100", icon: RefreshCw },
  approve: { color: "text-emerald-700", bg: "bg-emerald-100", icon: Check },
  reject: { color: "text-red-700", bg: "bg-red-100", icon: X },
  send: { color: "text-blue-700", bg: "bg-blue-100", icon: Send },
  archive: { color: "text-slate-700", bg: "bg-slate-100", icon: Archive },
};

function fmt(n: string | number) {
  return parseFloat(String(n) || "0").toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── CSV export ─────────────────────────────────────────────────────────────
function downloadCSV(rows: string[][], name: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Statement Entries Dialog ───────────────────────────────────────────────
function StatementEntriesDialog({ statementId, open, onClose }: { statementId: number | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ statement: BankStatement; entries: BankEntry[] }>({
    queryKey: ["bank-stmt-entries", statementId],
    queryFn: () => apiFetch(`/reconciliation/bank-statements/${statementId}/entries`),
    enabled: !!statementId && open,
  });
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Bank Statement Entries — {data?.statement?.fileName}</DialogTitle>
        </DialogHeader>
        {isLoading ? <div className="h-32 bg-muted animate-pulse rounded-xl" /> : (
          <div className="overflow-x-auto">
            <div className="flex gap-4 mb-4 flex-wrap">
              <div className="px-3 py-1.5 bg-emerald-50 rounded-xl text-xs text-emerald-700">
                Total Credits: ₹{fmt(data?.statement?.totalCredits ?? "0")}
              </div>
              <div className="px-3 py-1.5 bg-red-50 rounded-xl text-xs text-red-700">
                Total Debits: ₹{fmt(data?.statement?.totalDebits ?? "0")}
              </div>
              <div className="px-3 py-1.5 bg-slate-50 rounded-xl text-xs text-slate-600">
                {data?.entries?.length ?? 0} transactions
              </div>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold">
                <tr>{["Date", "Description", "Credit", "Debit", "Balance", "Reference"].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.entries ?? []).map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono">{e.date}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{e.description || "—"}</td>
                    <td className="px-3 py-2 text-emerald-700 font-medium">{parseFloat(e.credit) > 0 ? `₹${fmt(e.credit)}` : "—"}</td>
                    <td className="px-3 py-2 text-red-700 font-medium">{parseFloat(e.debit) > 0 ? `₹${fmt(e.debit)}` : "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.balance ? `₹${fmt(e.balance)}` : "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono">{e.referenceNo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Report Detail Dialog ───────────────────────────────────────────────────
function ReportDetailDialog({ reportId, open, onClose }: { reportId: number | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery<FullReport>({
    queryKey: ["reconciliation-report", reportId],
    queryFn: () => apiFetch(`/reconciliation/reports/${reportId}`),
    enabled: !!reportId && open,
  });

  const handleExport = () => {
    if (!data) return;
    const { report, data: rd } = data;
    const rows: string[][] = [
      ["RECONCILIATION REPORT", report.reportName, "", "", "", ""],
      ["Generated", new Date(report.createdAt).toLocaleString("en-IN"), "", "", "", ""],
      ["", "", "", "", "", ""],
      ["SUMMARY", "", "", "", "", ""],
      ["Matched", String(report.matchedCount), "", "Unmatched Bank", String(report.unmatchedBankCount), ""],
      ["Unmatched Cashbook", String(report.unmatchedCashbookCount), "", "", "", ""],
      ["Bank Credits", `₹${fmt(report.totalBankCredits)}`, "", "Cashbook Credits", `₹${fmt(report.totalCashbookCredits)}`, ""],
      ["Bank Debits", `₹${fmt(report.totalBankDebits)}`, "", "Cashbook Debits", `₹${fmt(report.totalCashbookDebits)}`, ""],
      ["Difference (Credits)", `₹${fmt(report.differenceCredits)}`, "", "Difference (Debits)", `₹${fmt(report.differenceDebits)}`, ""],
      ["", "", "", "", "", ""],
      ["MATCHED ENTRIES", "", "", "", "", ""],
      ["Bank Date", "Bank Description", "Bank Credit", "Bank Debit", "Cashbook Date", "Cashbook Description"],
      ...rd.matched.map(m => [m.bank.date, m.bank.description ?? "", `₹${fmt(m.bank.credit)}`, `₹${fmt(m.bank.debit)}`, m.cashbook.date, m.cashbook.description ?? ""]),
      ["", "", "", "", "", ""],
      ["UNMATCHED BANK ENTRIES", "", "", "", "", ""],
      ["Date", "Description", "Credit", "Debit", "Reference", ""],
      ...rd.unmatchedBank.map(e => [e.date, e.description ?? "", `₹${fmt(e.credit)}`, `₹${fmt(e.debit)}`, e.referenceNo ?? "", ""]),
      ["", "", "", "", "", ""],
      ["UNMATCHED CASHBOOK ENTRIES", "", "", "", "", ""],
      ["Date", "Description", "Credit", "Debit", "Reference", ""],
      ...rd.unmatchedCashbook.map(e => [e.date, e.description ?? "", `₹${fmt(e.credit)}`, `₹${fmt(e.debit)}`, e.referenceNo ?? "", ""]),
    ];
    downloadCSV(rows, `reconciliation-${report.id}.csv`);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{data?.report?.reportName}</DialogTitle>
            <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </DialogHeader>
        {isLoading ? <div className="h-48 bg-muted animate-pulse rounded-xl" /> : data && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{data.report.matchedCount}</p>
                <p className="text-xs text-emerald-600">Matched</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-700">{data.report.unmatchedBankCount}</p>
                <p className="text-xs text-orange-600">Unmatched Bank</p>
              </div>
              <div className="bg-violet-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-violet-700">{data.report.unmatchedCashbookCount}</p>
                <p className="text-xs text-violet-600">Unmatched Cashbook</p>
              </div>
              <div className={`rounded-xl p-3 text-center ${Math.abs(parseFloat(data.report.differenceCredits)) < 0.01 && Math.abs(parseFloat(data.report.differenceDebits)) < 0.01 ? "bg-emerald-50" : "bg-red-50"}`}>
                <p className={`text-lg font-bold ${Math.abs(parseFloat(data.report.differenceCredits)) < 0.01 ? "text-emerald-700" : "text-red-700"}`}>
                  {Math.abs(parseFloat(data.report.differenceCredits)) < 0.01 && Math.abs(parseFloat(data.report.differenceDebits)) < 0.01 ? "✓ Balanced" : "Difference"}
                </p>
                <p className="text-xs text-muted-foreground">Cr: ₹{fmt(data.report.differenceCredits)} / Dr: ₹{fmt(data.report.differenceDebits)}</p>
              </div>
            </div>

            {/* Totals table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr><th className="px-4 py-2 text-left">Category</th><th className="px-4 py-2 text-right">Credits</th><th className="px-4 py-2 text-right">Debits</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="bg-blue-50/50"><td className="px-4 py-2 font-medium">Bank Statement</td><td className="px-4 py-2 text-right text-emerald-700">₹{fmt(data.report.totalBankCredits)}</td><td className="px-4 py-2 text-right text-red-700">₹{fmt(data.report.totalBankDebits)}</td></tr>
                  <tr className="bg-violet-50/50"><td className="px-4 py-2 font-medium">Cashbook</td><td className="px-4 py-2 text-right text-emerald-700">₹{fmt(data.report.totalCashbookCredits)}</td><td className="px-4 py-2 text-right text-red-700">₹{fmt(data.report.totalCashbookDebits)}</td></tr>
                  <tr className="bg-slate-100 font-semibold"><td className="px-4 py-2">Difference</td><td className={`px-4 py-2 text-right ${parseFloat(data.report.differenceCredits) === 0 ? "text-emerald-700" : "text-red-700"}`}>₹{fmt(data.report.differenceCredits)}</td><td className={`px-4 py-2 text-right ${parseFloat(data.report.differenceDebits) === 0 ? "text-emerald-700" : "text-red-700"}`}>₹{fmt(data.report.differenceDebits)}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Matched entries */}
            {data.data.matched.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Matched Entries ({data.data.matched.length})
                </p>
                <div className="overflow-x-auto rounded-xl border border-emerald-200">
                  <table className="w-full text-xs">
                    <thead className="bg-emerald-50 text-emerald-700 font-semibold">
                      <tr><th className="px-3 py-2 text-left">Bank Date</th><th className="px-3 py-2 text-left">Bank Description</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-left">Cashbook Date</th><th className="px-3 py-2 text-left">Cashbook Desc</th><th className="px-3 py-2 text-center">±Days</th></tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {data.data.matched.map((m, i) => (
                        <tr key={i} className="hover:bg-emerald-50/50">
                          <td className="px-3 py-2 font-mono">{m.bank.date}</td>
                          <td className="px-3 py-2 max-w-[120px] truncate">{m.bank.description || "—"}</td>
                          <td className="px-3 py-2 text-right text-emerald-700">{parseFloat(m.bank.credit) > 0 ? `₹${fmt(m.bank.credit)}` : "—"}</td>
                          <td className="px-3 py-2 text-right text-red-700">{parseFloat(m.bank.debit) > 0 ? `₹${fmt(m.bank.debit)}` : "—"}</td>
                          <td className="px-3 py-2 font-mono">{m.cashbook.date}</td>
                          <td className="px-3 py-2 max-w-[120px] truncate">{m.cashbook.description || "—"}</td>
                          <td className="px-3 py-2 text-center">{m.dateDiff === 0 ? "exact" : `±${m.dateDiff}d`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Unmatched bank */}
            {data.data.unmatchedBank.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Unmatched Bank Entries ({data.data.unmatchedBank.length})
                </p>
                <div className="overflow-x-auto rounded-xl border border-orange-200">
                  <table className="w-full text-xs">
                    <thead className="bg-orange-50 text-orange-700 font-semibold">
                      <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-left">Reference</th></tr>
                    </thead>
                    <tbody className="divide-y divide-orange-100">
                      {data.data.unmatchedBank.map((e, i) => (
                        <tr key={i} className="hover:bg-orange-50/50">
                          <td className="px-3 py-2 font-mono">{e.date}</td>
                          <td className="px-3 py-2">{e.description || "—"}</td>
                          <td className="px-3 py-2 text-right text-emerald-700">{parseFloat(e.credit) > 0 ? `₹${fmt(e.credit)}` : "—"}</td>
                          <td className="px-3 py-2 text-right text-red-700">{parseFloat(e.debit) > 0 ? `₹${fmt(e.debit)}` : "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.referenceNo || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Unmatched cashbook */}
            {data.data.unmatchedCashbook.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-violet-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Unmatched Cashbook Entries ({data.data.unmatchedCashbook.length})
                </p>
                <div className="overflow-x-auto rounded-xl border border-violet-200">
                  <table className="w-full text-xs">
                    <thead className="bg-violet-50 text-violet-700 font-semibold">
                      <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-left">Reference</th></tr>
                    </thead>
                    <tbody className="divide-y divide-violet-100">
                      {data.data.unmatchedCashbook.map((e, i) => (
                        <tr key={i} className="hover:bg-violet-50/50">
                          <td className="px-3 py-2 font-mono">{e.date}</td>
                          <td className="px-3 py-2">{e.description || "—"}</td>
                          <td className="px-3 py-2 text-right text-emerald-700">{parseFloat(e.credit) > 0 ? `₹${fmt(e.credit)}` : "—"}</td>
                          <td className="px-3 py-2 text-right text-red-700">{parseFloat(e.debit) > 0 ? `₹${fmt(e.debit)}` : "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.referenceNo || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Reconciliation Tab ─────────────────────────────────────────────────────
function ReconciliationTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const bankFileRef = useRef<HTMLInputElement>(null);
  const cbFileRef = useRef<HTMLInputElement>(null);

  const [stmtForm, setStmtForm] = useState({ bankName: "", accountNumber: "", period: "" });
  const [uploading, setUploading] = useState(false);
  const [viewStmtId, setViewStmtId] = useState<number | null>(null);
  const [viewStmtOpen, setViewStmtOpen] = useState(false);

  const [cbForm, setCbForm] = useState({ date: "", description: "", credit: "", debit: "", referenceNo: "", category: "" });
  const [cbUploading, setCbUploading] = useState(false);

  const [reportForm, setReportForm] = useState({ statementId: "none", reportName: "", period: "", toleranceDays: "3" });
  const [generating, setGenerating] = useState(false);
  const [viewReportId, setViewReportId] = useState<number | null>(null);
  const [viewReportOpen, setViewReportOpen] = useState(false);
  const [liveReport, setLiveReport] = useState<any>(null);

  const { data: statements = [], isLoading: stmtsLoading } = useQuery<BankStatement[]>({
    queryKey: ["bank-statements"],
    queryFn: () => apiFetch("/reconciliation/bank-statements"),
  });

  const { data: cashbookEntries = [], isLoading: cbLoading } = useQuery<CashbookEntry[]>({
    queryKey: ["cashbook"],
    queryFn: () => apiFetch("/reconciliation/cashbook"),
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<ReconciliationReport[]>({
    queryKey: ["reconciliation-reports"],
    queryFn: () => apiFetch("/reconciliation/reports"),
  });

  const deleteStatement = useMutation({
    mutationFn: (id: number) => apiFetch(`/reconciliation/bank-statements/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-statements"] }); toast({ title: "Statement deleted" }); },
  });

  const deleteCashbook = useMutation({
    mutationFn: (id: number) => apiFetch(`/reconciliation/cashbook/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cashbook"] }); toast({ title: "Entry deleted" }); },
  });

  const handleBankUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["csv", "pdf"].includes(ext)) {
      toast({ title: "Invalid file", description: "Please upload a CSV or PDF file", variant: "destructive" }); return;
    }
    setUploading(true);
    try {
      const fileData = await fileToBase64(file);
      const result: any = await apiFetch("/reconciliation/bank-statements", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileType: ext, fileData, ...stmtForm }),
      });
      qc.invalidateQueries({ queryKey: ["bank-statements"] });
      toast({ title: "Statement uploaded", description: `${result.entriesCount} transactions extracted from ${file.name}` });
      setStmtForm({ bankName: "", accountNumber: "", period: "" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
    if (bankFileRef.current) bankFileRef.current.value = "";
  };

  const handleCashbookCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCbUploading(true);
    try {
      const fileData = await fileToBase64(file);
      const result: any = await apiFetch("/reconciliation/cashbook", {
        method: "POST",
        body: JSON.stringify({ fileData, fileName: file.name }),
      });
      qc.invalidateQueries({ queryKey: ["cashbook"] });
      toast({ title: "Cashbook imported", description: `${result.count} entries added` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    }
    setCbUploading(false);
    if (cbFileRef.current) cbFileRef.current.value = "";
  };

  const addCashbookEntry = async () => {
    if (!cbForm.date || (!cbForm.credit && !cbForm.debit)) {
      toast({ title: "Date and at least one amount (credit or debit) are required", variant: "destructive" }); return;
    }
    try {
      await apiFetch("/reconciliation/cashbook", { method: "POST", body: JSON.stringify(cbForm) });
      qc.invalidateQueries({ queryKey: ["cashbook"] });
      toast({ title: "Entry added" });
      setCbForm({ date: "", description: "", credit: "", debit: "", referenceNo: "", category: "" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    setLiveReport(null);
    try {
      const result: any = await apiFetch("/reconciliation/generate-report", {
        method: "POST",
        body: JSON.stringify({
          statementId: (reportForm.statementId && reportForm.statementId !== "none") ? reportForm.statementId : null,
          reportName: reportForm.reportName || `Reconciliation — ${new Date().toLocaleDateString("en-IN")}`,
          period: reportForm.period || null,
          toleranceDays: parseInt(reportForm.toleranceDays) || 3,
        }),
      });
      qc.invalidateQueries({ queryKey: ["reconciliation-reports"] });
      setLiveReport(result);
      toast({ title: "Report generated!", description: `${result.matched.length} matched, ${result.unmatchedBank.length} unmatched bank, ${result.unmatchedCashbook.length} unmatched cashbook` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  const totalBankCredits = statements.reduce((s, st) => s + parseFloat(st.totalCredits), 0);
  const totalBankDebits = statements.reduce((s, st) => s + parseFloat(st.totalDebits), 0);
  const totalCbCredits = cashbookEntries.reduce((s, e) => s + parseFloat(e.credit), 0);
  const totalCbDebits = cashbookEntries.reduce((s, e) => s + parseFloat(e.debit), 0);

  return (
    <div className="space-y-8">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Bank Statements", val: statements.length, Icon: FileSpreadsheet, color: "text-blue-600 bg-blue-50" },
          { label: "Bank Transactions", val: statements.reduce((s, st) => s + st.totalEntries, 0), Icon: BarChart3, color: "text-indigo-600 bg-indigo-50" },
          { label: "Cashbook Entries", val: cashbookEntries.length, Icon: FileText, color: "text-violet-600 bg-violet-50" },
          { label: "Reports Generated", val: reports.length, Icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
        ].map(({ label, val, Icon, color }) => (
          <Card key={label} className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold text-foreground">{val}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Step 1: Bank Statement Upload */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</div>
            Upload Bank Statement
            <Badge variant="outline" className="text-xs rounded-full ml-1">CSV or PDF</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Bank Name</Label>
              <Input value={stmtForm.bankName} onChange={e => setStmtForm(f => ({ ...f, bankName: e.target.value }))} className="rounded-xl h-9" placeholder="e.g. HDFC Bank" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Account Number (optional)</Label>
              <Input value={stmtForm.accountNumber} onChange={e => setStmtForm(f => ({ ...f, accountNumber: e.target.value }))} className="rounded-xl h-9" placeholder="XXXX-XXXX-XXXX" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Statement Period</Label>
              <Input value={stmtForm.period} onChange={e => setStmtForm(f => ({ ...f, period: e.target.value }))} className="rounded-xl h-9" placeholder="e.g. March 2026" />
            </div>
          </div>
          <input ref={bankFileRef} type="file" accept=".csv,.pdf" className="hidden" onChange={handleBankUpload} />
          <div
            className="border-2 border-dashed border-input rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
            onClick={() => !uploading && bankFileRef.current?.click()}>
            <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">{uploading ? "Processing file..." : "Click to upload bank statement"}</p>
            <p className="text-xs text-muted-foreground mt-1">Supports CSV or PDF — dates, credits, debits will be auto-extracted</p>
          </div>

          {stmtsLoading ? (
            <div className="h-12 bg-muted animate-pulse rounded-xl" />
          ) : statements.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr><th className="px-3 py-2 text-left">File</th><th className="px-3 py-2 text-left">Bank</th><th className="px-3 py-2 text-left">Period</th><th className="px-3 py-2 text-center">Transactions</th><th className="px-3 py-2 text-right">Credits</th><th className="px-3 py-2 text-right">Debits</th><th className="px-3 py-2 text-center">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {statements.map(st => (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 flex items-center gap-1.5"><FileText className="h-3 w-3 text-blue-500" />{st.fileName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{st.bankName || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{st.period || "—"}</td>
                      <td className="px-3 py-2 text-center font-medium">{st.totalEntries}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">₹{fmt(st.totalCredits)}</td>
                      <td className="px-3 py-2 text-right text-red-700">₹{fmt(st.totalDebits)}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setViewStmtId(st.id); setViewStmtOpen(true); }}
                            className="text-blue-500 hover:text-blue-700 p-1 rounded"><Eye className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { if (confirm("Delete this statement?")) deleteStatement.mutate(st.id); }}
                            className="text-rose-400 hover:text-rose-600 p-1 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-semibold text-xs">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right">Total:</td>
                    <td className="px-3 py-2 text-right text-emerald-700">₹{fmt(totalBankCredits)}</td>
                    <td className="px-3 py-2 text-right text-red-700">₹{fmt(totalBankDebits)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Cashbook */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</div>
            Cashbook Entries
            <Badge variant="outline" className="text-xs rounded-full ml-1">{cashbookEntries.length} entries</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Manual entry */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Manual Entry</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Date <span className="text-red-400">*</span></Label>
                <Input type="date" value={cbForm.date} onChange={e => setCbForm(f => ({ ...f, date: e.target.value }))} className="rounded-xl h-9" />
              </div>
              <div className="col-span-2 md:col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
                <Input value={cbForm.description} onChange={e => setCbForm(f => ({ ...f, description: e.target.value }))} className="rounded-xl h-9" placeholder="e.g. Payment to vendor, Salary received..." />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Credit (₹)</Label>
                <Input type="number" value={cbForm.credit} onChange={e => setCbForm(f => ({ ...f, credit: e.target.value }))} className="rounded-xl h-9" placeholder="0.00" min="0" step="0.01" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Debit (₹)</Label>
                <Input type="number" value={cbForm.debit} onChange={e => setCbForm(f => ({ ...f, debit: e.target.value }))} className="rounded-xl h-9" placeholder="0.00" min="0" step="0.01" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Reference No.</Label>
                <Input value={cbForm.referenceNo} onChange={e => setCbForm(f => ({ ...f, referenceNo: e.target.value }))} className="rounded-xl h-9" placeholder="Chq/NEFT no." />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
                <Input value={cbForm.category} onChange={e => setCbForm(f => ({ ...f, category: e.target.value }))} className="rounded-xl h-9" placeholder="e.g. Sales, Expenses" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button size="sm" className="rounded-xl gap-1.5" onClick={addCashbookEntry}>
                <Plus className="h-3.5 w-3.5" /> Add Entry
              </Button>
              <div className="flex-1 border-l border-input pl-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Or bulk upload CSV:</span>
                <input ref={cbFileRef} type="file" accept=".csv" className="hidden" onChange={handleCashbookCSV} />
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-7 text-xs" onClick={() => cbFileRef.current?.click()} disabled={cbUploading}>
                  <Upload className="h-3 w-3" /> {cbUploading ? "Importing..." : "Import CSV"}
                </Button>
              </div>
            </div>
          </div>

          {/* Cashbook table */}
          {cbLoading ? (
            <div className="h-12 bg-muted animate-pulse rounded-xl" />
          ) : cashbookEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No cashbook entries yet. Add entries manually or upload a CSV.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-left">Reference</th><th className="px-3 py-2 text-left">Source</th><th className="px-3 py-2" /></tr>
                </thead>
                <tbody className="divide-y divide-border max-h-64 overflow-y-auto">
                  {cashbookEntries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono">{e.date}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate">{e.description || "—"}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{parseFloat(e.credit) > 0 ? `₹${fmt(e.credit)}` : "—"}</td>
                      <td className="px-3 py-2 text-right text-red-700">{parseFloat(e.debit) > 0 ? `₹${fmt(e.debit)}` : "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{e.referenceNo || "—"}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px] rounded-full px-1.5">{e.entrySource}</Badge></td>
                      <td className="px-3 py-2">
                        <button onClick={() => { if (confirm("Delete?")) deleteCashbook.mutate(e.id); }} className="text-rose-400 hover:text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-semibold text-xs">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-right">Total:</td>
                    <td className="px-3 py-2 text-right text-emerald-700">₹{fmt(totalCbCredits)}</td>
                    <td className="px-3 py-2 text-right text-red-700">₹{fmt(totalCbDebits)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Generate Report */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">3</div>
            Generate Reconciliation Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Report Name</Label>
              <Input value={reportForm.reportName} onChange={e => setReportForm(f => ({ ...f, reportName: e.target.value }))} className="rounded-xl h-9" placeholder="e.g. March 2026 Bank Reconciliation" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Bank Statement (optional)</Label>
              <Select value={reportForm.statementId} onValueChange={v => setReportForm(f => ({ ...f, statementId: v }))}>
                <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder="All statements" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All statements</SelectItem>
                  {statements.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.fileName} {s.period ? `(${s.period})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Date Tolerance (days)</Label>
              <Input type="number" value={reportForm.toleranceDays} onChange={e => setReportForm(f => ({ ...f, toleranceDays: e.target.value }))} className="rounded-xl h-9" min="0" max="10" />
            </div>
          </div>
          <Button className="rounded-xl gap-2 bg-primary text-white" onClick={generateReport} disabled={generating || (statements.length === 0 && cashbookEntries.length === 0)}>
            {generating ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating...</> : <><BarChart3 className="h-4 w-4" /> Generate Report</>}
          </Button>

          {/* Live report summary */}
          {liveReport && (
            <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-emerald-800">Report Generated Successfully</p>
                <Button size="sm" variant="outline" className="rounded-xl gap-1 h-7 text-xs" onClick={() => { setViewReportId(liveReport.report.id); setViewReportOpen(true); }}>
                  <Eye className="h-3 w-3" /> View Full Report
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-100 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-emerald-800">{liveReport.matched.length}</p>
                  <p className="text-xs text-emerald-700">Matched</p>
                </div>
                <div className="bg-orange-100 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-orange-800">{liveReport.unmatchedBank.length}</p>
                  <p className="text-xs text-orange-700">Unmatched Bank</p>
                </div>
                <div className="bg-violet-100 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-violet-800">{liveReport.unmatchedCashbook.length}</p>
                  <p className="text-xs text-violet-700">Unmatched Cashbook</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Reports */}
      {reports.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Past Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reports.map(r => (
                <div key={r.id} className="flex items-center gap-4 p-3 rounded-xl border border-input hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.reportName}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span>{new Date(r.createdAt).toLocaleDateString("en-IN")}</span>
                      <span className="text-emerald-600">{r.matchedCount} matched</span>
                      {r.unmatchedBankCount > 0 && <span className="text-orange-600">{r.unmatchedBankCount} unmatched bank</span>}
                      {r.unmatchedCashbookCount > 0 && <span className="text-violet-600">{r.unmatchedCashbookCount} unmatched cashbook</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-emerald-700">Cr: ₹{fmt(r.totalBankCredits)}</span>
                    <span className="text-red-700">Dr: ₹{fmt(r.totalBankDebits)}</span>
                    {Math.abs(parseFloat(r.differenceCredits)) < 0.01 && Math.abs(parseFloat(r.differenceDebits)) < 0.01
                      ? <Badge className="bg-emerald-100 text-emerald-700 text-xs rounded-full">Balanced</Badge>
                      : <Badge className="bg-red-100 text-red-700 text-xs rounded-full">Difference</Badge>
                    }
                  </div>
                  <Button size="sm" variant="outline" className="rounded-xl gap-1 h-7 text-xs" onClick={() => { setViewReportId(r.id); setViewReportOpen(true); }}>
                    <Eye className="h-3 w-3" /> View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <StatementEntriesDialog statementId={viewStmtId} open={viewStmtOpen} onClose={() => setViewStmtOpen(false)} />
      <ReportDetailDialog reportId={viewReportId} open={viewReportOpen} onClose={() => setViewReportOpen(false)} />
    </div>
  );
}

// ─── Main Audit Page ────────────────────────────────────────────────────────
export default function Audit() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");

  const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["audit"],
    queryFn: () => apiFetch("/audit"),
  });

  const filtered = entries.filter(e =>
    (actionFilter === "all" || e.action === actionFilter) &&
    (resourceFilter === "all" || e.resourceType === resourceFilter) &&
    (e.description?.toLowerCase().includes(search.toLowerCase()) ||
      e.userName?.toLowerCase().includes(search.toLowerCase()) ||
      e.resourceType?.toLowerCase().includes(search.toLowerCase()))
  );

  const uniqueResources = [...new Set(entries.map(e => e.resourceType))].sort();
  const actionCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.action] = (acc[e.action] ?? 0) + 1; return acc;
  }, {});
  const topActions = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-8">
      <Tabs defaultValue="reconciliation">
        <PageHeader
          title="Audit System"
          description="Bank reconciliation, cashbook management, and system activity logs."
          action={
            <TabsList className="h-9 rounded-xl bg-muted p-1">
              <TabsTrigger value="reconciliation" className="rounded-lg text-xs px-3">Bank Reconciliation</TabsTrigger>
              <TabsTrigger value="activity" className="rounded-lg text-xs px-3">Activity Log</TabsTrigger>
            </TabsList>
          }
        />

        {/* ─── Bank Reconciliation Tab ─── */}
        <TabsContent value="reconciliation" className="mt-0">
          <ReconciliationTab />
        </TabsContent>

        {/* ─── Activity Log Tab ─── */}
        <TabsContent value="activity" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {topActions.map(([action, count]) => {
              const cfg = actionConfig[action] ?? actionConfig.update;
              const Icon = cfg.icon;
              return (
                <Card key={action} className="border-border/50 rounded-2xl shadow-sm">
                  <CardContent className="pt-5 pb-4 flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${cfg.bg}`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{count}</p>
                      <p className="text-xs text-muted-foreground capitalize">{action}s</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search audit log..." className="pl-9 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px] rounded-xl"><SelectValue placeholder="All actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.keys(actionConfig).map(a => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-[180px] rounded-xl"><SelectValue placeholder="All resources" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                {uniqueResources.map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/50 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Resource</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    [1, 2, 3, 4, 5].map(i => <tr key={i}>{[1, 2, 3, 4, 5, 6].map(j => <td key={j} className="px-6 py-4"><div className="h-4 bg-slate-100 animate-pulse rounded" /></td>)}</tr>)
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No audit entries found.</td></tr>
                  ) : filtered.map(entry => {
                    const cfg = actionConfig[entry.action] ?? actionConfig.update;
                    const Icon = cfg.icon;
                    const ts = new Date(entry.createdAt);
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-2 w-fit px-2 py-1 rounded-lg ${cfg.bg}`}>
                            <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                            <span className={`text-xs font-semibold capitalize ${cfg.color}`}>{entry.action}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="text-xs capitalize">{entry.resourceType?.replace(/_/g, " ")}</Badge>
                          {entry.resourceId && <p className="text-[10px] text-muted-foreground mt-0.5">ID: {entry.resourceId}</p>}
                        </td>
                        <td className="px-6 py-4 max-w-xs"><p className="text-sm text-foreground line-clamp-2">{entry.description}</p></td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground text-sm">{entry.userName}</p>
                          <p className="text-[10px] text-muted-foreground">{entry.userEmail}</p>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{entry.ipAddress ?? "—"}</td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          <p>{ts.toLocaleDateString()}</p>
                          <p>{ts.toLocaleTimeString()}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
