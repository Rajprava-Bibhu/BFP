import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListUsers, useDeleteUser, type User } from "@workspace/api-client-react";
import { Plus, Search, UserPlus, Trash2, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

export default function Users() {
  const { data: users, isLoading, refetch } = useListUsers();
  const [search, setSearch] = useState("");

  const filtered = users?.filter(u => 
    u.firstName.toLowerCase().includes(search.toLowerCase()) || 
    u.lastName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Team Members" 
        description="Manage your organization's users and their roles."
        action={
          <Button className="rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
            <UserPlus className="mr-2 h-4 w-4" /> Invite User
          </Button>
        }
      />

      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border/50 flex items-center gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search team members..." 
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
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Department ID</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : (
                filtered.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-slate-200 shadow-sm">
                          <AvatarFallback className="bg-primary/5 text-primary font-semibold">
                            {user.firstName[0]}{user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-foreground">{user.firstName} {user.lastName}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="capitalize">
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{user.departmentId || 'Unassigned'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span>{user.isActive ? "Active" : "Inactive"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-primary">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <DeleteUserButton user={user} onDeleted={refetch} />
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

function DeleteUserButton({ user, onDeleted }: { user: User, onDeleted: () => void }) {
  const { mutateAsync, isPending } = useDeleteUser();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to remove ${user.firstName}?`)) {
      try {
        await mutateAsync({ userId: user.id });
        toast({ title: "Removed successfully" });
        onDeleted();
      } catch (error: any) {
        toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
      }
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPending} className="h-8 w-8 text-slate-500 hover:text-destructive hover:bg-destructive/10">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
