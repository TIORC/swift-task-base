import { useEffect, useMemo, useState, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSmPosts, useSmClients } from "@/hooks/useSocial";
import { SM_POST_STATUS_LABEL } from "@/types/social";
import { SocialPostDialog } from "@/components/social/SocialPostDialog";
import { SocialEventDialog, type SmEvent } from "@/components/social/SocialEventDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import type { SmPost } from "@/types/social";

const sb = supabase as any;

const STATUS_COLOR: Record<string, string> = {
  ideia: "bg-muted text-muted-foreground",
  roteiro: "bg-primary/15 text-primary",
  design: "bg-accent text-accent-foreground",
  revisao_interna: "bg-warning/15 text-warning",
  aprovacao_cliente: "bg-warning/25 text-warning",
  agendado: "bg-primary/25 text-primary",
  publicado: "bg-success/15 text-success",
  reprovado: "bg-destructive/15 text-destructive",
};

export default function SocialEditorialCalendar() {
  const [ref, setRef] = useState(new Date());
  const [postOpen, setPostOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SmPost | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SmEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);

  const { data: posts, refresh: refreshPosts } = useSmPosts();
  const { data: clients } = useSmClients();
  const [events, setEvents] = useState<SmEvent[]>([]);

  const refreshEvents = useCallback(async () => {
    const { data } = await sb.from("sm_calendar_events").select("*").order("starts_at");
    setEvents((data as SmEvent[]) ?? []);
  }, []);

  useEffect(() => { refreshEvents(); }, [refreshEvents]);

  useEffect(() => {
    const ch = supabase
      .channel(`sm-events-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sm_calendar_events" }, () => refreshEvents())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refreshEvents]);

  const { days, monthLabel } = useMemo(() => {
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const start = new Date(first);
    start.setDate(start.getDate() - first.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i); days.push(d);
    }
    return { days, monthLabel: ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  }, [ref]);

  // Expande templates recorrentes em ocorrências virtuais dentro do mês visível
  const postsByDay = useMemo(() => {
    const map = new Map<string, SmPost[]>();
    const monthStart = days[0];
    const monthEnd = days[days.length - 1];
    const addToDay = (date: Date, post: SmPost) => {
      const k = date.toDateString();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(post);
    };
    posts.forEach((p) => {
      const isTpl = (p as any).is_recurring_template;
      const rType = (p as any).recurrence_type;
      if (isTpl && rType && p.scheduled_at) {
        const interval = Math.max(1, (p as any).recurrence_interval || 1);
        const until = (p as any).recurrence_until ? new Date((p as any).recurrence_until) : null;
        let cur = new Date(p.scheduled_at);
        let guard = 0;
        while (cur <= monthEnd && guard < 500) {
          if (cur >= monthStart && (!until || cur <= until)) {
            addToDay(cur, { ...p, scheduled_at: cur.toISOString() } as SmPost);
          }
          if (rType === "daily" || rType === "custom") cur.setDate(cur.getDate() + interval);
          else if (rType === "weekly") cur.setDate(cur.getDate() + 7 * interval);
          else if (rType === "monthly") cur.setMonth(cur.getMonth() + interval);
          else break;
          guard++;
        }
      } else if (p.scheduled_at) {
        addToDay(new Date(p.scheduled_at), p);
      }
    });
    return map;
  }, [posts, days]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, SmEvent[]>();
    events.forEach(e => {
      const k = new Date(e.starts_at).toDateString();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return map;
  }, [events]);

  const clientName = (id?: string | null) => id ? (clients.find(c => c.id === id)?.name ?? "") : "";

  const openNewAt = (d: Date, kind: "post" | "event") => {
    const date = new Date(d);
    date.setHours(9, 0, 0, 0);
    setDefaultDate(date);
    if (kind === "post") { setEditingPost(null); setPostOpen(true); }
    else { setEditingEvent(null); setEventOpen(true); }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendário Editorial"
        description="Posts, reuniões e eventos no mesmo lugar"
        icon={<CalendarIcon className="h-5 w-5"/>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4"/></Button>
            <span className="text-sm font-medium capitalize min-w-[140px] text-center">{monthLabel}</span>
            <Button variant="outline" size="icon" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4"/></Button>
            <Button variant="outline" size="sm" onClick={() => setRef(new Date())}>Hoje</Button>
            <Button variant="outline" size="sm" asChild><a href="/social/banco-de-ideias">Banco de Ideias</a></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1"/>Adicionar</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openNewAt(new Date(), "post")}>
                  <FileText className="h-4 w-4 mr-2"/>Post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openNewAt(new Date(), "event")}>
                  <Users className="h-4 w-4 mr-2"/>Reunião / Evento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"].map(d => (
              <div key={d} className="text-xs uppercase text-center text-muted-foreground font-bold tracking-wider py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d, i) => {
              const inMonth = d.getMonth() === ref.getMonth();
              const dayPosts = postsByDay.get(d.toDateString()) ?? [];
              const dayEvents = eventsByDay.get(d.toDateString()) ?? [];
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className={`min-h-[140px] rounded-lg border-2 p-2 group relative transition ${inMonth ? "bg-card" : "bg-muted/30"} ${isToday ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-base font-bold ${isToday ? "text-primary" : inMonth ? "text-foreground" : "text-muted-foreground/60"}`}>
                      {d.getDate()}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent">
                          <Plus className="h-4 w-4"/>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openNewAt(d, "post")}>
                          <FileText className="h-4 w-4 mr-2"/>Post
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openNewAt(d, "event")}>
                          <Users className="h-4 w-4 mr-2"/>Reunião / Evento
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map(e => (
                      <button
                        key={e.id}
                        onClick={() => { setEditingEvent(e); setEventOpen(true); }}
                        className="w-full text-left text-xs font-semibold px-2 py-1 rounded-md truncate text-white shadow-sm hover:shadow-md hover:brightness-110 transition"
                        style={{ backgroundColor: e.color ?? "hsl(var(--primary))" }}
                        title={`${e.kind === "reuniao" ? "🤝" : "📅"} ${e.title} ${clientName(e.client_id) ? "— " + clientName(e.client_id) : ""}`}
                      >
                        {e.kind === "reuniao" ? "🤝 " : "📅 "}{e.title}
                      </button>
                    ))}
                    {dayPosts.slice(0, 3).map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setEditingPost(p); setPostOpen(true); }}
                        className={`w-full text-left text-xs font-medium px-2 py-1 rounded-md truncate hover:brightness-110 transition ${STATUS_COLOR[p.status]}`}
                        title={`${p.title} — ${clientName(p.client_id)} — ${SM_POST_STATUS_LABEL[p.status]}`}
                      >
                        {p.title}
                      </button>
                    ))}
                    {(dayPosts.length + dayEvents.length) > 5 && (
                      <p className="text-[11px] text-muted-foreground font-medium px-1">+{dayPosts.length + dayEvents.length - 5} mais</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <SocialPostDialog open={postOpen} onOpenChange={setPostOpen} post={editingPost} onSaved={refreshPosts} />
      <SocialEventDialog open={eventOpen} onOpenChange={setEventOpen} event={editingEvent} defaultDate={defaultDate} onSaved={refreshEvents} />
    </div>
  );
}
