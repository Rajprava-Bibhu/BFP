import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Plus, CheckCircle } from "lucide-react";

type Transaction = {
  id: number;
  referenceNumber: string;
  type: "income" | "expense" | "transfer" | "refund" | "adjustment";
  category: string;
  status: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  description: string;
  transactionDate: string;
  approvedById?: number;
};

type Summary = {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  totalTransactions: number;
};

const typeColors: Record<string, string> = {
  income: "bg-emerald-500",
  expense: "bg-red-500",
  transfer: "bg-blue-500",
  refund: "bg-amber-500",
  adjustment: "bg-slate-500",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function Finance() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState<Partial<Transaction>>({
    type: "income", category: "other", paymentMethod: "bank_transfer", status: "completed",
    currency: "USD",
  });

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["finance-transactions"],
    queryFn: () => apiFetch("/finance/transactions"),
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["finance-summary"],
    queryFn: () => apiFetch("/finance/summary"),
  });

  const createTxn = useMutation({
    mutationFn: (data: Partial<Transaction>) => apiFetch("/finance/transactions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-transactions", "finance-summary"] }); setOpen(false); },
  });

  const approveTxn = useMutation({
    mutationFn: (id: number) => apiFetch(`/finance/transactions/${id}/approve`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-transactions", "finance-summary"] }),
  });

  const filtered = transactions.filter(t => filter === "all" || t.type === filter);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance"
        description="Track income, expenses, and financial health of the business."
        action={
          <Button onClick={() => setOpen(true)} className="bg-primary text-white hover:bg-primary/90 rounded-xl gap-2">
            <Plus className="h-4 w-4" /> Add Transaction
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Income", value: summary?.totalIncome ?? 0, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", iconColor: "text-emerald-600" },
          { label: "Total Expenses", value: summary?.totalExpense ?? 0, icon: TrendingDown, color: "text-red-600", bg: "bg-red-50", iconColor: "text-red-600" },
          { label: "Net Profit", value: summary?.netProfit ?? 0, icon: DollarSign, color: (summary?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-red-600", bg: "bg-blue-50", iconColor: "text-blue-600" },
          { label: "Transactions", value: summary?.totalTransactions ?? transactions.length, icon: ArrowUpRight, color: "text-primary", bg: "bg-primary/5", iconColor: "text-primary" },
        ].map(s => (
          <Card key={s.label} className="border-border/50 rounded-2xl shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className={`text-2xl font-display font-bold mt-1 ${s.color}`}>
                    {typeof s.value === "number" && s.label !== "Transactions" ? `₹${s.value.toLocaleString("en-IN")}` : s.value}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl ${s.bg}`}>
                  <s.icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "income", "expense", "transfer", "refund"].map(t => (
          <Button
            key={t}
            variant={filter === t ? "default" : "outline"}
            size="sm"
            className={`rounded-xl capitalize ${filter === t ? "bg-primary text-white" : ""}`}
            onClick={() => setFilter(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      {/* Transactions Table */}
      <Card className="border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                [1,2,3].map(i => <tr key={i}>{[1,2,3,4,5,6,7,8].map(j => <td key={j} className="px-6 py-4"><div className="h-4 bg-slate-100 animate-pulse rounded"/></td>)}</tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No transactions found.</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-semibold text-primary">{t.referenceNumber}</td>
                  <td className="px-6 py-4 max-w-xs">
                    <p className="font-medium text-foreground truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground capitalize">{t.paymentMethod?.replace(/_/g, " ")}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {t.type === "income" ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                      <Badge className={`${typeColors[t.type] ?? "bg-slate-400"} text-white text-xs capitalize`}>{t.type}</Badge>
                    </div>
                  </td>
                  <td className="px-6 py-4 capitalize text-muted-foreground">{t.category?.replace(/_/g, " ")}</td>
                  <td className={`px-6 py-4 font-bold ${t.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                    {t.type === "income" ? "+" : "-"}₹{t.amount?.toLocaleString("en-IN")}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">{new Date(t.transactionDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={`text-xs ${statusColors[t.status] ?? ""}`}>{t.status}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    {t.status === "pending" && (
                      <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs px-2 text-emerald-600 border-emerald-200" onClick={() => approveTxn.mutate(t.id)}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Approve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Transaction Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Add Transaction</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
              <Select value={form.type ?? "income"} onValueChange={v => setForm(p => ({ ...p, type: v as Transaction["type"] }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["income", "expense", "transfer", "refund", "adjustment"].map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
              <Select value={form.category ?? "other"} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["salary","rent","utilities","software","marketing","travel","office_supplies","equipment","consulting","sales","subscription","tax","insurance","other"].map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g," ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Description *</Label>
              <Input value={form.description ?? ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Amount ($) *</Label>
              <Input type="number" value={form.amount ?? ""} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) }))} className="rounded-xl" placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Date *</Label>
              <Input type="date" value={form.transactionDate ?? ""} onChange={e => setForm(p => ({ ...p, transactionDate: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Payment Method</Label>
              <Select value={form.paymentMethod ?? "bank_transfer"} onValueChange={v => setForm(p => ({ ...p, paymentMethod: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cash","bank_transfer","credit_card","debit_card","cheque","paypal","stripe","other"].map(m => (
                    <SelectItem key={m} value={m} className="capitalize">{m.replace(/_/g," ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Reference #</Label>
              <Input value={form.referenceNumber ?? ""} onChange={e => setForm(p => ({ ...p, referenceNumber: e.target.value }))} className="rounded-xl" placeholder="Auto-generated if empty" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="flex-1 rounded-xl bg-primary text-white"
              onClick={() => createTxn.mutate({
                ...form,
                referenceNumber: form.referenceNumber || `TXN-${Date.now()}`,
              })}
              disabled={!form.description || !form.amount || !form.transactionDate || createTxn.isPending}
            >
              {createTxn.isPending ? "Saving..." : "Add Transaction"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
