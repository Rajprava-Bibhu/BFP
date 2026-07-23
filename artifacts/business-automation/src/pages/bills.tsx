import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import {
  FileText, DollarSign, Clock, CheckCircle2, AlertCircle, Plus, Eye,
  Trash2, Download, Share2, Search, X, Send, Printer,
} from "lucide-react";

type BillItem = {
  id?: number;
  description: string;
  hsn?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  amount: number;
  taxRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
};

type Bill = {
  id: number;
  billNumber: string;
  billType: string;
  billCategory: string;
  status: string;
  issueDate: string;
  dueDate?: string;
  subject?: string;
  notes?: string;
  terms?: string;
  currency: string;
  clientId?: number;
  clientName?: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientGstNumber?: string;
  sellerName?: string;
  sellerAddress?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  sellerGstNumber?: string;
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  isInterstate: boolean;
  totalAmount: number;
  paidAmount: number;
  items?: BillItem[];
};

type Client = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  company?: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  viewed: "bg-indigo-100 text-indigo-700 border-indigo-200",
  partially_paid: "bg-amber-100 text-amber-700 border-amber-200",
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  overdue: "bg-rose-100 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AED", "SGD"];

function fmt(n: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

function newItem(): BillItem {
  return { description: "", hsn: "", quantity: 1, unit: "", unitPrice: 0, amount: 0, taxRate: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
}

function calcItem(item: BillItem, isGst: boolean, isInterstate: boolean): BillItem {
  const amount = item.quantity * item.unitPrice;
  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
  if (isGst) {
    const halfRate = item.taxRate / 2;
    if (isInterstate) {
      igstAmount = amount * (item.taxRate / 100);
    } else {
      cgstAmount = amount * (halfRate / 100);
      sgstAmount = amount * (halfRate / 100);
    }
  }
  return { ...item, amount, cgstAmount, sgstAmount, igstAmount };
}

function calcTotals(items: BillItem[], discount: number, taxRate: number, isGst: boolean, isInterstate: boolean, cgstRate: number, sgstRate: number, igstRate: number) {
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  let taxAmount = 0, cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

  if (isGst) {
    cgstAmount = items.reduce((s, i) => s + i.cgstAmount, 0);
    sgstAmount = items.reduce((s, i) => s + i.sgstAmount, 0);
    igstAmount = items.reduce((s, i) => s + i.igstAmount, 0);
    taxAmount = cgstAmount + sgstAmount + igstAmount;
  } else {
    taxAmount = (subtotal - discount) * (taxRate / 100);
  }
  const totalAmount = subtotal - discount + taxAmount;
  return { subtotal, taxAmount, cgstAmount, sgstAmount, igstAmount, totalAmount };
}

function InvoicePreview({ bill }: { bill: Bill }) {
  const isGst = bill.billCategory === "gst";
  const items = bill.items ?? [];
  return (
    <div id="invoice-preview" className="bg-white text-gray-800 font-sans text-sm" style={{ width: "100%", minHeight: 800, padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#292e4e", letterSpacing: -1 }}>
            {isGst ? "GST INVOICE" : "INVOICE"}
          </div>
          <div style={{ color: "#64748b", marginTop: 4 }}>#{bill.billNumber}</div>
          {isGst && bill.sellerGstNumber && (
            <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>GSTIN: {bill.sellerGstNumber}</div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{bill.sellerName || "Your Business"}</div>
          {bill.sellerAddress && <div style={{ color: "#64748b", fontSize: 12 }}>{bill.sellerAddress}</div>}
          {bill.sellerPhone && <div style={{ color: "#64748b", fontSize: 12 }}>{bill.sellerPhone}</div>}
          {bill.sellerEmail && <div style={{ color: "#64748b", fontSize: 12 }}>{bill.sellerEmail}</div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#292e4e", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Bill To</div>
          <div style={{ fontWeight: 600 }}>{bill.clientName || "—"}</div>
          {bill.clientAddress && <div style={{ color: "#64748b", fontSize: 12 }}>{bill.clientAddress}</div>}
          {bill.clientPhone && <div style={{ color: "#64748b", fontSize: 12 }}>{bill.clientPhone}</div>}
          {bill.clientEmail && <div style={{ color: "#64748b", fontSize: 12 }}>{bill.clientEmail}</div>}
          {isGst && bill.clientGstNumber && <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>GSTIN: {bill.clientGstNumber}</div>}
        </div>
        <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#292e4e", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Invoice Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
            <span style={{ color: "#64748b", fontSize: 12 }}>Date:</span><span style={{ fontSize: 12 }}>{bill.issueDate}</span>
            {bill.dueDate && <><span style={{ color: "#64748b", fontSize: 12 }}>Due:</span><span style={{ fontSize: 12 }}>{bill.dueDate}</span></>}
            <span style={{ color: "#64748b", fontSize: 12 }}>Status:</span><span style={{ fontSize: 12, textTransform: "capitalize" }}>{bill.status}</span>
            {bill.subject && <><span style={{ color: "#64748b", fontSize: 12 }}>Subject:</span><span style={{ fontSize: 12 }}>{bill.subject}</span></>}
          </div>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ background: "#292e4e", color: "white" }}>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>#</th>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Description</th>
            {isGst && <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700 }}>HSN</th>}
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>Qty</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>Rate</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>Amount</th>
            {isGst && !bill.isInterstate && <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>CGST</th>}
            {isGst && !bill.isInterstate && <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>SGST</th>}
            {isGst && bill.isInterstate && <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>IGST</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 0 ? "white" : "#f8fafc" }}>
              <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748b" }}>{i + 1}</td>
              <td style={{ padding: "10px 12px", fontSize: 12 }}>{item.description}{item.unit ? <span style={{ color: "#94a3b8" }}> / {item.unit}</span> : ""}</td>
              {isGst && <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748b" }}>{item.hsn || "—"}</td>}
              <td style={{ padding: "10px 12px", fontSize: 12, textAlign: "right" }}>{item.quantity}</td>
              <td style={{ padding: "10px 12px", fontSize: 12, textAlign: "right" }}>{fmt(item.unitPrice, bill.currency)}</td>
              <td style={{ padding: "10px 12px", fontSize: 12, textAlign: "right", fontWeight: 600 }}>{fmt(item.amount, bill.currency)}</td>
              {isGst && !bill.isInterstate && <td style={{ padding: "10px 12px", fontSize: 12, textAlign: "right", color: "#64748b" }}>{fmt(item.cgstAmount, bill.currency)}</td>}
              {isGst && !bill.isInterstate && <td style={{ padding: "10px 12px", fontSize: 12, textAlign: "right", color: "#64748b" }}>{fmt(item.sgstAmount, bill.currency)}</td>}
              {isGst && bill.isInterstate && <td style={{ padding: "10px 12px", fontSize: 12, textAlign: "right", color: "#64748b" }}>{fmt(item.igstAmount, bill.currency)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280 }}>
          {[
            ["Subtotal", fmt(bill.subtotal, bill.currency)],
            ...(bill.discountAmount > 0 ? [["Discount", `-${fmt(bill.discountAmount, bill.currency)}`]] : []),
            ...(isGst && !bill.isInterstate ? [
              [`CGST (${bill.cgstRate}%)`, fmt(bill.cgstAmount, bill.currency)],
              [`SGST (${bill.sgstRate}%)`, fmt(bill.sgstAmount, bill.currency)],
            ] : []),
            ...(isGst && bill.isInterstate ? [[`IGST (${bill.igstRate}%)`, fmt(bill.igstAmount, bill.currency)]] : []),
            ...(!isGst && bill.taxAmount > 0 ? [[`Tax (${bill.taxRate}%)`, fmt(bill.taxAmount, bill.currency)]] : []),
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
              <span style={{ color: "#64748b" }}>{label}</span>
              <span>{value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "2px solid #292e4e", marginTop: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: "#292e4e" }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#4f46e5" }}>{fmt(bill.totalAmount, bill.currency)}</span>
          </div>
        </div>
      </div>

      {(bill.notes || bill.terms) && (
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {bill.notes && <div><div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "#292e4e", marginBottom: 6 }}>Notes</div><div style={{ fontSize: 12, color: "#64748b" }}>{bill.notes}</div></div>}
          {bill.terms && <div><div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "#292e4e", marginBottom: 6 }}>Terms & Conditions</div><div style={{ fontSize: 12, color: "#64748b" }}>{bill.terms}</div></div>}
        </div>
      )}

      <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
        Thank you for your business! · Generated by BizAuto
      </div>
    </div>
  );
}

function ShareButtons({ bill }: { bill: Bill }) {
  const summary = `Invoice ${bill.billNumber}
Client: ${bill.clientName || "—"}
Amount: ${fmt(bill.totalAmount, bill.currency)}
Due: ${bill.dueDate || "—"}
Status: ${bill.status}`;

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`);
  };
  const handleEmail = () => {
    const subject = encodeURIComponent(`Invoice ${bill.billNumber}`);
    const body = encodeURIComponent(summary);
    const to = bill.clientEmail ?? "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };
  const handleSMS = () => {
    const body = encodeURIComponent(summary);
    const to = bill.clientPhone ?? "";
    window.location.href = `sms:${to}?body=${body}`;
  };
  const handleTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent("BizAuto")}&text=${encodeURIComponent(summary)}`);
  };

  const btns = [
    { label: "WhatsApp", emoji: "💬", color: "bg-green-600 hover:bg-green-700", fn: handleWhatsApp },
    { label: "Email", emoji: "✉️", color: "bg-blue-600 hover:bg-blue-700", fn: handleEmail },
    { label: "SMS", emoji: "📱", color: "bg-slate-700 hover:bg-slate-800", fn: handleSMS },
    { label: "Telegram", emoji: "✈️", color: "bg-sky-500 hover:bg-sky-600", fn: handleTelegram },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {btns.map(b => (
        <button key={b.label} onClick={b.fn}
          className={`flex items-center gap-2 justify-center px-3 py-2 rounded-xl text-white text-sm font-medium transition-all ${b.color}`}>
          <span>{b.emoji}</span> {b.label}
        </button>
      ))}
    </div>
  );
}

function BillDetailSheet({ bill: initialBill, open, onClose, onUpdate }: { bill: Bill | null; open: boolean; onClose: () => void; onUpdate: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const previewRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  const { data: bill } = useQuery<Bill>({
    queryKey: ["bill", initialBill?.id],
    queryFn: () => apiFetch(`/bills/${initialBill!.id}`),
    enabled: !!initialBill && open,
    initialData: initialBill ?? undefined,
  });

  const handlePdf = async () => {
    const el = document.getElementById("invoice-preview");
    if (!el) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(`${bill?.billNumber ?? "invoice"}.pdf`);
      toast({ title: "PDF downloaded" });
    } catch (e: any) {
      toast({ title: "PDF failed", description: e.message, variant: "destructive" });
    }
    setDownloading(false);
  };

  const handleStatusUpdate = async () => {
    if (!bill || !newStatus || newStatus === "") return;
    try {
      await apiFetch(`/bills/${bill.id}/status`, { method: "PUT", body: JSON.stringify({ status: newStatus }) });
      toast({ title: "Status updated", description: `Invoice marked as ${newStatus.replace("_", " ")}` });
      setNewStatus("");
      qc.invalidateQueries({ queryKey: ["bill", bill.id] });
      qc.invalidateQueries({ queryKey: ["bills"] });
      onUpdate();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!bill || !confirm("Delete this invoice? This cannot be undone.")) return;
    try {
      await apiFetch(`/bills/${bill.id}`, { method: "DELETE" });
      toast({ title: "Invoice deleted" });
      onUpdate();
      onClose();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  if (!bill) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col overflow-hidden" side="right">
        <SheetHeader className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg font-display">#{bill.billNumber}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={`capitalize text-xs ${STATUS_COLORS[bill.status]}`}>{bill.status.replace("_", " ")}</Badge>
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 capitalize">
                  {bill.billCategory === "gst" ? "GST Invoice" : "Normal Invoice"}
                </Badge>
                <span className="text-xs text-muted-foreground">{bill.clientName}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{fmt(bill.totalAmount, bill.currency)}</div>
              <div className="text-xs text-muted-foreground">{bill.issueDate}</div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 border-b bg-slate-50 flex flex-wrap gap-2 items-center">
            <Button onClick={handlePdf} disabled={downloading} size="sm" className="rounded-xl gap-2 bg-primary/90">
              <Download className="h-3.5 w-3.5" /> {downloading ? "Generating..." : "Download PDF"}
            </Button>
            <Button onClick={() => window.print()} variant="outline" size="sm" className="rounded-xl gap-2">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                className="text-xs rounded-xl border border-input bg-white px-3 py-2">
                <option value="">Update Status...</option>
                {["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled"].map(s => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
              <Button size="sm" className="rounded-xl" disabled={!newStatus} onClick={handleStatusUpdate}>Apply</Button>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-6 py-4 border-b">
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5" /> Share Invoice
            </div>
            <ShareButtons bill={bill} />
          </div>

          <div ref={previewRef} className="px-2 py-4">
            <InvoicePreview bill={bill} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const DEFAULT_FORM = () => ({
  billCategory: "normal" as "normal" | "gst",
  billType: "invoice" as const,
  status: "draft" as const,
  currency: "INR",
  issueDate: new Date().toISOString().split("T")[0],
  dueDate: "",
  subject: "",
  notes: "",
  terms: "",
  clientId: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  clientAddress: "",
  clientGstNumber: "",
  sellerName: "",
  sellerAddress: "",
  sellerPhone: "",
  sellerEmail: "",
  sellerGstNumber: "",
  taxRate: 0,
  discountAmount: 0,
  isInterstate: false,
  items: [newItem()] as BillItem[],
});

function CreateBillForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [form, setForm] = useState(DEFAULT_FORM());
  const [clientSearch, setClientSearch] = useState("");
  const [showClientList, setShowClientList] = useState(false);
  const { toast } = useToast();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => apiFetch("/clients"),
  });

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  const isGst = form.billCategory === "gst";

  const selectClient = (c: Client) => {
    setForm(f => ({
      ...f,
      clientId: String(c.id),
      clientName: c.name,
      clientEmail: c.email ?? "",
      clientPhone: c.phone ?? "",
      clientAddress: [c.address, c.city, c.country].filter(Boolean).join(", "),
    }));
    setClientSearch(c.name);
    setShowClientList(false);
  };

  const setItem = (idx: number, patch: Partial<BillItem>) => {
    setForm(f => {
      const updated = f.items.map((item, i) => {
        if (i !== idx) return item;
        const merged = { ...item, ...patch };
        return calcItem(merged, isGst, f.isInterstate);
      });
      return { ...f, items: updated };
    });
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, newItem()] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const items = form.items.map(item => calcItem(item, isGst, form.isInterstate));
  const totals = calcTotals(items, form.discountAmount, form.taxRate, isGst, form.isInterstate, form.taxRate / 2, form.taxRate / 2, form.taxRate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.issueDate) { toast({ title: "Issue date is required", variant: "destructive" }); return; }
    if (items.length === 0 || !items[0].description) { toast({ title: "At least one item is required", variant: "destructive" }); return; }

    try {
      await apiFetch("/bills", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          items,
          ...totals,
          cgstRate: isGst ? form.taxRate / 2 : 0,
          sgstRate: isGst ? form.taxRate / 2 : 0,
          igstRate: isGst ? form.taxRate : 0,
          taxAmount: totals.taxAmount,
        }),
      });
      toast({ title: "Invoice created!", description: "Your invoice has been saved." });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast({ title: "Failed to create invoice", description: e.message, variant: "destructive" });
    }
  };

  const inp = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <div className="flex items-center gap-3 p-1 bg-slate-100 rounded-xl">
          {(["normal", "gst"] as const).map(t => (
            <button key={t} type="button" onClick={() => setForm(f => ({ ...f, billCategory: t }))}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${form.billCategory === t ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}>
              {t === "normal" ? "📄 Normal Invoice" : "🏦 GST Invoice"}
            </button>
          ))}
        </div>

        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Client</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); setShowClientList(true); }}
              onFocus={() => setShowClientList(true)}
              placeholder="Search or type client name..."
              className={`${inp} pl-9`} />
            {showClientList && clientSearch && filteredClients.length > 0 && (
              <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredClients.slice(0, 8).map(c => (
                  <button key={c.id} type="button" onClick={() => selectClient(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {c.name[0]}
                    </div>
                    <div>
                      <div className="font-medium">{c.name}</div>
                      {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div><Label className="text-xs">Client Name</Label>
              <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className={`mt-1 ${inp}`} placeholder="Full name" /></div>
            <div><Label className="text-xs">Client Email</Label>
              <input value={form.clientEmail} onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))} className={`mt-1 ${inp}`} placeholder="email@company.com" /></div>
            <div><Label className="text-xs">Client Phone</Label>
              <input value={form.clientPhone} onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))} className={`mt-1 ${inp}`} placeholder="+1 234 567 8900" /></div>
            <div><Label className="text-xs">Client Address</Label>
              <input value={form.clientAddress} onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))} className={`mt-1 ${inp}`} placeholder="City, Country" /></div>
            {isGst && (
              <div className="col-span-2"><Label className="text-xs">Client GSTIN</Label>
                <input value={form.clientGstNumber} onChange={e => setForm(f => ({ ...f, clientGstNumber: e.target.value }))} className={`mt-1 ${inp}`} placeholder="22AAAAA0000A1Z5" /></div>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Your Business (Seller)</div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Business Name</Label>
              <input value={form.sellerName} onChange={e => setForm(f => ({ ...f, sellerName: e.target.value }))} className={`mt-1 ${inp}`} placeholder="Your company name" /></div>
            <div><Label className="text-xs">Email</Label>
              <input value={form.sellerEmail} onChange={e => setForm(f => ({ ...f, sellerEmail: e.target.value }))} className={`mt-1 ${inp}`} placeholder="billing@yourcompany.com" /></div>
            <div><Label className="text-xs">Phone</Label>
              <input value={form.sellerPhone} onChange={e => setForm(f => ({ ...f, sellerPhone: e.target.value }))} className={`mt-1 ${inp}`} /></div>
            <div><Label className="text-xs">Address</Label>
              <input value={form.sellerAddress} onChange={e => setForm(f => ({ ...f, sellerAddress: e.target.value }))} className={`mt-1 ${inp}`} /></div>
            {isGst && (
              <div className="col-span-2"><Label className="text-xs">Your GSTIN</Label>
                <input value={form.sellerGstNumber} onChange={e => setForm(f => ({ ...f, sellerGstNumber: e.target.value }))} className={`mt-1 ${inp}`} placeholder="29AAAAA0000A1Z5" /></div>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Invoice Details</div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Issue Date *</Label>
              <input type="date" required value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} className={`mt-1 ${inp}`} /></div>
            <div><Label className="text-xs">Due Date</Label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={`mt-1 ${inp}`} /></div>
            <div><Label className="text-xs">Currency</Label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={`mt-1 ${inp}`}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="col-span-2"><Label className="text-xs">Subject / Description</Label>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={`mt-1 ${inp}`} placeholder="What is this invoice for?" /></div>
            <div><Label className="text-xs">Status</Label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} className={`mt-1 ${inp}`}>
                {["draft", "sent"].map(s => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Line Items</div>
            <Button type="button" size="sm" variant="outline" onClick={addItem} className="rounded-xl gap-1.5 text-xs h-7">
              <Plus className="h-3 w-3" /> Add Item
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 rounded-xl">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 rounded-l-xl">Description</th>
                  {isGst && <th className="text-left px-2 py-2 text-xs font-semibold text-slate-600">HSN</th>}
                  <th className="text-right px-2 py-2 text-xs font-semibold text-slate-600 w-16">Qty</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold text-slate-600 w-24">Rate</th>
                  {isGst && <th className="text-right px-2 py-2 text-xs font-semibold text-slate-600 w-20">GST%</th>}
                  {!isGst && <th className="text-right px-2 py-2 text-xs font-semibold text-slate-600 w-20">Tax%</th>}
                  <th className="text-right px-2 py-2 text-xs font-semibold text-slate-600 w-28">Amount</th>
                  <th className="w-8 rounded-r-xl"></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, i) => {
                  const computed = calcItem(item, isGst, form.isInterstate);
                  return (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-1 py-1.5">
                        <input value={item.description} onChange={e => setItem(i, { description: e.target.value })}
                          className={inp} placeholder="Item description..." />
                      </td>
                      {isGst && (
                        <td className="px-1 py-1.5 w-24">
                          <input value={item.hsn ?? ""} onChange={e => setItem(i, { hsn: e.target.value })}
                            className={inp} placeholder="HSN/SAC" />
                        </td>
                      )}
                      <td className="px-1 py-1.5 w-16">
                        <input type="number" min="0" value={item.quantity} onChange={e => setItem(i, { quantity: parseFloat(e.target.value) || 0 })}
                          className={`${inp} text-right`} />
                      </td>
                      <td className="px-1 py-1.5 w-24">
                        <input type="number" min="0" value={item.unitPrice} onChange={e => setItem(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                          className={`${inp} text-right`} />
                      </td>
                      <td className="px-1 py-1.5 w-20">
                        <input type="number" min="0" max="100" value={item.taxRate} onChange={e => setItem(i, { taxRate: parseFloat(e.target.value) || 0 })}
                          className={`${inp} text-right`} />
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-700 w-28">
                        {computed.amount.toFixed(2)}
                        {isGst && !form.isInterstate && <div className="text-[10px] text-slate-400">+{(computed.cgstAmount + computed.sgstAmount).toFixed(2)} GST</div>}
                        {isGst && form.isInterstate && <div className="text-[10px] text-slate-400">+{computed.igstAmount.toFixed(2)} IGST</div>}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        {form.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(i)} className="text-rose-400 hover:text-rose-600 transition-colors p-1">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {isGst && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <input type="checkbox" id="interstate" checked={form.isInterstate} onChange={e => setForm(f => ({ ...f, isInterstate: e.target.checked }))} className="rounded" />
            <label htmlFor="interstate" className="text-sm font-medium text-amber-800 cursor-pointer">
              Interstate Supply (IGST instead of CGST+SGST)
            </label>
          </div>
        )}

        {!isGst && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Tax Rate (%)</Label>
              <input type="number" min="0" max="100" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))} className={`mt-1 ${inp}`} /></div>
            <div><Label className="text-xs">Discount Amount</Label>
              <input type="number" min="0" value={form.discountAmount} onChange={e => setForm(f => ({ ...f, discountAmount: parseFloat(e.target.value) || 0 }))} className={`mt-1 ${inp}`} /></div>
          </div>
        )}

        {isGst && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">GST Rate (% per item)</Label>
              <input type="number" min="0" max="100" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))} className={`mt-1 ${inp}`} placeholder="18" /></div>
            <div><Label className="text-xs">Discount Amount</Label>
              <input type="number" min="0" value={form.discountAmount} onChange={e => setForm(f => ({ ...f, discountAmount: parseFloat(e.target.value) || 0 }))} className={`mt-1 ${inp}`} /></div>
          </div>
        )}

        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span><span className="font-medium">{fmt(totals.subtotal, form.currency)}</span>
          </div>
          {form.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Discount</span><span className="text-rose-600">-{fmt(form.discountAmount, form.currency)}</span>
            </div>
          )}
          {isGst && !form.isInterstate && totals.cgstAmount > 0 && <>
            <div className="flex justify-between text-sm text-slate-600"><span>CGST ({form.taxRate / 2}%)</span><span>{fmt(totals.cgstAmount, form.currency)}</span></div>
            <div className="flex justify-between text-sm text-slate-600"><span>SGST ({form.taxRate / 2}%)</span><span>{fmt(totals.sgstAmount, form.currency)}</span></div>
          </>}
          {isGst && form.isInterstate && totals.igstAmount > 0 && (
            <div className="flex justify-between text-sm text-slate-600"><span>IGST ({form.taxRate}%)</span><span>{fmt(totals.igstAmount, form.currency)}</span></div>
          )}
          {!isGst && totals.taxAmount > 0 && (
            <div className="flex justify-between text-sm text-slate-600"><span>Tax ({form.taxRate}%)</span><span>{fmt(totals.taxAmount, form.currency)}</span></div>
          )}
          <div className="flex justify-between border-t border-primary/20 pt-2 mt-1">
            <span className="font-bold text-primary">Total</span>
            <span className="text-2xl font-bold text-primary">{fmt(totals.totalAmount, form.currency)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Notes</Label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`mt-1 ${inp} min-h-[70px]`} placeholder="Thank you for your business..." /></div>
          <div><Label className="text-xs">Terms & Conditions</Label>
            <textarea value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} className={`mt-1 ${inp} min-h-[70px]`} placeholder="Payment due within 30 days..." /></div>
        </div>
      </div>

      <div className="border-t px-6 py-4 flex gap-3 bg-white shrink-0">
        <Button type="button" variant="outline" className="rounded-xl flex-1" onClick={onClose}>Cancel</Button>
        <Button type="submit" className="rounded-xl flex-1 bg-primary">
          <FileText className="mr-2 h-4 w-4" /> Create Invoice
        </Button>
      </div>
    </form>
  );
}

const STATUS_FILTERS = ["all", "draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled"];

export default function Bills() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: bills = [], isLoading, refetch } = useQuery<Bill[]>({
    queryKey: ["bills"],
    queryFn: () => apiFetch("/bills"),
  });

  const filtered = bills.filter(b => {
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    const matchSearch = (b.billNumber + (b.clientName ?? "") + (b.subject ?? "")).toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const summary = {
    total: bills.length,
    totalValue: bills.reduce((s, b) => s + b.totalAmount, 0),
    paid: bills.filter(b => b.status === "paid").reduce((s, b) => s + b.totalAmount, 0),
    outstanding: bills.filter(b => !["paid", "cancelled"].includes(b.status)).reduce((s, b) => s + (b.totalAmount - b.paidAmount), 0),
    overdue: bills.filter(b => b.status === "overdue").length,
    gst: bills.filter(b => b.billCategory === "gst").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills & Invoices"
        description="Create Normal and GST invoices, generate PDFs and share with clients."
        action={
          <Button onClick={() => setCreateOpen(true)} className="rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all gap-2">
            <Plus className="h-4 w-4" /> Create Invoice
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Bills", value: summary.total, color: "text-primary", bg: "bg-primary/10" },
          { label: "Total Invoiced", value: fmt(summary.totalValue), color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Paid", value: fmt(summary.paid), color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Outstanding", value: fmt(summary.outstanding), color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Overdue", value: summary.overdue, color: "text-rose-600", bg: "bg-rose-50" },
          { label: "GST Bills", value: summary.gst, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bills..."
            className="pl-9 rounded-xl bg-white border-slate-200 shadow-sm" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${statusFilter === s ? "bg-primary text-white shadow-sm" : "bg-white border border-border text-slate-600 hover:bg-slate-50"}`}>
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading invoices...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">No invoices found</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first invoice to get started</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border/50">
              <tr>
                {["Invoice #", "Client", "Type", "Date", "Due Date", "Amount", "Status", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(bill => (
                <tr key={bill.id} onClick={() => setSelectedBill(bill)} className="border-b border-border/30 hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{bill.billNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{bill.clientName || "—"}</div>
                    {bill.subject && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{bill.subject}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs capitalize ${bill.billCategory === "gst" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      {bill.billCategory === "gst" ? "GST" : "Normal"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{bill.issueDate}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{bill.dueDate || "—"}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{fmt(bill.totalAmount, bill.currency)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`capitalize text-xs ${STATUS_COLORS[bill.status]}`}>
                      {bill.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => setSelectedBill(bill)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl h-[90vh] p-0 flex flex-col rounded-2xl overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <DialogTitle className="font-display text-xl">Create New Invoice</DialogTitle>
          </DialogHeader>
          <CreateBillForm onSuccess={refetch} onClose={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <BillDetailSheet
        bill={selectedBill}
        open={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        onUpdate={() => { refetch(); }}
      />
    </div>
  );
}
