import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSmPosts, useSmClients } from "@/hooks/useSocial";
import { SM_POST_STATUS_LABEL } from "@/types/social";
import { SocialPostDialog } from "@/components/social/SocialPostDialog";
import type { SmPost } from "@/types/social";

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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SmPost | null>(null);
  const { data: posts, refresh } = useSmPosts();
  const { data: clients } = useSmClients();

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

  const postsByDay = useMemo(() => {
    const map = new Map<string, SmPost[]>();
    posts.filter(p => p.scheduled_at).forEach(p => {
      const k = new Date(p.scheduled_at!).toDateString();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    });
    return map;
  }, [posts]);

  const clientName = (id: string) => clients.find(c => c.id === id)?.name ?? "";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendário Editorial"
        description="Visão mensal de publicações agendadas"
        icon={<CalendarIcon className="h-5 w-5"/>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4"/></Button>
            <span className="text-sm font-medium capitalize min-w-[140px] text-center">{monthLabel}</span>
            <Button variant="outline" size="icon" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4"/></Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => (
              <div key={d} className="text-[10px] uppercase text-center text-muted-foreground font-semibold py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const inMonth = d.getMonth() === ref.getMonth();
              const dayPosts = postsByDay.get(d.toDateString()) ?? [];
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div key={i} className={`min-h-[90px] rounded-md border p-1.5 ${inMonth ? "bg-card" : "bg-muted/20"} ${isToday ? "border-primary" : "border-border"}`}>
                  <div className={`text-[11px] font-medium ${inMonth ? "text-foreground" : "text-muted-foreground"}`}>{d.getDate()}</div>
                  <div className="space-y-1 mt-1">
                    {dayPosts.slice(0, 3).map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setEditing(p); setOpen(true); }}
                        className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate ${STATUS_COLOR[p.status]}`}
                        title={`${p.title} — ${clientName(p.client_id)} — ${SM_POST_STATUS_LABEL[p.status]}`}
                      >
                        {p.title}
                      </button>
                    ))}
                    {dayPosts.length > 3 && <p className="text-[9px] text-muted-foreground px-1">+{dayPosts.length - 3} mais</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <SocialPostDialog open={open} onOpenChange={setOpen} post={editing} onSaved={refresh} />
    </div>
  );
}
