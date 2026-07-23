import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { Package, Search, Plus, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type Item = {
  id: number;
  sku: string;
  name: string;
  description?: string;
  category: string;
  status: string;
  unit: string;
  quantityOnHand: number;
  minimumQuantity: number;
  reorderQuantity: number;
  unitCost: number;
  unitPrice: number;
  location?: string;
  supplier?: string;
  isActive: boolean;
};

const statusConfig: Record<string, { color: string; icon: any; badge: string }> = {
  in_stock: { color: "text-emerald-600", icon: CheckCircle2, badge: "bg-emerald-500" },
  low_stock: { color: "text-amber-600", icon: AlertTriangle, badge: "bg-amber-500" },
  out_of_stock: { color: "text-red-600", icon: XCircle, badge: "bg-red-500" },
  discontinued: { color: "text-slate-500", icon: XCircle, badge: "bg-slate-400" },
  on_order: { color: "text-blue-600", icon: RefreshCw, badge: "bg-blue-500" },
};

export default function Inventory() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState<Item | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [form, setForm] = useState<Partial<Item>>({ category: "other", status: "in_stock", unit: "piece", quantityOnHand: 0, minimumQuantity: 0, unitCost: 0, unitPrice: 0 });

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["inventory"],
    queryFn: () => apiFetch("/inventory"),
  });

  const createItem = useMutation({
    mutationFn: (data: Partial<Item>) => apiFetch("/inventory", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); setOpen(false); },
  });

  const restockItem = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) =>
      apiFetch(`/inventory/${id}/restock`, { method: "POST", body: JSON.stringify({ quantity }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); setRestockOpen(null); setRestockQty(""); },
  });

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: items.length,
    inStock: items.filter(i => i.status === "in_stock").length,
    lowStock: items.filter(i => i.status === "low_stock").length,
    outOfStock: items.filter(i => i.status === "out_of_stock").length,
    totalValue: items.reduce((s, i) => s + i.quantityOnHand * i.unitCost, 0),
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inventory"
        description="Manage stock levels, product catalog, and reorder alerts."
        action={
          <Button onClick={() => setOpen(true)} className="bg-primary text-white hover:bg-primary/90 rounded-xl gap-2">
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Items", value: stats.total, color: "text-primary" },
          { label: "In Stock", value: stats.inStock, color: "text-emerald-600" },
          { label: "Low Stock", value: stats.lowStock, color: "text-amber-600" },
          { label: "Out of Stock", value: stats.outOfStock, color: "text-red-600" },
          { label: "Total Value", value: `₹${stats.totalValue.toLocaleString("en-IN")}`, color: "text-blue-600" },
        ].map(s => (
          <Card key={s.label} className="border-border/50 rounded-2xl shadow-sm">
            <CardContent className="pt-6 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-display font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search items, SKU, category..." className="pl-9 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card className="border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-4">Item</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Unit Cost</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                [1,2,3].map(i => <tr key={i}>{[1,2,3,4,5,6,7,8].map(j => <td key={j} className="px-6 py-4"><div className="h-4 bg-slate-100 animate-pulse rounded"/></td>)}</tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No items found.</td></tr>
              ) : filtered.map(item => {
                const cfg = statusConfig[item.status] ?? statusConfig.in_stock;
                const StatusIcon = cfg.icon;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
                          <Package className="h-4 w-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.supplier}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-primary">{item.sku}</td>
                    <td className="px-6 py-4 capitalize text-muted-foreground">{item.category?.replace(/_/g, " ")}</td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-bold text-foreground">{item.quantityOnHand}</span>
                        <span className="text-muted-foreground text-xs"> {item.unit}</span>
                        {item.quantityOnHand <= item.minimumQuantity && item.minimumQuantity > 0 && (
                          <p className="text-[10px] text-amber-600 flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5"/>Min: {item.minimumQuantity}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">₹{item.unitCost?.toLocaleString("en-IN")}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">{item.location}</td>
                    <td className="px-6 py-4">
                      <Badge className={`${cfg.badge} text-white text-xs flex items-center gap-1 w-fit`}>
                        <StatusIcon className="h-3 w-3" />
                        {item.status?.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs px-2 gap-1" onClick={() => setRestockOpen(item)}>
                        <RefreshCw className="h-3 w-3" /> Restock
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Add Inventory Item</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Item Name *</Label>
              <Input value={form.name ?? ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">SKU *</Label>
              <Input value={form.sku ?? ""} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
              <Select value={form.category ?? "other"} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["electronics","furniture","stationery","equipment","software","vehicles","raw_materials","finished_goods","spare_parts","other"].map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g," ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Initial Qty</Label>
              <Input type="number" value={form.quantityOnHand ?? 0} onChange={e => setForm(p => ({ ...p, quantityOnHand: parseFloat(e.target.value) }))} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Min Qty</Label>
              <Input type="number" value={form.minimumQuantity ?? 0} onChange={e => setForm(p => ({ ...p, minimumQuantity: parseFloat(e.target.value) }))} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Unit Cost ($)</Label>
              <Input type="number" value={form.unitCost ?? 0} onChange={e => setForm(p => ({ ...p, unitCost: parseFloat(e.target.value) }))} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Unit Price ($)</Label>
              <Input type="number" value={form.unitPrice ?? 0} onChange={e => setForm(p => ({ ...p, unitPrice: parseFloat(e.target.value) }))} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Location</Label>
              <Input value={form.location ?? ""} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Supplier</Label>
              <Input value={form.supplier ?? ""} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} className="rounded-xl" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="flex-1 rounded-xl bg-primary text-white"
              onClick={() => createItem.mutate(form)}
              disabled={!form.name || !form.sku || createItem.isPending}
            >
              {createItem.isPending ? "Saving..." : "Add Item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={!!restockOpen} onOpenChange={() => setRestockOpen(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Restock: {restockOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Current stock: <strong>{restockOpen?.quantityOnHand}</strong> {restockOpen?.unit}</p>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Quantity to Add *</Label>
              <Input type="number" value={restockQty} onChange={e => setRestockQty(e.target.value)} className="rounded-xl" placeholder="e.g. 50" min="1" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setRestockOpen(null)}>Cancel</Button>
            <Button
              className="flex-1 rounded-xl bg-primary text-white"
              onClick={() => restockOpen && restockItem.mutate({ id: restockOpen.id, quantity: Number(restockQty) })}
              disabled={!restockQty || restockItem.isPending}
            >
              {restockItem.isPending ? "Updating..." : "Restock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
