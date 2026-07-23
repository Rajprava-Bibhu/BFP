import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Lock, Eye, EyeOff, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [location] = useLocation();
  const { toast } = useToast();

  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenChecking, setTokenChecking] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setTokenChecking(false);
      return;
    }
    apiFetch<{ valid: boolean; message?: string }>(`/auth/reset-token-check?token=${token}`)
      .then((r) => setTokenValid(r.valid))
      .catch(() => setTokenValid(false))
      .finally(() => setTokenChecking(false));
  }, [token]);

  const passwordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = passwordStrength(newPassword);
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][strength];
  const strengthColor = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Too short", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message || "Could not reset password. Token may have expired.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={`${import.meta.env.BASE_URL}images/login-bg.png`} alt="Background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#292e4e]/80 mix-blend-multiply" />
      </div>

      <div className="relative z-10 w-full flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <Card className="glass-dark border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <CardHeader className="space-y-3 pb-4 pt-10 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-white p-3 rounded-2xl shadow-lg shadow-black/20">
                  <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-10 h-10" />
                </div>
              </div>
              <CardTitle className="text-2xl font-display font-bold text-white tracking-tight">
                {success ? "Password Reset" : "Create New Password"}
              </CardTitle>
            </CardHeader>

            <CardContent className="px-8 pb-10">
              <AnimatePresence mode="wait">
                {tokenChecking ? (
                  <motion.div key="checking" className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </motion.div>
                ) : !tokenValid ? (
                  <motion.div key="invalid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
                    <div className="flex justify-center">
                      <div className="h-16 w-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                        <AlertCircle className="h-8 w-8 text-red-400" />
                      </div>
                    </div>
                    <p className="text-slate-300">This reset link is invalid or has expired.</p>
                    <Link href="/forgot-password">
                      <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold">
                        Request a New Link
                      </Button>
                    </Link>
                  </motion.div>
                ) : success ? (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5">
                    <div className="flex justify-center">
                      <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-emerald-400" />
                      </div>
                    </div>
                    <p className="text-slate-300">Your password has been reset successfully. Please sign in with your new password.</p>
                    <Link href="/login">
                      <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold">
                        Back to Sign In
                      </Button>
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword" className="text-slate-200 ml-1 text-xs uppercase tracking-wider font-semibold">
                          New Password
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                          <Input
                            id="newPassword"
                            type={showNew ? "text" : "password"}
                            required
                            minLength={8}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            className="pl-11 pr-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white/20 focus:border-white/40 transition-all rounded-xl"
                          />
                          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white transition-colors">
                            {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        {newPassword && (
                          <div className="space-y-1">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColor : "bg-white/10"}`} />
                              ))}
                            </div>
                            <p className={`text-xs ml-1 ${strength < 3 ? "text-red-400" : strength < 4 ? "text-yellow-400" : "text-emerald-400"}`}>
                              {strengthLabel}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-slate-200 ml-1 text-xs uppercase tracking-wider font-semibold">
                          Confirm Password
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                          <Input
                            id="confirmPassword"
                            type={showConfirm ? "text" : "password"}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat new password"
                            className={`pl-11 pr-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white/20 focus:border-white/40 transition-all rounded-xl ${
                              confirmPassword && confirmPassword !== newPassword ? "border-red-500/50" : ""
                            }`}
                          />
                          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white transition-colors">
                            {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        {confirmPassword && confirmPassword !== newPassword && (
                          <p className="text-xs text-red-400 ml-1">Passwords do not match</p>
                        )}
                      </div>

                      <Button
                        type="submit"
                        disabled={isLoading || (!!confirmPassword && confirmPassword !== newPassword)}
                        className="w-full h-12 mt-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-base font-semibold shadow-lg shadow-primary/30 transition-all"
                      >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Reset Password"}
                      </Button>
                    </form>

                    <div className="mt-5 text-center">
                      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Sign In
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
