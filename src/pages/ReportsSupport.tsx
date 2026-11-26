import { LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SupportReport } from "@/components/reports/SupportReport";

// Menu Relatórios > Chamados: relatório dos chamados de suporte, que antes ficava no fim de Relatórios Gerais.
export default function ReportsSupport() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Chamados"
        description="Análise dos chamados de suporte"
        icon={<LifeBuoy className="h-5 w-5" />}
      />
      <SupportReport />
    </div>
  );
}
