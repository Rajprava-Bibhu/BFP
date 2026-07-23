import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Building2, Phone, Mail, Globe, Search, Plus, Eye, Pencil, Trash2,
  MessageCircle, FileText, FolderOpen, BarChart3, CalendarDays, Filter,
  PhoneCall, Video, MessageSquare, Download, Upload, X,
  MapPin, Hash, Loader2, TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
type Client = {
  id: number; clientCode?: string; name: string; company?: string; contactPerson?: string;
  email?: string; phone?: string; whatsapp?: string; address?: string; city?: string;
  state?: string; country?: string; gstNumber?: string; website?: string;
  status: "active" | "inactive" | "prospect" | "churned"; notes?: string;
  createdAt: string; updatedAt: string;
};
type Interaction = {
  id: number; clientId: number; interactionType: string; interactionDate: string;
  notes?: string; nextFollowupDate?: string; createdAt: string;
};
type ClientDocument = {
  id: number; clientId: number; fileName: string; fileUrl: string;
  fileType: string; fileSize?: number; createdAt: string;
};
type Project = {
  id: number; name: string; status: string; progress: number; priority: string;
};
type Stats = { total: number; active: number; inactive: number; prospect: number };

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
  prospect: "bg-blue-100 text-blue-700 border-blue-200",
  churned:  "bg-red-100 text-red-600 border-red-200",
};
const INTERACTION_ICONS: Record<string, any> = {
  call: PhoneCall, email: Mail, meeting: Video, whatsapp: MessageSquare, followup: CalendarDays,
};
const INTERACTION_COLORS: Record<string, string> = {
  call: "text-blue-600 bg-blue-50", email: "text-violet-600 bg-violet-50",
  meeting: "text-teal-600 bg-teal-50", whatsapp: "text-green-600 bg-green-50",
  followup: "text-orange-600 bg-orange-50",
};
const BLANK_CLIENT: Partial<Client> = {
  name: "", company: "", contactPerson: "", email: "", phone: "", whatsapp: "",
  address: "", city: "", state: "", country: "", gstNumber: "", website: "",
  status: "active", notes: "",
};
const BLANK_INTERACTION = { interactionType: "call", interactionDate: "", notes: "", nextFollowupDate: "" };

const fmtDate = (d?: string) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
};
const fileToB64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-display font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Clients() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Client>>(BLANK_CLIENT);
  const [editId, setEditId] = useState<number | null>(null);
  const [profileClient, setProfileClient] = useState<Client | null>(null);
  const [profileTab, setProfileTab] = useState("overview");
  const [interactionForm, setInteractionForm] = useState(BLANK_INTERACTION);
  const [addingInteraction, setAddingInteraction] = useState(false);
  const [docUploading, setDocUploading] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => apiFetch("/clients"),
  });
  const { data: stats = { total: 0, active: 0, inactive: 0, prospect: 0 } } = useQuery<Stats>({
    queryKey: ["clients-stats"],
    queryFn: () => apiFetch("/clients/stats"),
  });
  const { data: interactions = [], isLoading: loadingInteractions } = useQuery<Interaction[]>({
    queryKey: ["client-interactions", profileClient?.id],
    queryFn: () => apiFetch(`/clients/${profileClient!.id}/interactions`),
    enabled: !!profileClient && profileTab === "interactions",
  });
  const { data: documents = [], isLoading: loadingDocs } = useQuery<ClientDocument[]>({
    queryKey: ["client-documents", profileClient?.id],
    queryFn: () => apiFetch(`/clients/${profileClient!.id}/documents`),
    enabled: !!profileClient && profileTab === "documents",
  });
  const { data: linkedProjects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ["client-projects", profileClient?.id],
    queryFn: () => apiFetch(`/clients/${profileClient!.id}/projects`),
    enabled: !!profileClient && profileTab === "projects",
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const upsertClient = useMutation({
    mutationFn: (data: Partial<Client>) =>
      editId
        ? apiFetch(`/clients/${editId}`, { method: "PUT", body: JSON.stringify(data) })
        : apiFetch("/clients", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-stats"] });
      setModalOpen(false);
      setForm(BLANK_CLIENT);
      setEditId(null);
      toast({ title: editId ? "Client updated" : "Client added successfully" });
    },
    onError: () => toast({ title: "Failed to save client", variant: "destructive" }),
  });

  const deleteClient = useMutation({
    mutationFn: (id: number) => apiFetch(`/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-stats"] });
      toast({ title: "Client removed" });
    },
    onError: () => toast({ title: "Failed to delete client", variant: "destructive" }),
  });

  const addInteraction = useMutation({
    mutationFn: (data: typeof BLANK_INTERACTION) =>
      apiFetch(`/clients/${profileClient!.id}/interactions`, {
        method: "POST", body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-interactions", profileClient?.id] });
      setInteractionForm(BLANK_INTERACTION);
      setAddingInteraction(false);
      toast({ title: "Interaction recorded" });
    },
    onError: () => toast({ title: "Failed to add interaction", variant: "destructive" }),
  });

  const deleteInteraction = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/clients/${profileClient!.id}/interactions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-interactions", profileClient?.id] }),
  });

  const deleteDoc = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/clients/${profileClient!.id}/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-documents", profileClient?.id] }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileClient) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large (max 10MB)", variant: "destructive" });
      return;
    }
    setDocUploading(true);
    try {
      const fileUrl = await fileToB64(file);
      await apiFetch(`/clients/${profileClient.id}/documents`, {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileUrl, fileType: file.type, fileSize: file.size }),
      });
      qc.invalidateQueries({ queryKey: ["client-documents", profileClient.id] });
      toast({ title: "Document uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setDocUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openEdit = (c: Client) => { setForm({ ...c }); setEditId(c.id); setModalOpen(true); };
  const openAdd = () => { setForm(BLANK_CLIENT); setEditId(null); setModalOpen(true); };

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || c.name.toLowerCase().includes(q)
      || (c.company ?? "").toLowerCase().includes(q)
      || (c.email ?? "").toLowerCase().includes(q)
      || (c.phone ?? "").includes(q);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Form field helper ──────────────────────────────────────────────────────
  const F = ({ fkey, label, type = "text", span2 = false, placeholder = "" }: {
    fkey: keyof Client; label: string; type?: string; span2?: boolean; placeholder?: string;
  }) => (
    <div className={span2 ? "col-span-2" : ""}>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      {type === "textarea" ? (
        <Textarea
          value={(form as any)[fkey] ?? ""}
          onChange={e => setForm(p => ({ ...p, [fkey]: e.target.value }))}
          className="rounded-xl text-sm" rows={3} placeholder={placeholder}
        />
      ) : (
        <Input
          type={type} value={(form as any)[fkey] ?? ""}
          onChange={e => setForm(p => ({ ...p, [fkey]: e.target.value }))}
          className="rounded-xl text-sm h-9" placeholder={placeholder}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Management"
        description="Manage clients, interactions, projects, and documents."
        action={
          <Button onClick={openAdd} className="rounded-xl bg-primary text-white gap-2 shadow-sm">
            <Plus className="h-4 w-4" /> Add Client
          </Button>
        }
      />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients" value={stats.total}    icon={Users}     color="text-primary bg-primary/10" />
        <StatCard label="Active"         value={stats.active}   icon={TrendingUp} color="text-emerald-600 bg-emerald-50" />
        <StatCard label="Inactive"        value={stats.inactive} icon={Users}     color="text-slate-600 bg-slate-100" />
        <StatCard label="Prospects"       value={stats.prospect} icon={BarChart3} color="text-blue-600 bg-blue-50" />
      </div>

      {/* ── Search & Filter ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, company, email, or phone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 rounded-xl h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 rounded-xl h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="churned">Churned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Client Table ── */}
      <Card>
        <CardHeader className="px-6 py-4 border-b border-border">
          <CardTitle className="text-base font-semibold">
            Clients <span className="text-muted-foreground font-normal text-sm ml-1">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading clients…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Users className="h-10 w-10 opacity-30" />
              <p className="font-medium">No clients found</p>
              <p className="text-sm">{search ? "Try a different search" : "Add your first client to get started"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="pl-6">Client ID</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="pl-6">
                        <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {c.clientCode ?? `CL${String(c.id).padStart(3, "0")}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 text-xs">
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                              {(c.company ?? c.name).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{c.company ?? c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.contactPerson ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.email ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.phone ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.city ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize text-xs font-medium rounded-full px-2.5 ${STATUS_COLORS[c.status]}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                            onClick={() => { setProfileClient(c); setProfileTab("overview"); }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 w-8 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 hover:text-red-600"
                            onClick={() => { if (confirm(`Remove ${c.name}?`)) deleteClient.mutate(c.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Client Modal ── */}
      <Dialog open={modalOpen} onOpenChange={v => { setModalOpen(v); if (!v) { setForm(BLANK_CLIENT); setEditId(null); } }}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editId ? "Edit Client" : "Add New Client"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <F fkey="name"          label="Client / Contact Name *" span2 />
            <F fkey="company"       label="Company Name" />
            <F fkey="contactPerson" label="Contact Person" />
            <F fkey="email"         label="Email Address" type="email" />
            <F fkey="phone"         label="Phone Number" />
            <F fkey="whatsapp"      label="WhatsApp Number" />
            <F fkey="address"       label="Address" span2 />
            <F fkey="city"          label="City" />
            <F fkey="state"         label="State" />
            <F fkey="country"       label="Country" />
            <F fkey="gstNumber"     label="GST Number" />
            <F fkey="website"       label="Website" />
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
              <Select value={form.status ?? "active"} onValueChange={v => setForm(p => ({ ...p, status: v as Client["status"] }))}>
                <SelectTrigger className="rounded-xl h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Notes</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="rounded-xl text-sm" rows={3} placeholder="Additional notes…"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              className="flex-1 rounded-xl bg-primary text-white"
              onClick={() => upsertClient.mutate(form)}
              disabled={!form.name || upsertClient.isPending}
            >
              {upsertClient.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
                : (editId ? "Save Changes" : "Add Client")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Client Profile Sheet ── */}
      <Sheet open={!!profileClient} onOpenChange={v => { if (!v) setProfileClient(null); }}>
        <SheetContent className="w-full sm:max-w-2xl p-0 overflow-hidden flex flex-col">
          {profileClient && (
            <>
              {/* Sheet header */}
              <div className="flex-shrink-0 p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
                <SheetHeader className="space-y-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-7 w-7 text-primary" />
                      </div>
                      <div>
                        <SheetTitle className="font-display text-xl leading-tight">
                          {profileClient.company ?? profileClient.name}
                        </SheetTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">{profileClient.contactPerson ?? "No contact"}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            {profileClient.clientCode ?? `CL${String(profileClient.id).padStart(3, "0")}`}
                          </span>
                          <Badge variant="outline" className={`capitalize text-xs rounded-full px-2.5 ${STATUS_COLORS[profileClient.status]}`}>
                            {profileClient.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-lg gap-1.5 text-xs shrink-0" onClick={() => openEdit(profileClient)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  </div>
                </SheetHeader>
              </div>

              {/* Tabs */}
              <Tabs value={profileTab} onValueChange={setProfileTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="flex-shrink-0 w-full rounded-none border-b bg-transparent h-auto p-0 gap-0 justify-start">
                  {[
                    { value: "overview",      label: "Overview",      icon: Building2 },
                    { value: "interactions",  label: "Interactions",  icon: MessageCircle },
                    { value: "projects",      label: "Projects",      icon: FolderOpen },
                    { value: "documents",     label: "Documents",     icon: FileText },
                  ].map(t => (
                    <TabsTrigger
                      key={t.value} value={t.value}
                      className="flex items-center gap-1.5 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent text-sm font-medium text-muted-foreground"
                    >
                      <t.icon className="h-3.5 w-3.5" />{t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Overview */}
                <TabsContent value="overview" className="flex-1 overflow-y-auto p-6 space-y-5 mt-0">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Mail, label: "Email", value: profileClient.email },
                      { icon: Phone, label: "Phone", value: profileClient.phone },
                      { icon: MessageSquare, label: "WhatsApp", value: profileClient.whatsapp },
                      { icon: Globe, label: "Website", value: profileClient.website },
                      { icon: MapPin, label: "Location", value: [profileClient.city, profileClient.state, profileClient.country].filter(Boolean).join(", ") },
                      { icon: Hash, label: "GST Number", value: profileClient.gstNumber },
                    ].map(item => item.value ? (
                      <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                        <div className="p-1.5 rounded-lg bg-white shadow-sm">
                          <item.icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                          <p className="text-sm font-medium truncate">{item.value}</p>
                        </div>
                      </div>
                    ) : null)}
                  </div>
                  {profileClient.address && (
                    <div className="p-4 rounded-xl bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Full Address</p>
                      <p className="text-sm">{profileClient.address}</p>
                    </div>
                  )}
                  {profileClient.notes && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
                      <p className="text-sm text-amber-900">{profileClient.notes}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Added {fmtDate(profileClient.createdAt)} · Last updated {fmtDate(profileClient.updatedAt)}
                  </p>
                </TabsContent>

                {/* Interactions */}
                <TabsContent value="interactions" className="flex-1 overflow-y-auto p-6 space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Interaction History</h4>
                    <Button
                      size="sm" className="rounded-lg gap-1.5 text-xs bg-primary text-white"
                      onClick={() => setAddingInteraction(v => !v)}
                    >
                      {addingInteraction ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {addingInteraction ? "Cancel" : "Log Interaction"}
                    </Button>
                  </div>

                  <AnimatePresence>
                    {addingInteraction && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <Card className="border-primary/20 bg-primary/5">
                          <CardContent className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1.5 block">Type</Label>
                                <Select
                                  value={interactionForm.interactionType}
                                  onValueChange={v => setInteractionForm(p => ({ ...p, interactionType: v }))}
                                >
                                  <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {["call", "email", "meeting", "whatsapp", "followup"].map(t => (
                                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1.5 block">Date *</Label>
                                <Input
                                  type="date" value={interactionForm.interactionDate}
                                  onChange={e => setInteractionForm(p => ({ ...p, interactionDate: e.target.value }))}
                                  className="rounded-xl h-9 text-sm"
                                />
                              </div>
                              <div className="col-span-2">
                                <Label className="text-xs text-muted-foreground mb-1.5 block">Notes</Label>
                                <Textarea
                                  value={interactionForm.notes}
                                  onChange={e => setInteractionForm(p => ({ ...p, notes: e.target.value }))}
                                  className="rounded-xl text-sm" rows={2} placeholder="What was discussed?"
                                />
                              </div>
                              <div className="col-span-2">
                                <Label className="text-xs text-muted-foreground mb-1.5 block">Next Follow-up Date</Label>
                                <Input
                                  type="date" value={interactionForm.nextFollowupDate}
                                  onChange={e => setInteractionForm(p => ({ ...p, nextFollowupDate: e.target.value }))}
                                  className="rounded-xl h-9 text-sm"
                                />
                              </div>
                            </div>
                            <Button
                              size="sm" className="w-full rounded-xl bg-primary text-white text-sm"
                              onClick={() => addInteraction.mutate(interactionForm)}
                              disabled={!interactionForm.interactionDate || addInteraction.isPending}
                            >
                              {addInteraction.isPending
                                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
                                : "Save Interaction"}
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {loadingInteractions ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : interactions.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <MessageCircle className="h-8 w-8 mx-auto opacity-30 mb-2" />
                      <p className="text-sm">No interactions yet — log the first one</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {interactions.map(i => {
                        const Icon = INTERACTION_ICONS[i.interactionType] ?? MessageCircle;
                        return (
                          <div key={i.id} className="flex gap-3 p-3 rounded-xl border border-border bg-white hover:shadow-sm transition-shadow">
                            <div className={`p-2 rounded-lg shrink-0 ${INTERACTION_COLORS[i.interactionType] ?? "text-slate-600 bg-slate-50"}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold capitalize">{i.interactionType}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{fmtDate(i.interactionDate)}</span>
                                  <Button
                                    size="sm" variant="ghost"
                                    className="h-6 w-6 p-0 rounded hover:bg-red-50 hover:text-red-600"
                                    onClick={() => deleteInteraction.mutate(i.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {i.notes && <p className="text-xs text-muted-foreground mt-0.5">{i.notes}</p>}
                              {i.nextFollowupDate && (
                                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" /> Follow-up: {fmtDate(i.nextFollowupDate)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Projects */}
                <TabsContent value="projects" className="flex-1 overflow-y-auto p-6 mt-0">
                  <h4 className="font-semibold text-sm mb-4">Projects</h4>
                  {loadingProjects ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : linkedProjects.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <FolderOpen className="h-8 w-8 mx-auto opacity-30 mb-2" />
                      <p className="text-sm">No projects found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {linkedProjects.map(p => (
                        <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-white">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{p.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="capitalize text-xs rounded-full px-2">{p.status.replace("_", " ")}</Badge>
                              <Badge variant="outline" className="capitalize text-xs rounded-full px-2">{p.priority}</Badge>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">Progress</p>
                            <p className="text-sm font-bold text-primary">{p.progress}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Documents */}
                <TabsContent value="documents" className="flex-1 overflow-y-auto p-6 space-y-4 mt-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Documents</h4>
                    <label className="cursor-pointer">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button size="sm" className="rounded-lg gap-1.5 text-xs bg-primary text-white pointer-events-none" asChild>
                        <span>
                          {docUploading
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Upload className="h-3 w-3" />}
                          {docUploading ? "Uploading…" : "Upload File"}
                        </span>
                      </Button>
                    </label>
                  </div>

                  {loadingDocs ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                      <FileText className="h-8 w-8 mx-auto opacity-30 mb-2" />
                      <p className="text-sm font-medium">No documents yet</p>
                      <p className="text-xs">Upload contracts, proposals, or invoices</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map(doc => {
                        const ext = doc.fileName.split(".").pop()?.toUpperCase() ?? "FILE";
                        const EXT_COLORS: Record<string, string> = {
                          PDF: "bg-red-100 text-red-700", DOCX: "bg-blue-100 text-blue-700",
                          DOC: "bg-blue-100 text-blue-700", PNG: "bg-green-100 text-green-700",
                          JPG: "bg-green-100 text-green-700", XLSX: "bg-emerald-100 text-emerald-700",
                        };
                        return (
                          <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white hover:shadow-sm transition-shadow">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${EXT_COLORS[ext] ?? "bg-slate-100 text-slate-600"}`}>
                              {ext}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {fmtDate(doc.createdAt)}{doc.fileSize ? ` · ${Math.round(doc.fileSize / 1024)}KB` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <a href={doc.fileUrl} download={doc.fileName} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg hover:bg-primary/10 hover:text-primary">
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </a>
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 hover:text-red-600"
                                onClick={() => { if (confirm("Delete this document?")) deleteDoc.mutate(doc.id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Supported: PDF, DOC, DOCX, PNG, JPG, XLSX · Max 10MB</p>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
