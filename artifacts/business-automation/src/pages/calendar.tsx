import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { CalendarDays, Plus, MapPin, Clock, Star, Palmtree, ChevronLeft, ChevronRight } from "lucide-react";

type CalendarEvent = {
  id: number;
  title: string;
  description?: string;
  eventType: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
  color: string;
  recurrence: string;
};

type Holiday = {
  id: number;
  name: string;
  date: string;
  type: string;
  isOptional: boolean;
};

const EVENT_COLORS: Record<string, string> = {
  meeting: "#4f46e5",
  task: "#f59e0b",
  reminder: "#06b6d4",
  deadline: "#ef4444",
  training: "#8b5cf6",
  leave: "#22c55e",
  holiday: "#ec4899",
  other: "#64748b",
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function Calendar() {
  const qc = useQueryClient();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<CalendarEvent>>({ eventType: "meeting", color: EVENT_COLORS.meeting, recurrence: "none", allDay: false });

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events"],
    queryFn: () => apiFetch("/calendar/events"),
  });

  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["holidays"],
    queryFn: () => apiFetch("/calendar/holidays"),
  });

  const createEvent = useMutation({
    mutationFn: (data: Partial<CalendarEvent>) => apiFetch("/calendar/events", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar-events"] }); setOpen(false); },
  });

  const deleteEvent = useMutation({
    mutationFn: (id: number) => apiFetch(`/calendar/events/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(e => {
      const d = new Date(e.startAt).toDateString();
      if (!map[d]) map[d] = [];
      map[d].push(e);
    });
    return map;
  }, [events]);

  const holidayByDate = useMemo(() => {
    const map: Record<string, Holiday> = {};
    holidays.forEach(h => { map[h.date] = h; });
    return map;
  }, [holidays]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const upcomingEvents = events
    .filter(e => new Date(e.startAt) >= today)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Calendar"
        description="Manage events, meetings, and company holidays."
        action={
          <Button onClick={() => setOpen(true)} className="bg-primary text-white hover:bg-primary/90 rounded-xl gap-2">
            <Plus className="h-4 w-4" /> Add Event
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2 border-border/50 rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={prevMonth}><ChevronLeft className="h-5 w-5"/></Button>
              <CardTitle className="font-display text-xl">{MONTHS[month]} {year}</CardTitle>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={nextMonth}><ChevronRight className="h-5 w-5"/></Button>
            </div>
            <Button variant="outline" className="rounded-xl text-xs" onClick={() => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))}>
              Today
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map(d => <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(year, month, day);
                const dateStr = date.toDateString();
                const dateKey = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const dayEvents = eventsByDate[dateStr] ?? [];
                const holiday = holidayByDate[dateKey];
                const isToday = date.toDateString() === today.toDateString();

                return (
                  <div key={day} className={`min-h-[72px] rounded-xl p-1.5 border transition-colors ${isToday ? "bg-primary/5 border-primary/30" : "border-transparent hover:bg-slate-50"}`}>
                    <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-white" : "text-foreground"}`}>
                      {day}
                    </div>
                    {holiday && <div className="text-[10px] px-1 py-0.5 rounded bg-pink-100 text-pink-700 truncate mb-0.5">{holiday.name}</div>}
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className="text-[10px] px-1 py-0.5 rounded text-white truncate mb-0.5 cursor-pointer" style={{ backgroundColor: e.color }}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</div>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Upcoming Events */}
          <Card className="border-border/50 rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
              upcomingEvents.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming events.</p> :
              upcomingEvents.map(e => (
                <div key={e.id} className="flex gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {new Date(e.startAt).toLocaleDateString()} {!e.allDay && new Date(e.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {e.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteEvent.mutate(e.id)}>
                    ×
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Holidays */}
          <Card className="border-border/50 rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Palmtree className="h-4 w-4 text-emerald-600" /> Upcoming Holidays
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {holidays.filter(h => new Date(h.date) >= today).slice(0, 5).map(h => (
                <div key={h.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(h.date).toLocaleDateString()}</p>
                  </div>
                  {h.isOptional && <Badge variant="outline" className="text-[10px]">Optional</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Event Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle className="font-display">Add Event</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Title *</Label>
              <Input value={form.title ?? ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Event Type</Label>
              <Select value={form.eventType ?? "meeting"} onValueChange={v => setForm(p => ({ ...p, eventType: v, color: EVENT_COLORS[v] ?? EVENT_COLORS.other }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(EVENT_COLORS).map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Start *</Label>
                <Input type="datetime-local" value={form.startAt ?? ""} onChange={e => setForm(p => ({ ...p, startAt: e.target.value }))} className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">End *</Label>
                <Input type="datetime-local" value={form.endAt ?? ""} onChange={e => setForm(p => ({ ...p, endAt: e.target.value }))} className="rounded-xl" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Location</Label>
              <Input value={form.location ?? ""} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} className="rounded-xl" placeholder="Meeting room, Zoom link..." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
              <Input value={form.description ?? ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="rounded-xl" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="flex-1 rounded-xl bg-primary text-white"
              onClick={() => createEvent.mutate(form)}
              disabled={!form.title || !form.startAt || !form.endAt || createEvent.isPending}
            >
              {createEvent.isPending ? "Saving..." : "Add Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
