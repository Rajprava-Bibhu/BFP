import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Settings2,
  Bell,
  Shield,
  Palette,
  Globe,
  Database,
  Mail,
  Smartphone,
  Moon,
  Sun,
  Check,
  Building2,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";

const sections = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "integrations", label: "Integrations", icon: Globe },
];

export default function Settings() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("general");
  const [saved, setSaved] = useState(false);

  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [attendanceAlerts, setAttendanceAlerts] = useState(true);
  const [projectUpdates, setProjectUpdates] = useState(true);
  const [billingAlerts, setBillingAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("UTC");
  const [companyName, setCompanyName] = useState("BizAuto Demo Org");
  const [supportEmail, setSupportEmail] = useState("support@bizauto.com");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const ToggleRow = ({ label, description, value, onChange }: {
    label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
  }) => (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  const isAdmin = user?.role === "super_admin" || user?.role === "org_admin";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">Manage your workspace preferences and configurations</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-48 flex-shrink-0">
          <ul className="space-y-1">
            {sections.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeSection === id
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-1 space-y-4">
          {activeSection === "general" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Organization</CardTitle>
                  <CardDescription>Basic workspace configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Company Name</Label>
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} className="h-10 rounded-lg" disabled={!isAdmin} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Support Email</Label>
                    <Input value={supportEmail} onChange={e => setSupportEmail(e.target.value)} className="h-10 rounded-lg" type="email" disabled={!isAdmin} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1.5"><Globe className="h-3 w-3" /> Language</Label>
                      <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="ar">Arabic</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1.5"><Clock className="h-3 w-3" /> Timezone</Label>
                      <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">Eastern (ET)</option>
                        <option value="America/Chicago">Central (CT)</option>
                        <option value="America/Los_Angeles">Pacific (PT)</option>
                        <option value="Europe/London">London (GMT)</option>
                        <option value="Asia/Dubai">Dubai (GST)</option>
                        <option value="Asia/Kolkata">India (IST)</option>
                      </select>
                    </div>
                  </div>
                  {!isAdmin && (
                    <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg border border-amber-200 dark:border-amber-500/20">
                      Organization settings can only be changed by an admin.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Data &amp; Storage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                    <div>
                      <p className="text-sm font-medium">Database Status</p>
                      <p className="text-xs text-slate-500">PostgreSQL — Connected</p>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                    <div>
                      <p className="text-sm font-medium">Data Retention</p>
                      <p className="text-xs text-slate-500">Audit logs kept for 90 days</p>
                    </div>
                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 border">90 days</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "notifications" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Email Notifications</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ToggleRow label="Email Notifications" description="Receive updates via email" value={emailNotifs} onChange={setEmailNotifs} />
                  <ToggleRow label="Attendance Alerts" description="Daily check-in/out reminders" value={attendanceAlerts} onChange={setAttendanceAlerts} />
                  <ToggleRow label="Project Updates" description="Task assignments and completions" value={projectUpdates} onChange={setProjectUpdates} />
                  <ToggleRow label="Billing Alerts" description="Invoice due dates and payments" value={billingAlerts} onChange={setBillingAlerts} />
                  <ToggleRow label="Weekly Summary Report" description="Every Monday morning digest" value={weeklyReport} onChange={setWeeklyReport} />
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border/50 shadow-sm mt-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> Push Notifications</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ToggleRow label="Push Notifications" description="Browser push notifications" value={pushNotifs} onChange={setPushNotifs} />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "security" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Authentication</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">Two-Factor Authentication</p>
                      <p className="text-xs text-slate-500 mt-0.5">Add an extra layer of security to your account</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={twoFactor ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border" : "bg-slate-100 text-slate-500 border-slate-200 border"}>
                        {twoFactor ? "Enabled" : "Disabled"}
                      </Badge>
                      <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500">Session Timeout (minutes)</Label>
                    <Input value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)} type="number" min="5" max="480" className="h-10 rounded-lg w-40" />
                    <p className="text-xs text-slate-400">Auto-logout after period of inactivity</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Active Sessions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { device: "Chrome on macOS", ip: "192.168.1.1", time: "Current session", current: true },
                    { device: "Safari on iPhone", ip: "10.0.0.2", time: "2 hours ago", current: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                      <div>
                        <p className="text-sm font-medium">{s.device}</p>
                        <p className="text-xs text-slate-500">{s.ip} · {s.time}</p>
                      </div>
                      {s.current ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border">Current</Badge>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive">Revoke</Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "appearance" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Theme</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {([["light", Sun, "Light"], ["dark", Moon, "Dark"], ["system", Settings2, "System"]] as const).map(([t, Icon, label]) => (
                      <button key={t} onClick={() => setTheme(t as any)} className={`relative p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${theme === t ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                        {theme === t && <Check className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />}
                        <Icon className={`h-6 w-6 ${theme === t ? "text-primary" : "text-slate-400"}`} />
                        <span className={`text-xs font-semibold ${theme === t ? "text-primary" : "text-slate-500"}`}>{label}</span>
                      </button>
                    ))}
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3 block">Accent Color</Label>
                    <div className="flex gap-2">
                      {["#4f46e5", "#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed"].map(color => (
                        <button key={color} className="h-8 w-8 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "integrations" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="rounded-2xl border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Connected Integrations</CardTitle>
                  <CardDescription>Connect external services to BizAuto</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: "Slack", desc: "Team notifications and alerts", connected: false, icon: "💬" },
                    { name: "Google Calendar", desc: "Sync events and meetings", connected: false, icon: "📅" },
                    { name: "Stripe", desc: "Payment processing", connected: true, icon: "💳" },
                    { name: "QuickBooks", desc: "Accounting and invoicing", connected: false, icon: "📊" },
                    { name: "HubSpot", desc: "CRM and marketing", connected: false, icon: "🎯" },
                    { name: "Zapier", desc: "Workflow automation", connected: false, icon: "⚡" },
                  ].map((integration) => (
                    <div key={integration.name} className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-xl">{integration.icon}</div>
                        <div>
                          <p className="text-sm font-semibold">{integration.name}</p>
                          <p className="text-xs text-slate-500">{integration.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {integration.connected ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border">Connected</Badge>
                        ) : (
                          <Button variant="outline" size="sm" className="text-xs rounded-lg h-8">Connect</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold shadow-md shadow-primary/20">
              {saved ? <><Check className="h-4 w-4 mr-2" /> Saved!</> : "Save Settings"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
