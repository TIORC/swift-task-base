import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Tasks = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">Gerencie todas as tarefas do time.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Lista de Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhuma tarefa criada ainda.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Tasks;
