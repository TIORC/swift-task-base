import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const columns = [
  { title: "Backlog", status: "backlog" },
  { title: "A Fazer", status: "todo" },
  { title: "Em Progresso", status: "in_progress" },
  { title: "Revisão", status: "review" },
  { title: "Concluído", status: "done" },
];

const Kanban = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Kanban</h1>
        <p className="text-muted-foreground">Visualize suas tarefas em um quadro.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.status} className="min-w-[260px] flex-1">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">0</span>
            </div>
            <Card className="min-h-[400px] border-border border-dashed bg-secondary/30">
              <CardContent className="flex items-center justify-center p-6">
                <p className="text-sm text-muted-foreground">Sem tarefas</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Kanban;
