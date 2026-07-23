import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useListCampaigns, useCreateCampaign, useDeleteCampaign, type Campaign } from "@workspace/api-client-react";
import { Plus, Megaphone, Trash2, Mail, MessageSquare, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function Marketing() {
  const { data: campaigns, isLoading, refetch } = useListCampaigns();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const getIcon = (type: string) => {
    switch(type) {
      case 'email': return <Mail className="h-5 w-5 text-blue-500" />;
      case 'sms': return <MessageSquare className="h-5 w-5 text-emerald-500" />;
      default: return <Megaphone className="h-5 w-5 text-purple-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Marketing Automation" 
        description="Create and manage your omni-channel campaigns."
        action={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
                <Plus className="mr-2 h-4 w-4" /> New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Create Campaign</DialogTitle>
              </DialogHeader>
              <CreateCampaignForm onSuccess={() => { setIsCreateOpen(false); refetch(); }} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          [1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />)
        ) : campaigns?.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-card border border-border/50 rounded-2xl">
            <Megaphone className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-lg font-medium text-slate-900">No campaigns found</p>
          </div>
        ) : (
          campaigns?.map(camp => (
            <div key={camp.id} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col group relative">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <DeleteCampaignButton campaign={camp} onDeleted={refetch} />
              </div>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                  {getIcon(camp.type)}
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-foreground">{camp.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="uppercase text-[10px] tracking-wider bg-slate-100">{camp.type}</Badge>
                    <Badge variant="outline" className={`capitalize px-2 py-0 border-transparent text-white ${camp.status === 'running' ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                      {camp.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-auto pt-4 border-t border-border/50">
                <div className="text-center">
                  <div className="text-xl font-bold text-foreground">{camp.sentCount.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Sent</div>
                </div>
                <div className="text-center border-l border-r border-border/50">
                  <div className="text-xl font-bold text-foreground">{camp.openCount.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Opened</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-foreground">{camp.clickCount.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Clicks</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CreateCampaignForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({ name: "", type: "email" as any, subject: "" });
  const { mutateAsync, isPending } = useCreateCampaign();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutateAsync({ data: formData });
      toast({ title: "Campaign created" });
      onSuccess();
    } catch (error: any) {
      toast({ title: "Creation failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Campaign Name</Label>
        <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <select 
          value={formData.type} 
          onChange={e => setFormData({...formData, type: e.target.value as any})}
          className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="push">Push Notification</option>
        </select>
      </div>
      {formData.type === 'email' && (
        <div className="space-y-2">
          <Label>Subject Line</Label>
          <Input value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="rounded-xl" />
        </div>
      )}
      <Button type="submit" disabled={isPending} className="w-full rounded-xl h-11 mt-4">
        {isPending ? "Creating..." : "Save Campaign"}
      </Button>
    </form>
  );
}

function DeleteCampaignButton({ campaign, onDeleted }: { campaign: Campaign, onDeleted: () => void }) {
  const { mutateAsync, isPending } = useDeleteCampaign();
  
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      disabled={isPending}
      onClick={async () => {
        if (confirm('Delete campaign?')) {
          await mutateAsync({ campaignId: campaign.id });
          onDeleted();
        }
      }}
      className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10 bg-white"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
