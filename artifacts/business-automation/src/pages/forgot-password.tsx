import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mail, ArrowLeft, CheckCircle, Hash } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<"email" | "code">("email");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setIsLoading(true);
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

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
                {submitted ? "Check Your Inbox" : "Reset Your Password"}
              </CardTitle>
              <CardDescription className="text-slate-300">
                {submitted
                  ? "If an account exists, a reset token has been generated. Check the server logs for the token (demo mode)."
                  : "Enter your email or employee code to receive a password reset link."}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-8 pb-10">
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-5"
                  >
                    <div className="flex justify-center">
                      <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-emerald-400" />
                      </div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-left">
                      <p className="text-amber-300 text-sm font-semibold mb-1">Demo Mode</p>
                      <p className="text-amber-200/80 text-xs">In production, a reset email would be sent. For now, the reset token is printed to the API server console logs. Use it at <code className="bg-black/30 px-1 rounded">/reset-password?token=...</code></p>
                    </div>
                    <Link href="/login">
                      <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold mt-2">
                        Back to Sign In
                      </Button>
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div key="form">
                    <div className="flex rounded-xl overflow-hidden border border-white/10 mb-5">
                      {(["email", "code"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => { setMode(m); setIdentifier(""); }}
                          className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                            mode === m ? "bg-primary text-white" : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {m === "email" ? "By Email" : "By Employee Code"}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
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

                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-xl text-base font-semibold shadow-lg shadow-primary/30 transition-all"
                      >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Reset Link"}
                      </Button>
                    </form>

                    <div className="mt-6 text-center">
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
