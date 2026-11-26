import { Bot } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AutomationsReport } from "@/components/reports/AutomationsReport";

// Menu Relatórios > Automações/Sistemas: relatório das automações, que antes ficava no fim de Relatórios Gerais.
export default function ReportsAutomations() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Automações/Sistemas"
        description="Análise das automações e sistemas em desenvolvimento"
        icon={<Bot className="h-5 w-5" />}
      />
      <AutomationsReport />
    </div>
  );
}
