import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Loader2, Lock, Mail, Hash, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LoginMode = "email" | "employee";

export default function Login() {
  const [mode, setMode] = useState<LoginMode>("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  if (isAuthenticated) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast({ title: "Required", description: mode === "email" ? "Enter your email address" : "Enter your employee code", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await login({ identifier: identifier.trim(), password });
    } catch (err: any) {
      toast({ title: "Sign in failed", description: err?.message || "Invalid credentials. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const roleDescriptions = [
    { title: "Org Admin",  desc: "Org & team management", color: "from-violet-500 to-purple-600" },
    { title: "Dept Head",  desc: "Team & project lead",   color: "from-blue-500 to-cyan-600" },
    { title: "Employee",   desc: "Personal workspace",    color: "from-emerald-500 to-green-600" },
  ];

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#292e4e]/80 mix-blend-multiply" />
      </div>

      <div className="relative z-10 w-full flex items-center justify-center p-4 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <Card className="glass-dark border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <CardHeader className="space-y-3 pb-4 pt-10 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-white px-4 py-3 rounded-2xl shadow-lg shadow-black/20 flex items-center justify-center">
                  <img src="/bfp-logo.png" alt="BFP Logo" className="h-14 w-auto object-contain" />
                </div>
              </div>
              <CardTitle className="text-3xl font-display font-bold text-white tracking-tight">Welcome Back</CardTitle>
              <CardDescription className="text-slate-300 text-base">
                Sign in to your BFP Workspace
              </CardDescription>
            </CardHeader>

            <CardContent className="px-8 pb-8">
              <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
                {(["email", "employee"] as LoginMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setIdentifier(""); }}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                      mode === m
                        ? "bg-primary text-white"
                        : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {m === "email" ? "Email Login" : "Employee Code"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2 text-left">
                  <Label htmlFor="identifier" className="text-slate-200 ml-1 text-xs uppercase tracking-wider font-semibold">
                    {mode === "email" ? "Email Address" : "Employee Code"}
                  </Label>
                  <div className="relative">
                    {mode === "email" ? (
                      <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                    ) : (
                      <Hash className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                    )}
                    <Input
                      id="identifier"
                      type={mode === "email" ? "email" : "text"}
                      placeholder={mode === "email" ? "name@company.com" : "EMP-001-0001"}
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="pl-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white/20 focus:border-white/40 transition-all rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="password" className="text-slate-200 text-xs uppercase tracking-wider font-semibold">
                      Password
                    </Label>
                    <Link href="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 pr-11 h-12 bg-white/10 border-white/20 text-white focus:bg-white/20 focus:border-white/40 transition-all rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 mt-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-base font-semibold shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In to Workspace"}
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/10">
                <p className="text-xs text-center text-slate-400 mb-3 uppercase tracking-wider font-semibold">Demo Accounts</p>
                <div className="flex gap-2">
                  {roleDescriptions.map(({ title, desc, color }) => (
                    <div
                      key={title}
                      className="relative overflow-hidden flex-1 p-3 rounded-xl border border-white/10 bg-white/5"
                    >
                      <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${color} rounded-l-xl`} />
                      <p className="text-white text-xs font-semibold pl-2">{title}</p>
                      <p className="text-slate-400 text-[10px] pl-2 mt-0.5 leading-tight">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
