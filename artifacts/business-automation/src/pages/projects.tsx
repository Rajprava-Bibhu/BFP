import { useState, useCallback, useRef } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { useListProjects, useCreateProject, useListUsers, useListDepartments } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Briefcase, Calendar, CheckSquare, Search, Users, Paperclip, ShieldCheck,
  Trash2, FileText, Video, Mic, Archive, Image, File, X, Upload, ChevronRight,
  MoreHorizontal, Check, AlertCircle, Clock, RefreshCw, Download,
} from "lucide-react";

type ProjectMember = { id: number; userId: number; role: string; user: { id: number; firstName: string; lastName: string; email: string } };
type Task = { id: number; projectId: number; title: string; description?: string; status: string; priority: string; assigneeId?: number; assigneeName?: string; dueDate?: string; progress: number };
type Attachment = { id: number; projectId: number; taskId?: number; filename: string; fileType: string; fileSize: number; uploadedById: number; uploaderName?: string; uploadedAt: string };
type ProjectDetail = {
  id: number; name: string; description?: string; status: string; priority: string; progress: number;
  startDate?: string; endDate?: string; budget?: number; managerId?: number; managerName?: string;
  departmentId?: number; tenantId: number; taskCount: number; completedTaskCount: number;
  members: { id: number; name: string; email: string; role: string }[];
  memberCount: number; attachmentCount: number;
  approvalStatus: string; approvalRequestedAt?: string; approvedAt?: string; approvedByName?: string; approvalNote?: string;
};

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-purple-100 text-purple-700 border-purple-200",
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

const APPROVAL_COLORS: Record<string, string> = {
  not_required: "bg-slate-100 text-slate-500 border-slate-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-100 text-rose-700 border-rose-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-rose-100 text-rose-700",
};

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.startsWith("video/")) return <Video className="h-4 w-4 text-purple-500" />;
  if (type.startsWith("audio/")) return <Mic className="h-4 w-4 text-pink-500" />;
  if (type.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (type === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (type.includes("zip") || type.includes("tar")) return <Archive className="h-4 w-4 text-amber-500" />;
  return <File className="h-4 w-4 text-slate-500" />;
}

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const color = value === 100 ? "from-emerald-400 to-emerald-600" : value >= 60 ? "from-primary to-accent" : "from-amber-400 to-primary";
  return (
    <div className={`h-2 w-full bg-slate-100 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
    </div>
  );
}

function MemberAvatars({ members, max = 4 }: { members: { name: string }[]; max?: number }) {
  const shown = members.slice(0, max);
  const extra = members.length - max;
  return (
    <div className="flex -space-x-2">
      {shown.map((m, i) => (
        <Avatar key={i} className="h-6 w-6 border-2 border-white shadow-sm">
          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">{initials(m.name)}</AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <div className="h-6 w-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm">+{extra}</div>
      )}
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: ProjectDetail; onClick: () => void }) {
  return (
    <div onClick={onClick}
      className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col">
      <div className="flex justify-between items-start mb-3">
        <Badge variant="outline" className={`capitalize px-2.5 py-0.5 text-xs ${STATUS_COLORS[project.status] ?? STATUS_COLORS.planning}`}>
          {project.status.replace("_", " ")}
        </Badge>
        <Badge className={`capitalize px-2.5 py-0.5 text-xs shadow-none border-0 ${PRIORITY_COLORS[project.priority]}`}>
          {project.priority}
        </Badge>
      </div>

      <h3 className="text-base font-display font-bold text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">{project.name}</h3>
      <p className="text-xs text-muted-foreground mb-4 line-clamp-2 flex-1">{project.description || "No description provided."}</p>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-medium text-slate-600">Progress</span>
            <span className="font-bold text-primary">{project.progress}%</span>
          </div>
          <ProgressBar value={project.progress} />
        </div>

        {project.approvalStatus !== "not_required" && (
          <Badge variant="outline" className={`text-[10px] px-2 py-0 w-fit ${APPROVAL_COLORS[project.approvalStatus]}`}>
            {project.approvalStatus === "pending" ? "⏳ Approval Pending" :
              project.approvalStatus === "approved" ? "✓ Approved" : "✗ Rejected"}
          </Badge>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckSquare className="h-3.5 w-3.5" />{project.completedTaskCount}/{project.taskCount}</span>
            <span className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{project.attachmentCount}</span>
            {project.endDate && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(project.endDate).toLocaleDateString()}</span>}
          </div>
          {project.members.length > 0 && <MemberAvatars members={project.members} />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ project, refetch }: { project: ProjectDetail; refetch: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: project.name, description: project.description ?? "", status: project.status, priority: project.priority, startDate: project.startDate ?? "", endDate: project.endDate ?? "", budget: project.budget ?? "" });
  const { toast } = useToast();
  const { data: users } = useListUsers();
  const members = project.members ?? [];

  const handleSave = async () => {
    try {
      await apiFetch(`/projects/${project.id}`, { method: "PUT", body: JSON.stringify(form) });
      toast({ title: "Project updated" });
      refetch();
      setEditing(false);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    }
  };

  const addMember = async (userId: number) => {
    try {
      await apiFetch(`/projects/${project.id}/members`, { method: "POST", body: JSON.stringify({ userId, role: "member" }) });
      toast({ title: "Member added" });
      refetch();
    } catch (e: any) {
      toast({ title: "Failed to add member", description: e.message, variant: "destructive" });
    }
  };

  const removeMember = async (userId: number) => {
    try {
      await apiFetch(`/projects/${project.id}/members/${userId}`, { method: "DELETE" });
      toast({ title: "Member removed" });
      refetch();
    } catch (e: any) {
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" });
    }
  };

  const memberIds = members.map(m => m.id);
  const availableUsers = (users || []).filter((u: any) => !memberIds.includes(u.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-bold text-primary mb-0.5">{project.progress}%</div>
          <div className="text-xs text-muted-foreground">Overall Progress</div>
        </div>
        <Button variant={editing ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => editing ? handleSave() : setEditing(true)}>
          {editing ? "Save Changes" : "Edit Details"}
        </Button>
      </div>

      <ProgressBar value={project.progress} className="h-3" />

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-sm">
                {["planning", "active", "on_hold", "completed", "cancelled"].map(s => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-sm">
                {["low", "medium", "high", "critical"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div><Label className="text-xs">Name</Label>
            <Input className="mt-1 rounded-xl" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div><Label className="text-xs">Description</Label>
            <textarea className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Start Date</Label>
              <Input type="date" className="mt-1 rounded-xl" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div><Label className="text-xs">End Date</Label>
              <Input type="date" className="mt-1 rounded-xl" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div><Label className="text-xs">Budget ($)</Label>
            <Input type="number" className="mt-1 rounded-xl" value={form.budget as any} onChange={e => setForm({ ...form, budget: e.target.value as any })} />
          </div>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Status", <Badge variant="outline" className={`capitalize ${STATUS_COLORS[project.status]}`}>{project.status.replace("_", " ")}</Badge>],
            ["Priority", <Badge className={`capitalize border-0 ${PRIORITY_COLORS[project.priority]}`}>{project.priority}</Badge>],
            ["Start Date", project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"],
            ["End Date", project.endDate ? new Date(project.endDate).toLocaleDateString() : "—"],
            ["Budget", project.budget ? `₹${Number(project.budget).toLocaleString("en-IN")}` : "—"],
            ["Manager", project.managerName ?? "—"],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
              <div className="font-medium">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm flex items-center gap-2"><Users className="h-4 w-4" />Team Members ({members.length})</h4>
          {availableUsers.length > 0 && (
            <select onChange={e => { if (e.target.value) { addMember(parseInt(e.target.value)); e.target.value = ""; } }}
              className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs">
              <option value="">+ Add member</option>
              {availableUsers.map((u: any) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          )}
        </div>
        <div className="space-y-2">
          {members.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No team members yet</p>}
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">{initials(m.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{m.name}</div>
                <div className="text-[10px] text-muted-foreground capitalize">{m.role}</div>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-rose-500" onClick={() => removeMember(m.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TasksTab({ project, refetch }: { project: ProjectDetail; refetch: () => void }) {
  const { data: tasks = [], refetch: refetchTasks } = useQuery<Task[]>({
    queryKey: ["project-tasks", project.id],
    queryFn: () => apiFetch(`/projects/${project.id}/tasks`),
  });
  const { data: users } = useListUsers();
  const members = project.members ?? [];
  const [newTask, setNewTask] = useState({ title: "", description: "", priority: "medium", assigneeId: "" as any, dueDate: "" });
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const createTask = async () => {
    if (!newTask.title) return;
    try {
      await apiFetch(`/projects/${project.id}/tasks`, {
        method: "POST",
        body: JSON.stringify({ ...newTask, assigneeId: newTask.assigneeId ? parseInt(newTask.assigneeId) : null }),
      });
      setNewTask({ title: "", description: "", priority: "medium", assigneeId: "", dueDate: "" });
      setAdding(false);
      refetchTasks();
      refetch();
      toast({ title: "Task created" });
    } catch (e: any) {
      toast({ title: "Failed to create task", description: e.message, variant: "destructive" });
    }
  };

  const updateTaskProgress = async (taskId: number, progress: number) => {
    try {
      await apiFetch(`/projects/${project.id}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ progress }) });
      refetchTasks();
      refetch();
    } catch (e: any) {
      toast({ title: "Failed to update", description: e.message, variant: "destructive" });
    }
  };

  const updateTaskStatus = async (taskId: number, status: string) => {
    const progress = status === "done" ? 100 : status === "in_progress" ? 50 : status === "review" ? 80 : 0;
    try {
      await apiFetch(`/projects/${project.id}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status, progress }) });
      refetchTasks();
      refetch();
    } catch (e: any) {
      toast({ title: "Failed to update", description: e.message, variant: "destructive" });
    }
  };

  const deleteTask = async (taskId: number) => {
    try {
      await apiFetch(`/projects/${project.id}/tasks/${taskId}`, { method: "DELETE" });
      refetchTasks();
      refetch();
      toast({ title: "Task deleted" });
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e.message, variant: "destructive" });
    }
  };

  const TASK_STATUS_STYLES: Record<string, string> = {
    todo: "bg-slate-100 text-slate-600",
    in_progress: "bg-blue-100 text-blue-700",
    review: "bg-amber-100 text-amber-700",
    done: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{tasks.length} Tasks</span>
        <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5" onClick={() => setAdding(!adding)}>
          <Plus className="h-3.5 w-3.5" /> Add Task
        </Button>
      </div>

      {adding && (
        <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 space-y-3">
          <Input placeholder="Task title *" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} className="rounded-xl" />
          <Input placeholder="Description (optional)" value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} className="rounded-xl" />
          <div className="grid grid-cols-3 gap-2">
            <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
              {["low", "medium", "high", "critical"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={newTask.assigneeId} onChange={e => setNewTask({ ...newTask, assigneeId: e.target.value })}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
              <option value="">Assign to...</option>
              {(users || []).map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
            <Input type="date" value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} className="rounded-xl" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="rounded-xl flex-1" onClick={createTask}>Create Task</Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tasks.length === 0 && !adding && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <CheckSquare className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            No tasks yet. Add the first one!
          </div>
        )}
        {tasks.map(task => (
          <div key={task.id} className="p-3 rounded-xl border border-border/60 bg-card hover:bg-slate-50 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate">{task.title}</span>
                  <Badge className={`text-[10px] px-1.5 py-0 border-0 shrink-0 ${TASK_STATUS_STYLES[task.status] ?? TASK_STATUS_STYLES.todo}`}>
                    {task.status.replace("_", " ")}
                  </Badge>
                  <Badge className={`text-[10px] px-1.5 py-0 border-0 shrink-0 ${PRIORITY_COLORS[task.priority]}`}>
                    {task.priority}
                  </Badge>
                </div>
                {task.description && <p className="text-xs text-muted-foreground mb-2">{task.description}</p>}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-muted-foreground shrink-0">{task.progress}%</span>
                  <div className="flex-1">
                    <Slider
                      value={[task.progress]}
                      min={0} max={100} step={5}
                      onValueCommit={([v]) => updateTaskProgress(task.id, v)}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  {task.assigneeName && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{task.assigneeName}</span>}
                  {task.dueDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(task.dueDate).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <select value={task.status} onChange={e => updateTaskStatus(task.id, e.target.value)}
                  className="text-[11px] rounded-lg border border-input bg-background px-2 py-1">
                  {["todo", "in_progress", "review", "done"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-rose-500" onClick={() => deleteTask(task.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttachmentsTab({ project, refetch }: { project: ProjectDetail; refetch: () => void }) {
  const { data: attachments = [], refetch: refetchAttachments } = useQuery<Attachment[]>({
    queryKey: ["project-attachments", project.id],
    queryFn: () => apiFetch(`/projects/${project.id}/attachments`),
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let success = 0;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: `${file.name} too large`, description: "Max file size is 10MB", variant: "destructive" });
        continue;
      }
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await apiFetch(`/projects/${project.id}/attachments`, {
          method: "POST",
          body: JSON.stringify({ filename: file.name, fileType: file.type || "application/octet-stream", fileSize: file.size, fileData: base64 }),
        });
        success++;
      } catch (e: any) {
        toast({ title: `Failed to upload ${file.name}`, description: e.message, variant: "destructive" });
      }
    }
    if (success > 0) {
      toast({ title: `${success} file${success > 1 ? "s" : ""} uploaded` });
      refetchAttachments();
      refetch();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDownload = async (a: Attachment) => {
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE}/api/projects/${project.id}/attachments/${a.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  };

  const deleteAttachment = async (id: number) => {
    try {
      await apiFetch(`/projects/${project.id}/attachments/${id}`, { method: "DELETE" });
      toast({ title: "Attachment deleted" });
      refetchAttachments();
      refetch();
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-primary/30 rounded-2xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
      >
        <input ref={fileRef} type="file" className="hidden" multiple accept="*/*" onChange={e => handleFileUpload(e.target.files)} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-primary/40" />
        <p className="text-sm font-medium text-slate-700">{uploading ? "Uploading..." : "Drop files here or click to browse"}</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, Video, Audio, Images, Documents — Max 10MB each</p>
      </div>

      <div className="space-y-2">
        {attachments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Paperclip className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            No attachments yet
          </div>
        )}
        {attachments.map(a => (
          <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:bg-slate-50 transition-colors">
            <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              {fileIcon(a.fileType)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{a.filename}</div>
              <div className="text-[11px] text-muted-foreground">{formatBytes(a.fileSize)} · {a.uploaderName ?? "Unknown"} · {new Date(a.uploadedAt).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary" onClick={() => handleDownload(a)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-rose-500" onClick={() => deleteAttachment(a.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalTab({ project, refetch }: { project: ProjectDetail; refetch: () => void }) {
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const { toast } = useToast();
  const canApprove = user && ["super_admin", "org_admin", "department_head"].includes(user.role);
  const isManager = user && (user.id === project.managerId || canApprove);

  const requestApproval = async () => {
    try {
      await apiFetch(`/projects/${project.id}/approval/request`, { method: "POST" });
      toast({ title: "Approval requested", description: "A manager will review your project." });
      refetch();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const reviewApproval = async (decision: "approved" | "rejected") => {
    try {
      await apiFetch(`/projects/${project.id}/approval/review`, { method: "POST", body: JSON.stringify({ decision, note }) });
      toast({ title: decision === "approved" ? "Project approved!" : "Project rejected", description: note || undefined });
      setNote("");
      setReviewing(false);
      refetch();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const statusConfig = {
    not_required: { icon: <AlertCircle className="h-5 w-5 text-slate-400" />, label: "No approval needed yet", color: "text-slate-500" },
    pending: { icon: <Clock className="h-5 w-5 text-amber-500" />, label: "Approval Pending Review", color: "text-amber-700" },
    approved: { icon: <Check className="h-5 w-5 text-emerald-500" />, label: "Project Approved", color: "text-emerald-700" },
    rejected: { icon: <X className="h-5 w-5 text-rose-500" />, label: "Project Rejected", color: "text-rose-700" },
  };

  const sc = statusConfig[project.approvalStatus as keyof typeof statusConfig] ?? statusConfig.not_required;

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border-2 p-5 flex items-center gap-4 ${APPROVAL_COLORS[project.approvalStatus]} border-current/20`}>
        <div className="h-12 w-12 rounded-xl bg-white/70 flex items-center justify-center shadow-sm">{sc.icon}</div>
        <div>
          <div className={`font-bold text-base ${sc.color}`}>{sc.label}</div>
          {project.approvalStatus === "pending" && project.approvalRequestedAt && (
            <div className="text-xs mt-0.5 text-amber-600">Requested {new Date(project.approvalRequestedAt).toLocaleString()}</div>
          )}
          {(project.approvalStatus === "approved" || project.approvalStatus === "rejected") && project.approvedAt && (
            <div className="text-xs mt-0.5">by {project.approvedByName ?? "Manager"} on {new Date(project.approvedAt).toLocaleString()}</div>
          )}
        </div>
      </div>

      {project.approvalNote && (
        <div className="rounded-xl border border-border p-4 bg-slate-50">
          <div className="text-xs font-semibold text-muted-foreground mb-1">Manager Note</div>
          <p className="text-sm">{project.approvalNote}</p>
        </div>
      )}

      {project.approvalStatus === "not_required" && project.progress === 100 && (
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800 mb-3">Project is at 100%! Submit for final approval.</p>
          <Button className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={requestApproval}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Request Approval
          </Button>
        </div>
      )}

      {project.approvalStatus === "not_required" && project.progress < 100 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <AlertCircle className="inline h-4 w-4 mr-2 text-slate-400" />
          Complete all tasks (reach 100% progress) to request approval.
        </div>
      )}

      {project.approvalStatus === "rejected" && (
        <Button variant="outline" className="w-full rounded-xl" onClick={requestApproval}>
          <RefreshCw className="mr-2 h-4 w-4" /> Re-submit for Approval
        </Button>
      )}

      {project.approvalStatus === "pending" && canApprove && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">Review this Project</div>
          <textarea
            placeholder="Add a note (optional)..."
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
          />
          <div className="flex gap-3">
            <Button className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => reviewApproval("approved")}>
              <Check className="mr-2 h-4 w-4" /> Approve
            </Button>
            <Button className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700" onClick={() => reviewApproval("rejected")}>
              <X className="mr-2 h-4 w-4" /> Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type Tab = "overview" | "tasks" | "attachments" | "approval";

function ProjectSheet({ project: initialProject, open, onOpenChange }: { project: ProjectDetail | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const { data: project, refetch } = useQuery<ProjectDetail>({
    queryKey: ["project-detail", initialProject?.id],
    queryFn: () => apiFetch(`/projects/${initialProject!.id}`),
    enabled: !!initialProject && open,
    initialData: initialProject ?? undefined,
  });

  if (!project) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Briefcase className="h-3.5 w-3.5" /> },
    { id: "tasks", label: `Tasks (${project.taskCount})`, icon: <CheckSquare className="h-3.5 w-3.5" /> },
    { id: "attachments", label: `Files (${project.attachmentCount})`, icon: <Paperclip className="h-3.5 w-3.5" /> },
    { id: "approval", label: "Approval", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col overflow-hidden" side="right">
        <SheetHeader className="px-6 py-5 border-b border-border/50 bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-display line-clamp-1">{project.name}</SheetTitle>
              <SheetDescription className="text-xs line-clamp-1">{project.description || "No description"}</SheetDescription>
            </div>
            <Badge variant="outline" className={`capitalize shrink-0 ${APPROVAL_COLORS[project.approvalStatus]}`}>
              {project.approvalStatus.replace("_", " ")}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex gap-1 px-6 py-3 border-b border-border/40 bg-white shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t.id ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "overview" && <OverviewTab project={project} refetch={refetch} />}
          {tab === "tasks" && <TasksTab project={project} refetch={refetch} />}
          {tab === "attachments" && <AttachmentsTab project={project} refetch={refetch} />}
          {tab === "approval" && <ApprovalTab project={project} refetch={refetch} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CreateProjectDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", status: "planning", priority: "medium", startDate: "", endDate: "", budget: "", memberIds: [] as number[] });
  const { mutateAsync, isPending } = useCreateProject();
  const { data: users } = useListUsers();
  const { data: departments } = useListDepartments();
  const [deptId, setDeptId] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await apiFetch("/projects", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          departmentId: deptId ? parseInt(deptId) : null,
          budget: form.budget ? parseFloat(form.budget) : null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        }),
      });
      toast({ title: "Project created" });
      onSuccess();
      setOpen(false);
      setForm({ name: "", description: "", status: "planning", priority: "medium", startDate: "", endDate: "", budget: "", memberIds: [] });
      setDeptId("");
    } catch (e: any) {
      toast({ title: "Failed to create", description: e.message, variant: "destructive" });
    }
  };

  const toggleMember = (id: number) => {
    setForm(f => ({ ...f, memberIds: f.memberIds.includes(id) ? f.memberIds.filter(m => m !== id) : [...f.memberIds, id] }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-semibold">Project Name *</Label>
            <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 rounded-xl" placeholder="e.g. Q2 Marketing Campaign" />
          </div>
          <div>
            <Label className="text-xs font-semibold">Description</Label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[70px]" placeholder="What is this project about?" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">Status</Label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                {["planning", "active", "on_hold"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Priority</Label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                {["low", "medium", "high", "critical"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Department</Label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="">None</option>
                {(departments || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">End Date</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Budget ($)</Label>
              <Input type="number" placeholder="0.00" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="mt-1 rounded-xl" />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold mb-2 block">Assign Team Members</Label>
            <div className="max-h-36 overflow-y-auto border border-border rounded-xl p-2 space-y-1">
              {(users || []).map((u: any) => (
                <label key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={form.memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} className="rounded" />
                  <Avatar className="h-5 w-5 shrink-0"><AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials(`${u.firstName} ${u.lastName}`)}</AvatarFallback></Avatar>
                  <span className="text-sm">{u.firstName} {u.lastName}</span>
                  <span className="text-xs text-muted-foreground ml-auto capitalize">{u.role}</span>
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="w-full rounded-xl h-11 mt-2">
            Create Project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_FILTERS = ["all", "planning", "active", "on_hold", "completed", "cancelled"];

export default function Projects() {
  const { data: projects = [], isLoading, refetch } = useListProjects();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openProject = (p: ProjectDetail) => {
    setSelectedProject(p);
    setSheetOpen(true);
  };

  const filtered = (projects as ProjectDetail[]).filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: (projects as ProjectDetail[]).length,
    active: (projects as ProjectDetail[]).filter(p => p.status === "active").length,
    completed: (projects as ProjectDetail[]).filter(p => p.status === "completed").length,
    pending: (projects as ProjectDetail[]).filter(p => p.approvalStatus === "pending").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Track and manage all organizational projects."
        action={<CreateProjectDialog onSuccess={refetch} />}
      />

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Projects", value: stats.total, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active", value: stats.active, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Completed", value: stats.completed, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Awaiting Approval", value: stats.pending, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)}
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 bg-slate-100 animate-pulse rounded-2xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-card border border-border/50 rounded-2xl">
            <Briefcase className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-lg font-semibold text-slate-700">No projects found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or create a new project</p>
          </div>
        ) : (
          filtered.map(p => <ProjectCard key={p.id} project={p as ProjectDetail} onClick={() => openProject(p as ProjectDetail)} />)
        )}
      </div>

      <ProjectSheet project={selectedProject} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
