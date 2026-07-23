import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListTenants, useCreateTenant, useUpdateTenant, useDeleteTenant, type Tenant } from "@workspace/api-client-react";
import { Plus, Edit2, Trash2, Building, Search, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function Organizations() {
  const { data: tenants, isLoading, refetch } = useListTenants();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filtered = tenants?.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Organizations" 
        description="Manage tenants and their subscriptions."
        action={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
                <Plus className="mr-2 h-4 w-4" /> Add Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Create New Organization</DialogTitle>
              </DialogHeader>
              <CreateTenantForm onSuccess={() => { setIsCreateOpen(false); refetch(); }} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border/50 flex items-center gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search organizations..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl bg-white border-slate-200"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">Domain</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Employees</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <p className="text-lg font-medium text-slate-900">No organizations found</p>
                    <p className="text-sm">Create your first organization to get started.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {tenant.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{tenant.name}</div>
                          <div className="text-xs text-muted-foreground">{tenant.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{tenant.domain || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="capitalize bg-white shadow-sm">{tenant.plan}</Badge>
                    </td>
                    <td className="px-6 py-4">{tenant.employeeCount}</td>
                    <td className="px-6 py-4">
                      <Badge className={tenant.isActive ? "bg-emerald-500 hover:bg-emerald-600" : "bg-slate-300"}>
                        {tenant.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-primary">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <DeleteTenantButton tenant={tenant} onDeleted={refetch} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CreateTenantForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: "", slug: "", domain: "", plan: "starter" as any,
    adminEmail: "", adminPassword: "", adminFirstName: "", adminLastName: ""
  });
  const { mutateAsync, isPending } = useCreateTenant();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutateAsync({ data: formData });
      toast({ title: "Organization created successfully" });
      onSuccess();
    } catch (error: any) {
      toast({ title: "Failed to create", description: error.message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input required value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="rounded-xl" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Admin Email</Label>
        <Input type="email" required value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} className="rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label>Admin Password</Label>
        <Input type="password" required value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})} className="rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Admin First Name</Label>
          <Input required value={formData.adminFirstName} onChange={e => setFormData({...formData, adminFirstName: e.target.value})} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Admin Last Name</Label>
          <Input required value={formData.adminLastName} onChange={e => setFormData({...formData, adminLastName: e.target.value})} className="rounded-xl" />
        </div>
      </div>
      <Button type="submit" disabled={isPending} className="w-full rounded-xl h-11 mt-4">
        {isPending ? "Creating..." : "Create Organization"}
      </Button>
    </form>
  );
}

function DeleteTenantButton({ tenant, onDeleted }: { tenant: Tenant, onDeleted: () => void }) {
  const { mutateAsync, isPending } = useDeleteTenant();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete ${tenant.name}?`)) {
      try {
        await mutateAsync({ tenantId: tenant.id });
        toast({ title: "Deleted successfully" });
        onDeleted();
      } catch (error: any) {
        toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      }
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPending} className="h-8 w-8 text-slate-500 hover:text-destructive hover:bg-destructive/10">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
