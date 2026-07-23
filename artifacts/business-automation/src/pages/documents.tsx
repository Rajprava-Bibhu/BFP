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
import { FileText, Search, Plus, Download, CheckCircle, Clock, Archive, Shield } from "lucide-react";

type Document = {
  id: number;
  title: string;
  description?: string;
  documentType: string;
  status: string;
  accessLevel: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  version: number;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  approvedAt?: string;
};

const statusConfig: Record<string, { color: string; icon: any }> = {
  draft: { color: "bg-slate-400", icon: FileText },
  under_review: { color: "bg-amber-500", icon: Clock },
  approved: { color: "bg-emerald-500", icon: CheckCircle },
  rejected: { color: "bg-red-500", icon: FileText },
  archived: { color: "bg-slate-500", icon: Archive },
  expired: { color: "bg-red-400", icon: Clock },
};

const accessIcons: Record<string, any> = {
  private: Shield,
  department: Archive,
  organization: FileText,
  public: CheckCircle,
};

function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const typeIcons: Record<string, string> = {
  "application/pdf": "📄",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "📊",
};

export default function Documents() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Document>>({
    documentType: "other", status: "draft", accessLevel: "organization", version: 1, tags: [],
  });

  const { data: docs = [], isLoading } = useQuery<Document[]>({
    queryKey: ["documents"],
    queryFn: () => apiFetch("/documents"),
  });

  const createDoc = useMutation({
    mutationFn: (data: Partial<Document>) => apiFetch("/documents", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents"] }); setOpen(false); },
  });

  const approveDoc = useMutation({
    mutationFn: (id: number) => apiFetch(`/documents/${id}/approve`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const deleteDoc = useMutation({
    mutationFn: (id: number) => apiFetch(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const filtered = docs.filter(d =>
    (typeFilter === "all" || d.documentType === typeFilter) &&
    (d.title.toLowerCase().includes(search.toLowerCase()) ||
     d.tags?.some(t => t.toLowerCase().includes(search.toLowerCase())))
  );

  const stats = {
    total: docs.length,
    approved: docs.filter(d => d.status === "approved").length,
    pending: docs.filter(d => d.status === "under_review").length,
    drafts: docs.filter(d => d.status === "draft").length,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="Organize and manage company documents, contracts, and policies."
        action={
          <Button onClick={() => setOpen(true)} className="bg-primary text-white hover:bg-primary/90 rounded-xl gap-2">
            <Plus className="h-4 w-4" /> Upload Document
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Documents", value: stats.total, color: "text-primary" },
          { label: "Approved", value: stats.approved, color: "text-emerald-600" },
          { label: "Under Review", value: stats.pending, color: "text-amber-600" },
          { label: "Drafts", value: stats.drafts, color: "text-slate-500" },
        ].map(s => (
          <Card key={s.label} className="border-border/50 rounded-2xl shadow-sm">
            <CardContent className="pt-6 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-3xl font-display font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documents..." className="pl-9 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all","contract","policy","report","invoice","proposal","manual","other"].map(t => (
            <Button key={t} size="sm" variant={typeFilter === t ? "default" : "outline"} className={`rounded-xl capitalize ${typeFilter === t ? "bg-primary text-white" : ""}`} onClick={() => setTypeFilter(t)}>
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [1,2,3,4,5,6].map(i => <div key={i} className="h-40 bg-slate-100 animate-pulse rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-muted-foreground">No documents found.</div>
        ) : filtered.map(doc => {
          const cfg = statusConfig[doc.status] ?? statusConfig.draft;
          const StatusIcon = cfg.icon;
          const AccessIcon = accessIcons[doc.accessLevel] ?? FileText;
          const emoji = typeIcons[doc.mimeType ?? ""] ?? "📄";
          return (
            <Card key={doc.id} className="border-border/50 rounded-2xl shadow-sm hover:shadow-lg transition-all group">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-2xl shrink-0">{emoji}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">{doc.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{doc.documentType?.replace(/_/g, " ")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <Badge className={`${cfg.color} text-white text-xs flex items-center gap-1`}>
                    <StatusIcon className="h-3 w-3" /> {doc.status?.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <AccessIcon className="h-3 w-3" /> {doc.accessLevel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-4">
                  {doc.tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{tag}</span>
                  ))}
                </div>
                <div className="flex gap-2">
                  {doc.status === "under_review" && (
                    <Button size="sm" variant="outline" className="flex-1 rounded-lg h-7 text-xs text-emerald-600 border-emerald-200" onClick={() => approveDoc.mutate(doc.id)}>
                      Approve
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1 rounded-lg h-7 text-xs gap-1">
                    <Download className="h-3 w-3" /> Download
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs text-destructive hover:bg-destructive/10" onClick={() => deleteDoc.mutate(doc.id)}>
                    ×
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upload Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Register Document</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Document Title *</Label>
              <Input value={form.title ?? ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
              <Select value={form.documentType ?? "other"} onValueChange={v => setForm(p => ({ ...p, documentType: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["contract","policy","report","invoice","receipt","proposal","presentation","spreadsheet","image","certificate","agreement","manual","other"].map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Access Level</Label>
              <Select value={form.accessLevel ?? "organization"} onValueChange={v => setForm(p => ({ ...p, accessLevel: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["private","department","organization","public"].map(a => (
                    <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">File Name *</Label>
              <Input value={form.fileName ?? ""} onChange={e => setForm(p => ({ ...p, fileName: e.target.value }))} className="rounded-xl" placeholder="document.pdf" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
              <Input value={form.description ?? ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Tags (comma separated)</Label>
              <Input
                value={form.tags?.join(", ") ?? ""}
                onChange={e => setForm(p => ({ ...p, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }))}
                className="rounded-xl" placeholder="HR, Policy, Contract"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="flex-1 rounded-xl bg-primary text-white"
              onClick={() => createDoc.mutate(form)}
              disabled={!form.title || !form.fileName || createDoc.isPending}
            >
              {createDoc.isPending ? "Saving..." : "Register Document"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
