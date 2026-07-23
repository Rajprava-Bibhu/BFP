import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Calendar,
  Briefcase,
  Hash,
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2,
  KeyRound,
  CheckCircle,
} from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  org_admin: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  department_head: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  employee: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  org_admin: "Org Admin",
  department_head: "Department Head",
  employee: "Employee",
};

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<"profile" | "security">("profile");

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "");
  const [country, setCountry] = useState(user?.country || "");
  const [isSaving, setIsSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  if (!user) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  const passwordStrength = (pwd: string) => {
    let s = 0;
    if (pwd.length >= 8) s++;
    if (pwd.length >= 12) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
  };
  const strength = passwordStrength(newPassword);
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][strength];
  const strengthColor = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"][strength];

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const updated = await apiFetch<typeof user>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ firstName, lastName, phone, city, country }),
      });
      updateUser(updated as any);
      toast({ title: "Profile updated", description: "Your profile has been saved." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to update profile", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Too short", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setIsChanging(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed", description: "You will be signed out shortly." });
      setTimeout(() => logout(), 2500);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to change password", variant: "destructive" });
    } finally {
      setIsChanging(false);
    }
  };

  const infoRow = (icon: React.ReactNode, label: string, value?: string | null) =>
    value ? (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-400">{icon}</div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
          <p className="text-slate-200 text-sm mt-0.5">{value}</p>
        </div>
      </div>
    ) : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">My Profile</h1>
        <p className="text-slate-500 mt-1 text-sm">Manage your account information and security settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card className="bg-white/70 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
            <CardContent className="p-6 text-center space-y-4">
              <div className="flex justify-center">
                <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                  <AvatarImage src={user.avatar || undefined} />
                  <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900 dark:text-white">{user.firstName} {user.lastName}</h2>
                <p className="text-slate-500 text-sm">{user.email}</p>
                {user.designation && <p className="text-slate-400 text-xs mt-1">{user.designation}</p>}
              </div>
              <Badge className={`${ROLE_COLORS[user.role]} border text-xs font-semibold rounded-full px-3 py-1`}>
                {ROLE_LABELS[user.role]}
              </Badge>
            </CardContent>
          </Card>

          <Card className="bg-white/70 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Account Info</h3>
              <div className="space-y-3">
                {infoRow(<Hash className="h-4 w-4" />, "Employee Code", user.employeeCode)}
                {infoRow(<Mail className="h-4 w-4" />, "Email", user.email)}
                {infoRow(<Briefcase className="h-4 w-4" />, "Employment Type", user.employmentType?.replace("_", " "))}
                {infoRow(<Calendar className="h-4 w-4" />, "Joined", user.joiningDate ? new Date(user.joiningDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null)}
                {infoRow(<Shield className="h-4 w-4" />, "Last Sign In", user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : null)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex border-b border-slate-200 dark:border-white/10 gap-6">
            {(["profile", "security"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-3 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {t === "profile" ? "Edit Profile" : "Security & Password"}
              </button>
            ))}
          </div>

          {tab === "profile" && (
            <Card className="bg-white/70 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">First Name</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-10 rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Last Name</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-10 rounded-lg" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Email Address
                  </Label>
                  <Input value={user.email} disabled className="h-10 rounded-lg opacity-60 cursor-not-allowed" />
                  <p className="text-xs text-slate-400">Email cannot be changed. Contact your administrator.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> Phone Number
                  </Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="h-10 rounded-lg" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> City
                    </Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" className="h-10 rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Country</Label>
                    <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States" className="h-10 rounded-lg" />
                  </div>
                </div>

                <div className="pt-2">
                  <Button onClick={handleSaveProfile} disabled={isSaving} className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "security" && (
            <Card className="bg-white/70 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" /> Change Password
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {pwSuccess ? (
                  <div className="text-center py-8 space-y-3">
                    <div className="flex justify-center">
                      <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <CheckCircle className="h-7 w-7 text-emerald-500" />
                      </div>
                    </div>
                    <p className="font-semibold text-slate-800 dark:text-white">Password Changed!</p>
                    <p className="text-slate-500 text-sm">Signing you out in a moment…</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Current Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          type={showCurrent ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="pl-9 pr-9 h-10 rounded-lg"
                        />
                        <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                          {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Separator className="dark:bg-white/10" />

                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          type={showNew ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          className="pl-9 pr-9 h-10 rounded-lg"
                        />
                        <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                          {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {newPassword && (
                        <div className="space-y-1">
                          <div className="flex gap-1 mt-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColor : "bg-slate-200 dark:bg-white/10"}`} />
                            ))}
                          </div>
                          <p className={`text-xs ${strength < 3 ? "text-red-500" : strength < 4 ? "text-yellow-500" : "text-emerald-500"}`}>{strengthLabel}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          type={showConfirm ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat new password"
                          className={`pl-9 pr-9 h-10 rounded-lg ${confirmPassword && confirmPassword !== newPassword ? "border-red-500" : ""}`}
                        />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPassword && confirmPassword !== newPassword && (
                        <p className="text-xs text-red-500">Passwords do not match</p>
                      )}
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                      <p className="text-xs text-amber-600 dark:text-amber-400">After changing your password, you will be signed out automatically and must sign in again with your new password.</p>
                    </div>

                    <Button
                      onClick={handleChangePassword}
                      disabled={isChanging || !currentPassword || !newPassword || (!!confirmPassword && confirmPassword !== newPassword)}
                      className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold"
                    >
                      {isChanging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                      Change Password
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
