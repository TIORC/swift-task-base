import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Clock, Users, CheckCircle2 } from "lucide-react";

const stats = [
  { title: "Total de Tarefas", value: "0", icon: ListTodo, color: "text-primary" },
  { title: "Em Progresso", value: "0", icon: Clock, color: "text-warning" },
  { title: "Concluídas", value: "0", icon: CheckCircle2, color: "text-success" },
  { title: "Membros do Time", value: "0", icon: Users, color: "text-muted-foreground" },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu time e tarefas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhuma atividade recente.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
