import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Share2, Heart, MessageCircle, Eye, MousePointer, TrendingUp,
  Zap, Clock, CheckCircle, Send, Mail, Phone, Upload, Trash2,
  Facebook, Instagram, Linkedin, Twitter, Youtube, Video,
  ChevronDown, ChevronUp, Calendar, Users, BarChart3,
  Globe, AlertCircle
} from "lucide-react";

type Post = {
  id: number; title: string; content?: string; caption?: string;
  platform: string; contentType: string; status: string;
  scheduledAt?: string; publishedAt?: string;
  likes: number; comments: number; shares: number;
  reach: number; impressions: number; clicks: number;
  hashtags: string[]; isBoosted: boolean; mediaUrls: string[];
  notes?: string; linkUrl?: string; callToAction?: string;
};

type Campaign = {
  id: number; name: string; type: string; subject?: string; message: string;
  recipients: string; recipientCount: number; status: string;
  scheduledAt?: string; sentAt?: string; sentCount: number; failedCount: number;
  n8nExecutionId?: string; createdAt: string;
};

type N8nConfig = {
  isEnabled: boolean; instanceUrl?: string;
  socialWebhookUrl?: string; emailWebhookUrl?: string;
  smsWebhookUrl?: string; whatsappWebhookUrl?: string;
};

const PLATFORMS = [
  { value: "facebook", label: "Facebook", Icon: Facebook, color: "bg-blue-600", text: "text-blue-600" },
  { value: "instagram", label: "Instagram", Icon: Instagram, color: "bg-pink-600", text: "text-pink-600" },
  { value: "linkedin", label: "LinkedIn", Icon: Linkedin, color: "bg-blue-700", text: "text-blue-700" },
  { value: "twitter", label: "Twitter / X", Icon: Twitter, color: "bg-sky-500", text: "text-sky-500" },
  { value: "youtube", label: "YouTube", Icon: Youtube, color: "bg-red-600", text: "text-red-600" },
];
const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map(p => [p.value, p]));

const POST_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
  scheduled: { label: "Scheduled", cls: "bg-blue-100 text-blue-700" },
  published: { label: "Published", cls: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-700" },
  archived: { label: "Archived", cls: "bg-slate-200 text-slate-500" },
};

const CAMPAIGN_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
  scheduled: { label: "Scheduled", cls: "bg-blue-100 text-blue-700" },
  running: { label: "Running", cls: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", cls: "bg-slate-200 text-slate-500" },
};

const CAMPAIGN_ICONS: Record<string, any> = { email: Mail, sms: Phone, whatsapp: MessageCircle };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Create Post Dialog ────────────────────────────────────────────────────
function CreatePostDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: "", caption: "", content: "", platform: "linkedin", contentType: "text", status: "draft", hashtags: "", scheduledAt: "", linkUrl: "", callToAction: "", notes: "" });
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const createPost = useMutation({
    mutationFn: (data: any) => apiFetch("/digital-marketing/posts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Post created", description: form.scheduledAt ? "Scheduled for later." : "Saved as draft." });
      onSuccess(); onClose();
      setForm({ title: "", caption: "", content: "", platform: "linkedin", contentType: "text", status: "draft", hashtags: "", scheduledAt: "", linkUrl: "", callToAction: "", notes: "" });
      setMediaFiles([]);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) { toast({ title: "File too large", description: `${f.name} exceeds 10MB`, variant: "destructive" }); return; }
    }
    setUploading(true);
    const base64s = await Promise.all(files.map(fileToBase64));
    setMediaFiles(prev => [...prev, ...base64s]);
    setUploading(false);
  };

  const handleSubmit = (isScheduled: boolean) => {
    const hashtagArr = form.hashtags.split(",").map(h => h.trim()).filter(Boolean);
    const status = isScheduled && form.scheduledAt ? "scheduled" : "draft";
    createPost.mutate({ ...form, hashtags: hashtagArr, status, mediaUrls: mediaFiles, scheduledAt: form.scheduledAt || null });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle className="text-lg font-semibold">Create Social Media Post</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Platform</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button key={p.value} onClick={() => setForm(f => ({ ...f, platform: p.value }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${form.platform === p.value ? `${p.color} text-white border-transparent` : "border-input bg-white text-muted-foreground hover:border-primary"}`}>
                  <p.Icon className="h-3 w-3" /> {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Post Title <span className="text-red-400">*</span></Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="rounded-xl" placeholder="Enter a title..." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Content Type</Label>
              <Select value={form.contentType} onValueChange={v => setForm(f => ({ ...f, contentType: v }))}>
                <SelectTrigger className="rounded-xl h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["text", "image", "video", "carousel", "story", "reel", "link"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Caption / Post Content</Label>
            <Textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} className="rounded-xl resize-none" rows={4} placeholder="Write your post caption or message..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Hashtags (comma separated)</Label>
              <Input value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} className="rounded-xl" placeholder="#marketing, #business" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Call to Action</Label>
              <Input value={form.callToAction} onChange={e => setForm(f => ({ ...f, callToAction: e.target.value }))} className="rounded-xl" placeholder="Shop Now, Learn More..." />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Link URL</Label>
            <Input value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} className="rounded-xl" placeholder="https://yourwebsite.com/page" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Media Upload (images/videos, max 10MB each)</Label>
            <div className="border-2 border-dashed border-input rounded-xl p-4 cursor-pointer hover:border-primary transition-colors" onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Click to upload images or videos"}
              </div>
            </div>
            {mediaFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {mediaFiles.map((url, i) => (
                  <div key={i} className="relative group">
                    {url.startsWith("data:image") ? (
                      <img src={url} alt="" className="h-16 w-16 object-cover rounded-lg" />
                    ) : (
                      <div className="h-16 w-16 bg-slate-100 rounded-lg flex items-center justify-center"><Video className="h-5 w-5 text-slate-400" /></div>
                    )}
                    <button onClick={() => setMediaFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Schedule Date & Time (optional)</Label>
            <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} className="rounded-xl" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Internal Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="rounded-xl" placeholder="Internal notes (not posted)" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
            <Button variant="outline" className="flex-1 rounded-xl" disabled={!form.title || createPost.isPending} onClick={() => handleSubmit(false)}>Save as Draft</Button>
            <Button className="flex-1 rounded-xl bg-primary text-white" disabled={!form.title || createPost.isPending} onClick={() => handleSubmit(true)}>
              {createPost.isPending ? "Saving..." : form.scheduledAt ? "Schedule Post" : "Create Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Post Card ─────────────────────────────────────────────────────────────
function PostCard({ post, onPublish, onDelete }: { post: Post; onPublish: (id: number) => void; onDelete: (id: number) => void }) {
  const plat = PLATFORM_MAP[post.platform] ?? { label: post.platform, Icon: Globe, color: "bg-slate-400", text: "text-slate-500" };
  const statusCfg = POST_STATUS[post.status] ?? POST_STATUS.draft;
  const firstImage = post.mediaUrls?.find(u => u.startsWith("data:image") || u.match(/\.(jpg|jpeg|png|gif|webp)$/i));
  return (
    <Card className="rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {firstImage && <div className="h-32 overflow-hidden"><img src={firstImage} alt="" className="w-full h-full object-cover" /></div>}
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${plat.color}`}>
              <plat.Icon className="h-3 w-3" /> {plat.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.cls}`}>{statusCfg.label}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 capitalize">{post.contentType}</span>
          </div>
          <button onClick={() => onDelete(post.id)} className="text-rose-400 hover:text-rose-600 transition-colors ml-auto flex-shrink-0">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground truncate">{post.title}</h3>
          {post.caption && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.caption}</p>}
        </div>
        {post.hashtags?.length > 0 && <p className="text-xs text-primary/70 truncate">{post.hashtags.map(h => `#${h.replace(/^#/, "")}`).join(" ")}</p>}
        {post.scheduledAt && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(post.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </div>
        )}
        {post.status === "published" && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[{ Icon: Heart, val: post.likes, label: "Likes" }, { Icon: MessageCircle, val: post.comments, label: "Comments" }, { Icon: Share2, val: post.shares, label: "Shares" }].map(({ Icon, val, label }) => (
              <div key={label} className="text-center">
                <div className="text-xs font-semibold text-foreground">{val.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-0.5"><Icon className="h-2.5 w-2.5" />{label}</div>
              </div>
            ))}
          </div>
        )}
        {(post.status === "draft" || post.status === "scheduled") && (
          <Button size="sm" className="w-full rounded-xl h-7 text-xs gap-1" onClick={() => onPublish(post.id)}>
            <Zap className="h-3 w-3" /> Publish Now
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Create Campaign Dialog ────────────────────────────────────────────────
function CreateCampaignDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [campaignType, setCampaignType] = useState<"email" | "sms" | "whatsapp">("email");
  const [form, setForm] = useState({ name: "", subject: "", message: "", recipients: "", scheduledAt: "" });
  const recipientList = form.recipients.split(/[\n,]+/).map(r => r.trim()).filter(Boolean);

  const createCampaign = useMutation({
    mutationFn: (data: any) => apiFetch("/digital-marketing/campaigns", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Campaign created", description: `${campaignType.toUpperCase()} campaign saved.` });
      onSuccess(); onClose();
      setForm({ name: "", subject: "", message: "", recipients: "", scheduledAt: "" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const typeConfig = {
    email: { color: "bg-indigo-600", label: "Email", icon: Mail, placeholder: "Enter email addresses, one per line" },
    sms: { color: "bg-emerald-600", label: "SMS", icon: Phone, placeholder: "Enter mobile numbers, one per line" },
    whatsapp: { color: "bg-green-500", label: "WhatsApp", icon: MessageCircle, placeholder: "Enter WhatsApp numbers, one per line" },
  };
  const tc = typeConfig[campaignType];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle className="text-lg font-semibold">Create Bulk Campaign</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Campaign Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["email", "sms", "whatsapp"] as const).map(t => {
                const cfg = typeConfig[t];
                return (
                  <button key={t} onClick={() => setCampaignType(t)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all ${campaignType === t ? `${cfg.color} text-white border-transparent shadow-sm` : "border-input bg-white text-muted-foreground hover:border-primary"}`}>
                    <cfg.icon className="h-4 w-4" /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Campaign Name <span className="text-red-400">*</span></Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl" placeholder={`e.g. June ${tc.label} Blast`} />
          </div>
          {campaignType === "email" && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Email Subject <span className="text-red-400">*</span></Label>
              <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="rounded-xl" placeholder="Enter email subject line" />
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Message Template <span className="text-red-400">*</span>
              <span className="ml-1 text-primary/60 font-normal">— use {"{{name}}"}, {"{{company}}"} as variables</span>
            </Label>
            <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              className="rounded-xl resize-none" rows={5}
              placeholder={campaignType === "email" ? "Dear {{name}},\n\nWe have an exciting offer...\n\nBest regards,\nThe Team" : "Hi {{name}}! 🎉 Special offer just for you: ..."} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Recipients <span className="text-red-400">*</span>
              {recipientList.length > 0 && <span className="ml-2 text-primary font-medium">{recipientList.length} recipient{recipientList.length > 1 ? "s" : ""}</span>}
            </Label>
            <Textarea value={form.recipients} onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))}
              className="rounded-xl resize-none font-mono text-xs" rows={4} placeholder={tc.placeholder} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Schedule Date & Time (optional)</Label>
            <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} className="rounded-xl" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
            <Button className="flex-1 rounded-xl bg-primary text-white"
              disabled={!form.name || !form.message || recipientList.length === 0 || createCampaign.isPending}
              onClick={() => createCampaign.mutate({ name: form.name, type: campaignType, subject: form.subject || null, message: form.message, recipients: recipientList, scheduledAt: form.scheduledAt || null })}>
              {createCampaign.isPending ? "Saving..." : "Create Campaign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Campaign Row ──────────────────────────────────────────────────────────
function CampaignRow({ campaign, onSend, onDelete }: { campaign: Campaign; onSend: (id: number) => void; onDelete: (id: number) => void }) {
  const CIcon = CAMPAIGN_ICONS[campaign.type] ?? MessageCircle;
  const statusCfg = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.draft;
  const typeColors: Record<string, string> = { email: "bg-indigo-100 text-indigo-700", sms: "bg-emerald-100 text-emerald-700", whatsapp: "bg-green-100 text-green-700" };
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-input bg-white hover:shadow-sm transition-shadow">
      <div className={`p-2 rounded-xl ${typeColors[campaign.type] ?? "bg-slate-100 text-slate-600"}`}>
        <CIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground truncate">{campaign.name}</p>
          <Badge variant="outline" className={`text-xs rounded-full px-2 py-0 h-5 capitalize ${typeColors[campaign.type]}`}>{campaign.type}</Badge>
          <Badge variant="outline" className={`text-xs rounded-full px-2 py-0 h-5 ${statusCfg.cls}`}>{statusCfg.label}</Badge>
          {campaign.n8nExecutionId && <Badge variant="outline" className="text-xs rounded-full px-2 py-0 h-5 bg-violet-50 text-violet-600">n8n: {campaign.n8nExecutionId}</Badge>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {campaign.recipientCount} recipients</span>
          {campaign.sentCount > 0 && <span className="flex items-center gap-0.5 text-emerald-600"><CheckCircle className="h-3 w-3" /> {campaign.sentCount} sent</span>}
          {campaign.failedCount > 0 && <span className="flex items-center gap-0.5 text-red-500"><AlertCircle className="h-3 w-3" /> {campaign.failedCount} failed</span>}
          {campaign.scheduledAt && <span className="flex items-center gap-0.5"><Calendar className="h-3 w-3" />{new Date(campaign.scheduledAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>}
          {campaign.sentAt && <span>Sent {new Date(campaign.sentAt).toLocaleDateString("en-IN")}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {(campaign.status === "draft" || campaign.status === "scheduled") && (
          <Button size="sm" className="rounded-xl h-7 text-xs gap-1 bg-primary text-white" onClick={() => onSend(campaign.id)}>
            <Send className="h-3 w-3" /> Send Now
          </Button>
        )}
        <button onClick={() => onDelete(campaign.id)} className="text-rose-400 hover:text-rose-600 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── n8n Config Panel ──────────────────────────────────────────────────────
function N8nConfigPanel() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data: cfg, refetch } = useQuery<N8nConfig>({
    queryKey: ["n8n-config"],
    queryFn: () => apiFetch("/digital-marketing/n8n-config"),
  });
  const [form, setForm] = useState<N8nConfig>({ isEnabled: false, instanceUrl: "", socialWebhookUrl: "", emailWebhookUrl: "", smsWebhookUrl: "", whatsappWebhookUrl: "" });

  const saveConfig = useMutation({
    mutationFn: (data: N8nConfig) => apiFetch("/digital-marketing/n8n-config", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "n8n config saved" }); refetch(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleOpen = () => {
    if (cfg) setForm({ isEnabled: cfg.isEnabled, instanceUrl: cfg.instanceUrl ?? "", socialWebhookUrl: cfg.socialWebhookUrl ?? "", emailWebhookUrl: cfg.emailWebhookUrl ?? "", smsWebhookUrl: cfg.smsWebhookUrl ?? "", whatsappWebhookUrl: cfg.whatsappWebhookUrl ?? "" });
    setOpen(!open);
  };

  const hasWebhook = cfg?.isEnabled && (cfg.socialWebhookUrl || cfg.emailWebhookUrl || cfg.smsWebhookUrl || cfg.whatsappWebhookUrl);

  return (
    <Card className="rounded-2xl border-0 shadow-sm">
      <button onClick={handleOpen} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${hasWebhook ? "bg-violet-100" : "bg-slate-100"}`}>
            <Zap className={`h-4 w-4 ${hasWebhook ? "text-violet-600" : "text-slate-400"}`} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">n8n Automation</p>
            <p className="text-xs text-muted-foreground">{hasWebhook ? "Webhooks configured — automation active" : "Configure webhook URLs to enable automation"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasWebhook && <Badge className="bg-violet-100 text-violet-700 text-xs rounded-full">Active</Badge>}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-input pt-4">
          <div className="bg-violet-50 rounded-xl p-3 text-xs text-violet-700 space-y-1">
            <p className="font-semibold">How n8n Integration Works</p>
            <p>1. Set up webhook triggers in your n8n instance for each channel.</p>
            <p>2. Paste the webhook URLs below and enable automation.</p>
            <p>3. When you publish a post or send a campaign, BizAuto will POST the data to your n8n webhook.</p>
            <p>4. n8n handles actual delivery: social platforms, emails, SMS, and WhatsApp.</p>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Enable n8n Automation</Label>
            <Switch checked={form.isEnabled} onCheckedChange={v => setForm(f => ({ ...f, isEnabled: v }))} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">n8n Instance URL</Label>
            <Input value={form.instanceUrl} onChange={e => setForm(f => ({ ...f, instanceUrl: e.target.value }))} className="rounded-xl" placeholder="https://your-n8n-instance.com" />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Webhook URLs per Channel</p>
            {[
              { key: "socialWebhookUrl", label: "Social Media Posts", icon: Share2, placeholder: "https://your-n8n.com/webhook/social-post" },
              { key: "emailWebhookUrl", label: "Email Campaigns", icon: Mail, placeholder: "https://your-n8n.com/webhook/email-campaign" },
              { key: "smsWebhookUrl", label: "SMS Campaigns", icon: Phone, placeholder: "https://your-n8n.com/webhook/sms-campaign" },
              { key: "whatsappWebhookUrl", label: "WhatsApp Campaigns", icon: MessageCircle, placeholder: "https://your-n8n.com/webhook/whatsapp-campaign" },
            ].map(({ key, label, icon: Icon, placeholder }) => (
              <div key={key}>
                <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1 block"><Icon className="h-3 w-3" /> {label}</Label>
                <Input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="rounded-xl text-xs" placeholder={placeholder} />
              </div>
            ))}
          </div>
          <Button className="w-full rounded-xl" onClick={() => saveConfig.mutate(form)} disabled={saveConfig.isPending}>
            {saveConfig.isPending ? "Saving..." : "Save n8n Configuration"}
          </Button>
        </div>
      )}
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function DigitalMarketing() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: posts = [], isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ["dm-posts"],
    queryFn: () => apiFetch("/digital-marketing/posts"),
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ["dm-campaigns"],
    queryFn: () => apiFetch("/digital-marketing/campaigns"),
  });

  const publishPost = useMutation({
    mutationFn: (id: number) => apiFetch(`/digital-marketing/posts/${id}/publish`, { method: "PUT" }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["dm-posts"] });
      const n8nMsg = data.n8nStatus === "triggered" ? " — n8n triggered!" : data.n8nStatus === "no_webhook" ? " (no webhook configured)" : "";
      toast({ title: "Post published", description: `Status updated to Published${n8nMsg}` });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deletePost = useMutation({
    mutationFn: (id: number) => apiFetch(`/digital-marketing/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dm-posts"] }); toast({ title: "Post deleted" }); },
  });

  const sendCampaign = useMutation({
    mutationFn: (id: number) => apiFetch(`/digital-marketing/campaigns/${id}/send`, { method: "POST" }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["dm-campaigns"] });
      if (data.demo) {
        toast({ title: "Campaign sent (Demo Mode)", description: "No n8n webhook configured. Recipients counted as sent." });
      } else if (data.n8nStatus === "triggered") {
        toast({ title: "Campaign triggered via n8n!", description: `Execution ID: ${data.campaign?.n8nExecutionId ?? "—"}` });
      } else {
        toast({ title: "Campaign sent", description: `Status: ${data.n8nStatus}` });
      }
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteCampaign = useMutation({
    mutationFn: (id: number) => apiFetch(`/digital-marketing/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dm-campaigns"] }); toast({ title: "Campaign deleted" }); },
  });

  const filteredPosts = posts.filter(p =>
    (platformFilter === "all" || p.platform === platformFilter) &&
    (statusFilter === "all" || p.status === statusFilter)
  );

  const postStats = {
    total: posts.length,
    published: posts.filter(p => p.status === "published").length,
    scheduled: posts.filter(p => p.status === "scheduled").length,
    draft: posts.filter(p => p.status === "draft").length,
    totalReach: posts.reduce((s, p) => s + p.reach, 0),
    totalImpressions: posts.reduce((s, p) => s + p.impressions, 0),
  };

  const campaignStats = {
    total: campaigns.length,
    email: campaigns.filter(c => c.type === "email").length,
    sms: campaigns.filter(c => c.type === "sms").length,
    whatsapp: campaigns.filter(c => c.type === "whatsapp").length,
    totalSent: campaigns.reduce((s, c) => s + c.sentCount, 0),
  };

  return (
    <div className="space-y-8">
      <Tabs defaultValue="social">
        <PageHeader
          title="Digital Marketing"
          description="Schedule social posts, run bulk campaigns, and automate with n8n."
          action={
            <TabsList className="h-9 rounded-xl bg-muted p-1">
              <TabsTrigger value="social" className="rounded-lg text-xs px-3">Social Media</TabsTrigger>
              <TabsTrigger value="bulk" className="rounded-lg text-xs px-3">Bulk Messaging</TabsTrigger>
            </TabsList>
          }
        />

        {/* ─── Social Media Tab ─── */}
        <TabsContent value="social" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Total Posts", val: postStats.total, Icon: BarChart3, color: "text-indigo-600 bg-indigo-50" },
              { label: "Published", val: postStats.published, Icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
              { label: "Scheduled", val: postStats.scheduled, Icon: Clock, color: "text-blue-600 bg-blue-50" },
              { label: "Drafts", val: postStats.draft, Icon: Globe, color: "text-slate-600 bg-slate-50" },
              { label: "Total Reach", val: postStats.totalReach.toLocaleString(), Icon: Users, color: "text-violet-600 bg-violet-50" },
              { label: "Impressions", val: postStats.totalImpressions.toLocaleString(), Icon: Eye, color: "text-orange-600 bg-orange-50" },
            ].map(({ label, val, Icon, color }) => (
              <Card key={label} className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-bold text-foreground">{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setPlatformFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${platformFilter === "all" ? "bg-primary text-white border-transparent" : "border-input bg-white text-muted-foreground hover:border-primary"}`}>
                All Platforms
              </button>
              {PLATFORMS.map(p => (
                <button key={p.value} onClick={() => setPlatformFilter(p.value)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${platformFilter === p.value ? `${p.color} text-white border-transparent` : "border-input bg-white text-muted-foreground hover:border-primary"}`}>
                  <p.Icon className="h-3 w-3" /> {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="text-xs rounded-xl border border-input bg-white px-3 py-2">
                <option value="all">All Statuses</option>
                {Object.entries(POST_STATUS).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
              <Button className="rounded-xl gap-1.5 h-9" onClick={() => setPostDialogOpen(true)}>
                <Plus className="h-4 w-4" /> New Post
              </Button>
            </div>
          </div>

          {postsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          ) : filteredPosts.length === 0 ? (
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <Share2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No posts found</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first social media post to get started.</p>
                <Button className="mt-4 rounded-xl gap-1" onClick={() => setPostDialogOpen(true)}><Plus className="h-4 w-4" /> Create Post</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map(post => (
                <PostCard key={post.id} post={post}
                  onPublish={id => publishPost.mutate(id)}
                  onDelete={id => { if (confirm("Delete this post?")) deletePost.mutate(id); }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Bulk Messaging Tab ─── */}
        <TabsContent value="bulk" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Campaigns", val: campaignStats.total, Icon: BarChart3, color: "text-indigo-600 bg-indigo-50" },
              { label: "Email", val: campaignStats.email, Icon: Mail, color: "text-blue-600 bg-blue-50" },
              { label: "SMS", val: campaignStats.sms, Icon: Phone, color: "text-emerald-600 bg-emerald-50" },
              { label: "WhatsApp", val: campaignStats.whatsapp, Icon: MessageCircle, color: "text-green-600 bg-green-50" },
              { label: "Total Sent", val: campaignStats.totalSent.toLocaleString(), Icon: Send, color: "text-violet-600 bg-violet-50" },
            ].map(({ label, val, Icon, color }) => (
              <Card key={label} className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-bold text-foreground">{val}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} total</p>
            <Button className="rounded-xl gap-1.5 h-9" onClick={() => setCampaignDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          </div>

          {campaignsLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : campaigns.length === 0 ? (
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <Send className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No campaigns yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first bulk messaging campaign.</p>
                <Button className="mt-4 rounded-xl gap-1" onClick={() => setCampaignDialogOpen(true)}><Plus className="h-4 w-4" /> Create Campaign</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map(c => (
                <CampaignRow key={c.id} campaign={c}
                  onSend={id => sendCampaign.mutate(id)}
                  onDelete={id => { if (confirm("Delete this campaign?")) deleteCampaign.mutate(id); }}
                />
              ))}
            </div>
          )}

          <N8nConfigPanel />
        </TabsContent>
      </Tabs>

      <CreatePostDialog open={postDialogOpen} onClose={() => setPostDialogOpen(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ["dm-posts"] })} />
      <CreateCampaignDialog open={campaignDialogOpen} onClose={() => setCampaignDialogOpen(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ["dm-campaigns"] })} />
    </div>
  );
}
