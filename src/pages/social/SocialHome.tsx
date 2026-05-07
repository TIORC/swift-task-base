import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function SocialHome() {
  return (
    <div className="space-y-6">
      <PageHeader title="Social Media" subtitle="Ambiente de gestão de conteúdo e redes sociais" />
      <Card className="p-10 text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Bem-vindo ao ambiente Social Media</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          A estrutura base está pronta. Os módulos (Dashboard, Kanban, Calendário Editorial,
          Clientes, Campanhas, Aprovações, Banco de Ideias, Briefings, Métricas, Relatórios,
          Ranking, Modo Foco e Portal do Cliente) serão liberados nas próximas etapas.
        </p>
      </Card>
    </div>
  );
}
