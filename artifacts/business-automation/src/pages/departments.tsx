import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListDepartments, useCreateDepartment, useDeleteDepartment, type Department } from "@workspace/api-client-react";
import { Plus, Search, Network, Trash2, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function Departments() {
  const { data: departments, isLoading, refetch } = useListDepartments();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filtered = departments?.filter(d => d.name.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Departments" 
        description="Organize your teams into functional departments."
        action={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
                <Plus className="mr-2 h-4 w-4" /> Create Department
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Create Department</DialogTitle>
              </DialogHeader>
              <CreateDepartmentForm onSuccess={() => { setIsCreateOpen(false); refetch(); }} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="h-40 bg-slate-100 animate-pulse rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-card border border-border/50 rounded-2xl">
            <Network className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-lg font-medium text-slate-900">No departments found</p>
          </div>
        ) : (
          filtered.map(dept => (
            <div key={dept.id} className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                  <Edit2 className="h-4 w-4" />
                </Button>
                <DeleteDeptButton dept={dept} onDeleted={refetch} />
              </div>
              
              <div className="h-12 w-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
                <Network className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-display font-bold text-foreground mb-1">{dept.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">
                {dept.description || "No description provided."}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="text-sm">
                  <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wider">Members</span>
                  <span className="font-medium">{dept.employeeCount}</span>
                </div>
                <div className="text-sm text-right">
                  <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wider">Head</span>
                  <span className="font-medium text-primary">{dept.headName || "Unassigned"}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CreateDepartmentForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({ name: "", description: "" });
  const { mutateAsync, isPending } = useCreateDepartment();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutateAsync({ data: formData });
      toast({ title: "Department created" });
      onSuccess();
    } catch (error: any) {
      toast({ title: "Failed to create", description: error.message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Department Name</Label>
        <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="rounded-xl" />
      </div>
      <Button type="submit" disabled={isPending} className="w-full rounded-xl h-11 mt-4">
        {isPending ? "Creating..." : "Save Department"}
      </Button>
    </form>
  );
}

function DeleteDeptButton({ dept, onDeleted }: { dept: Department, onDeleted: () => void }) {
  const { mutateAsync, isPending } = useDeleteDepartment();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (confirm(`Delete ${dept.name}?`)) {
      try {
        await mutateAsync({ departmentId: dept.id });
        toast({ title: "Deleted successfully" });
        onDeleted();
      } catch (error: any) {
        toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      }
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPending} className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
