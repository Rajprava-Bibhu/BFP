import { useState, useRef, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck, CalendarX, Clock, MapPin, Camera, CheckCircle2,
  XCircle, Loader2, ScanFace, LogIn, LogOut, Users, ShieldCheck,
  Navigation, AlertCircle, BarChart3, Eye, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

type AttendanceRecord = {
  id: number;
  userId: number;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: "present" | "absent" | "late" | "half_day" | "leave";
  hoursWorked: number | null;
  notes: string | null;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  faceVerified: boolean | null;
  faceConfidence: string | null;
  checkInPhoto: string | null;
  checkOutPhoto: string | null;
  userName: string;
  userEmail: string | null;
  departmentName: string | null;
  employeeCode: string | null;
};

type Summary = {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  onLeave: number;
};

type DeptReport = {
  deptId: number;
  deptName: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  rate: number;
};

type FaceStep = "idle" | "starting" | "live" | "capturing" | "verifying" | "verified" | "failed";

const DEPT_COLORS = ["#4f46e5", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function useGeolocation() {
  const [state, setState] = useState<{
    latitude: string | null;
    longitude: string | null;
    address: string | null;
    loading: boolean;
    error: string | null;
  }>({ latitude: null, longitude: null, address: null, loading: false, error: null });

  const detect = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: "Geolocation not supported", loading: false }));
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setState(s => ({ ...s, latitude: lat, longitude: lng, loading: false }));
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en" } },
          );
          const data = await r.json();
          const addr = data.display_name?.split(",").slice(0, 3).join(", ") ?? `${lat}, ${lng}`;
          setState(s => ({ ...s, address: addr }));
        } catch {
          setState(s => ({ ...s, address: `${lat}, ${lng}` }));
        }
      },
      (err) => setState(s => ({ ...s, loading: false, error: err.message })),
      { timeout: 10000, enableHighAccuracy: true },
    );
  }, []);

  return { ...state, detect };
}

function FaceVerificationPanel({
  mode,
  onVerified,
}: {
  mode: "checkin" | "checkout";
  onVerified: (data: { confidence: number; photo: string }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);

  const [step, setStep] = useState<FaceStep>("idle");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const drawOverlay = useCallback(async () => {
    if (!videoRef.current || !overlayRef.current) return;
    const video = videoRef.current;
    const canvas = overlayRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detectorRef.current && video.readyState >= 2) {
      try {
        const faces = await detectorRef.current.detect(video);
        setFaceDetected(faces.length > 0);
        for (const face of faces) {
          const { x, y, width, height } = face.boundingBox;
          const cLen = 18;
          ctx.fillStyle = "rgba(34,197,94,0.08)";
          ctx.fillRect(x, y, width, height);
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
          ctx.strokeStyle = "#4ade80";
          ctx.lineWidth = 4;
          [[x, y], [x + width - cLen, y], [x, y + height - cLen], [x + width - cLen, y + height - cLen]].forEach(([cx, cy]) => {
            ctx.beginPath(); ctx.moveTo(cx, cy + cLen); ctx.lineTo(cx, cy); ctx.lineTo(cx + cLen, cy); ctx.stroke();
          });
        }
      } catch { setFaceDetected(true); }
    } else {
      setFaceDetected(true);
    }
    animFrameRef.current = requestAnimationFrame(drawOverlay);
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setStep("starting");
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (overlayRef.current) {
          overlayRef.current.width = videoRef.current.videoWidth || 640;
          overlayRef.current.height = videoRef.current.videoHeight || 480;
        }
      }
      if ("FaceDetector" in window) {
        try { detectorRef.current = new (window as any).FaceDetector({ fastMode: false, maxDetectedFaces: 1 }); }
        catch { detectorRef.current = null; }
      }
      setStep("live");
      animFrameRef.current = requestAnimationFrame(drawOverlay);
    } catch {
      setErrorMsg("Camera access denied. Please allow camera permission and try again.");
      setStep("idle");
    }
  };

  const captureAndVerify = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setStep("capturing");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const photoData = canvas.toDataURL("image/jpeg", 0.6);
    setCapturedPhoto(photoData);
    stopCamera();
    setStep("verifying");

    try {
      const result = await apiFetch<{ verified: boolean; confidence: number }>("/attendance/face-verify", {
        method: "POST",
        body: JSON.stringify({ imageData: photoData.slice(0, 500) }),
      });
      setConfidence(result.confidence);
      if (result.verified) {
        setStep("verified");
        onVerified({ confidence: result.confidence, photo: photoData });
      } else {
        setStep("failed");
        setErrorMsg("Verification failed. Please ensure good lighting and try again.");
      }
    } catch {
      setStep("failed");
      setErrorMsg("Verification service error. Please try again.");
    }
  };

  const retry = () => { setCapturedPhoto(null); setConfidence(null); setErrorMsg(null); setStep("idle"); };

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3] flex items-center justify-center select-none">
        {step === "idle" && (
          <div className="flex flex-col items-center gap-4 text-center p-6">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <ScanFace className="h-10 w-10 text-primary" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">Face Recognition {mode === "checkin" ? "Check-In" : "Check-Out"}</p>
              <p className="text-slate-400 text-xs mt-1">AI-powered identity verification</p>
            </div>
            {errorMsg && (
              <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 rounded-lg px-3 py-2 text-left">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{errorMsg}
              </div>
            )}
            <Button onClick={startCamera} className="rounded-xl">
              <Camera className="mr-2 h-4 w-4" /> Open Camera
            </Button>
          </div>
        )}

        {step === "starting" && (
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-slate-300">Initialising camera...</p>
          </div>
        )}

        <video ref={videoRef} autoPlay playsInline muted
          className={`absolute inset-0 w-full h-full object-cover ${step === "live" ? "block" : "hidden"}`}
        />
        <canvas ref={overlayRef}
          className={`absolute inset-0 w-full h-full pointer-events-none ${step === "live" ? "block" : "hidden"}`}
        />

        {step === "live" && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${faceDetected ? "bg-emerald-500/90 text-white" : "bg-slate-800/80 text-slate-300"}`}>
              <div className={`h-2 w-2 rounded-full flex-shrink-0 ${faceDetected ? "bg-white animate-pulse" : "bg-slate-500"}`} />
              {faceDetected ? "Face Detected" : "Looking for face..."}
            </div>
            <Button size="sm" onClick={captureAndVerify} disabled={!faceDetected}
              className="rounded-xl bg-primary text-white shadow-lg flex-shrink-0">
              <Camera className="mr-1.5 h-3.5 w-3.5" /> Capture & Verify
            </Button>
          </div>
        )}

        {capturedPhoto && ["verifying", "verified", "failed", "capturing"].includes(step) && (
          <img src={capturedPhoto} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
        )}

        {(step === "verifying" || step === "capturing") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-white text-sm font-medium">
              {step === "capturing" ? "Capturing photo..." : "Verifying identity via Azure Face API..."}
            </p>
          </div>
        )}

        {step === "verified" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-900/70 gap-2">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-white" />
            </motion.div>
            <p className="text-white font-semibold">Identity Verified</p>
            <p className="text-emerald-200 text-sm">{Math.round((confidence ?? 0) * 100)}% confidence</p>
          </div>
        )}

        {step === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-900/70 gap-3 p-4">
            <div className="h-14 w-14 rounded-full bg-rose-500 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-white" />
            </div>
            <p className="text-white font-semibold">Verification Failed</p>
            <p className="text-rose-200 text-xs text-center">{errorMsg}</p>
            <Button size="sm" variant="outline" onClick={retry}
              className="rounded-xl border-white/20 text-white hover:bg-white/10">Try Again</Button>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function CheckInDialog({
  open, onOpenChange, mode, existingId, onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "checkin" | "checkout";
  existingId?: number;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [faceData, setFaceData] = useState<{ confidence: number; photo: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const geo = useGeolocation();

  useEffect(() => {
    if (open) { setFaceData(null); geo.detect(); }
  }, [open]);

  const handleSubmit = async () => {
    if (!user || !faceData) return;
    setSubmitting(true);
    const now = new Date().toISOString();
    try {
      if (mode === "checkin") {
        await apiFetch("/attendance", {
          method: "POST",
          body: JSON.stringify({
            userId: user.id,
            date: format(new Date(), "yyyy-MM-dd"),
            checkIn: now,
            latitude: geo.latitude,
            longitude: geo.longitude,
            address: geo.address,
            faceVerified: true,
            faceConfidence: faceData.confidence,
            checkInPhoto: faceData.photo,
          }),
        });
        toast({ title: "Checked in!", description: geo.address ?? "Location captured" });
      } else if (existingId) {
        await apiFetch(`/attendance/${existingId}`, {
          method: "PUT",
          body: JSON.stringify({
            checkOut: now,
            status: "present",
            latitude: geo.latitude,
            longitude: geo.longitude,
            address: geo.address,
            faceVerified: true,
            faceConfidence: faceData.confidence,
            checkOutPhoto: faceData.photo,
          }),
        });
        toast({ title: "Checked out!", description: "See you tomorrow!" });
      }
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base">
            {mode === "checkin"
              ? <><LogIn className="h-4.5 w-4.5 text-emerald-500" /> Face Recognition Check-In</>
              : <><LogOut className="h-4.5 w-4.5 text-rose-500" /> Face Recognition Check-Out</>}
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <FaceVerificationPanel mode={mode} onVerified={setFaceData} />

          <div className="rounded-xl border border-border/50 bg-slate-50 dark:bg-white/5 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Navigation className="h-3 w-3" /> GPS Location
            </p>
            {geo.loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Detecting location...
              </div>
            ) : geo.error ? (
              <div className="flex items-center gap-2 text-xs text-rose-500">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {geo.error}
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs ml-auto" onClick={geo.detect}>Retry</Button>
              </div>
            ) : geo.address ? (
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{geo.address}</p>
                  {geo.latitude && <p className="text-xs text-muted-foreground">{geo.latitude}, {geo.longitude}</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Waiting for location...
              </div>
            )}
          </div>

          {faceData && (
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Face Verified</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">
                  {Math.round(faceData.confidence * 100)}% confidence · Azure Face API
                </p>
              </div>
            </div>
          )}

          <Button className="w-full rounded-xl font-semibold" disabled={!faceData || submitting} onClick={handleSubmit}>
            {submitting
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : mode === "checkin"
                ? <LogIn className="mr-2 h-4 w-4" />
                : <LogOut className="mr-2 h-4 w-4" />}
            {submitting ? "Processing..." : mode === "checkin" ? "Confirm Check-In" : "Confirm Check-Out"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy · HH:mm")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    present: "bg-emerald-100 text-emerald-700 border-emerald-200",
    late: "bg-amber-100 text-amber-700 border-amber-200",
    absent: "bg-rose-100 text-rose-700 border-rose-200",
    leave: "bg-blue-100 text-blue-700 border-blue-200",
    half_day: "bg-purple-100 text-purple-700 border-purple-200",
  };
  return (
    <Badge variant="outline" className={`capitalize text-xs ${map[status] ?? ""}`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

function AttendanceTable({ records, loading, showEmployee }: {
  records: AttendanceRecord[];
  loading: boolean;
  showEmployee: boolean;
}) {
  const cols = showEmployee ? 8 : 7;
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 font-semibold border-b border-border">
            <tr>
              <th className="px-5 py-3.5">Date</th>
              {showEmployee && <th className="px-5 py-3.5">Employee</th>}
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Check In</th>
              <th className="px-5 py-3.5">Check Out</th>
              <th className="px-5 py-3.5">Location</th>
              <th className="px-5 py-3.5">Face</th>
              <th className="px-5 py-3.5 text-right">Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={cols} className="px-5 py-8 text-center text-muted-foreground">Loading records...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={cols} className="px-5 py-8 text-center text-muted-foreground">No attendance records found.</td></tr>
            ) : records.slice(0, 50).map(r => (
              <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                <td className="px-5 py-3.5 font-medium whitespace-nowrap">
                  {format(parseISO(r.date), "MMM d, yyyy")}
                </td>
                {showEmployee && (
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-foreground">{r.userName}</p>
                    <p className="text-xs text-muted-foreground">{r.departmentName ?? r.employeeCode ?? ""}</p>
                  </td>
                )}
                <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                  {r.checkIn ? format(parseISO(r.checkIn), "HH:mm") : "—"}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                  {r.checkOut ? format(parseISO(r.checkOut), "HH:mm") : "—"}
                </td>
                <td className="px-5 py-3.5 max-w-[180px]">
                  {r.address ? (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground line-clamp-2">{r.address}</span>
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  {r.faceVerified ? (
                    <div className="flex items-center gap-1 text-emerald-600">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">
                        {r.faceConfidence ? `${Math.round(parseFloat(r.faceConfidence) * 100)}%` : "Yes"}
                      </span>
                    </div>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-5 py-3.5 text-right font-medium">
                  {r.hoursWorked != null ? `${r.hoursWorked}h` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<"checkin" | "checkout">("checkin");
  const [dialogOpen, setDialogOpen] = useState(false);

  const isManager = user?.role !== "employee";
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["attendance"],
    queryFn: () => apiFetch("/attendance"),
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["attendance-summary"],
    queryFn: () => apiFetch("/attendance/summary"),
    enabled: isManager,
  });

  const { data: deptReport = [] } = useQuery<DeptReport[]>({
    queryKey: ["attendance-dept-report"],
    queryFn: () => apiFetch("/attendance/department-report"),
    enabled: isManager,
  });

  const myRecords = records.filter(r => r.userId === user?.id);
  const todayRecord = myRecords.find(r => r.date === today);
  const isCheckedIn = !!todayRecord?.checkIn;
  const isCheckedOut = !!todayRecord?.checkOut;

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-dept-report"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance System"
        description="Face recognition check-in with GPS location verification."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <ScanFace className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{user?.firstName} {user?.lastName}</p>
                <p className="text-sm text-muted-foreground capitalize">{user?.role?.replace("_", " ")}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!isCheckedIn && (
                <motion.div key="not-in" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 p-4 text-center">
                    <Clock className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Not checked in yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(), "HH:mm")}</p>
                  </div>
                  <Button onClick={() => { setDialogMode("checkin"); setDialogOpen(true); }}
                    className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30">
                    <LogIn className="mr-2 h-4 w-4" /> Check In with Face ID
                  </Button>
                </motion.div>
              )}

              {isCheckedIn && !isCheckedOut && (
                <motion.div key="checked-in" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Checked In</p>
                      {todayRecord?.faceVerified && (
                        <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border ml-auto">
                          <ShieldCheck className="mr-1 h-2.5 w-2.5" /> Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                      {todayRecord?.checkIn ? format(parseISO(todayRecord.checkIn), "HH:mm") : "--:--"}
                    </p>
                    {todayRecord?.address && (
                      <div className="flex items-start gap-1.5 mt-2">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-emerald-600 dark:text-emerald-500 line-clamp-2">{todayRecord.address}</p>
                      </div>
                    )}
                    {todayRecord?.faceConfidence && (
                      <p className="text-xs text-emerald-500 mt-1">
                        {Math.round(parseFloat(todayRecord.faceConfidence) * 100)}% face confidence
                      </p>
                    )}
                  </div>
                  <Button onClick={() => { setDialogMode("checkout"); setDialogOpen(true); }}
                    variant="outline"
                    className="w-full rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-semibold">
                    <LogOut className="mr-2 h-4 w-4" /> Check Out with Face ID
                  </Button>
                </motion.div>
              )}

              {isCheckedIn && isCheckedOut && (
                <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 p-4 space-y-3">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Check In</p>
                        <p className="font-bold text-emerald-600">
                          {todayRecord?.checkIn ? format(parseISO(todayRecord.checkIn), "HH:mm") : "--"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Check Out</p>
                        <p className="font-bold text-rose-500">
                          {todayRecord?.checkOut ? format(parseISO(todayRecord.checkOut), "HH:mm") : "--"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Hours</p>
                        <p className="font-bold text-primary">
                          {todayRecord?.hoursWorked != null ? `${todayRecord.hoursWorked}h` : "--"}
                        </p>
                      </div>
                    </div>
                    {todayRecord?.status && <StatusBadge status={todayRecord.status} />}
                  </div>
                  <p className="text-center text-xs text-muted-foreground py-1">Attendance recorded for today. See you tomorrow!</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {isManager && summary && (
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Present Today", value: summary.presentToday, Icon: CalendarCheck, bg: "bg-emerald-100 dark:bg-emerald-500/10", fg: "text-emerald-600" },
              { label: "Absent", value: summary.absentToday, Icon: CalendarX, bg: "bg-rose-100 dark:bg-rose-500/10", fg: "text-rose-600" },
              { label: "Late", value: summary.lateToday, Icon: Clock, bg: "bg-amber-100 dark:bg-amber-500/10", fg: "text-amber-600" },
              { label: "On Leave", value: summary.onLeave, Icon: Eye, bg: "bg-blue-100 dark:bg-blue-500/10", fg: "text-blue-600" },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="rounded-2xl border-border/50 shadow-sm h-full">
                  <CardContent className="p-5 flex items-center gap-3">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                      <s.Icon className={`h-5 w-5 ${s.fg}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Tabs defaultValue="history">
        <TabsList className="rounded-xl">
          <TabsTrigger value="history" className="rounded-lg gap-1.5">
            <CalendarCheck className="h-3.5 w-3.5" /> My History
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="all" className="rounded-lg gap-1.5">
              <Users className="h-3.5 w-3.5" /> All Records
            </TabsTrigger>
          )}
          {isManager && (
            <TabsTrigger value="report" className="rounded-lg gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Department Report
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="history" className="mt-4">
          <AttendanceTable records={myRecords} loading={isLoading} showEmployee={false} />
        </TabsContent>

        {isManager && (
          <TabsContent value="all" className="mt-4">
            <AttendanceTable records={records} loading={isLoading} showEmployee />
          </TabsContent>
        )}

        {isManager && (
          <TabsContent value="report" className="mt-4 space-y-5">
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Department Attendance — {format(new Date(), "MMMM d, yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deptReport.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">No department data for today. Check-ins will appear here as employees clock in.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={deptReport} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="deptName" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                      <Tooltip
                        formatter={(v) => [`${v}%`, "Attendance Rate"]}
                        contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", fontSize: 12 }}
                      />
                      <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={60}>
                        {deptReport.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 font-semibold border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Department</th>
                      <th className="px-5 py-3.5 text-center">Total</th>
                      <th className="px-5 py-3.5 text-center">Present</th>
                      <th className="px-5 py-3.5 text-center">Late</th>
                      <th className="px-5 py-3.5 text-center">Absent</th>
                      <th className="px-5 py-3.5 text-center">Leave</th>
                      <th className="px-5 py-3.5 text-center">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {deptReport.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground text-sm">No data for today</td></tr>
                    ) : deptReport.map((d, i) => (
                      <tr key={d.deptId} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3.5 font-medium">{d.deptName}</td>
                        <td className="px-5 py-3.5 text-center text-muted-foreground">{d.total}</td>
                        <td className="px-5 py-3.5 text-center font-medium text-emerald-600">{d.present}</td>
                        <td className="px-5 py-3.5 text-center font-medium text-amber-600">{d.late}</td>
                        <td className="px-5 py-3.5 text-center font-medium text-rose-600">{d.absent}</td>
                        <td className="px-5 py-3.5 text-center font-medium text-blue-600">{d.leave}</td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${d.rate}%`, backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                            </div>
                            <span className="text-xs font-semibold">{d.rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <CheckInDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        existingId={todayRecord?.id}
        onSuccess={onSuccess}
      />
    </div>
  );
}
