import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Automation, STATUS_LABELS, PRIORITY_LABELS, RISK_LABELS, AutomationStatus } from "@/types/automation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  automations: Automation[];
  profileMap: Record<string, string>;
  blockerCounts: Record<string, number>;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy", { locale: ptBR });
}

function buildRows(automations: Automation[], profileMap: Record<string, string>, blockerCounts: Record<string, number>) {
  return automations.map(a => ({
    nome: a.title,
    responsavel: a.assigned_to ? profileMap[a.assigned_to] || "—" : "Não atribuído",
    status: STATUS_LABELS[a.status as AutomationStatus] || a.status,
    prioridade: PRIORITY_LABELS[a.priority] || a.priority,
    prazo: formatDate(a.final_deadline),
    horasGastas: Number(a.spent_hours || 0).toFixed(1),
    bloqueios: blockerCounts[a.id] || 0,
    risco: RISK_LABELS[a.risk_level] || a.risk_level,
    progresso: `${a.progress_percent}%`,
  }));
}

function exportCSV(automations: Automation[], profileMap: Record<string, string>, blockerCounts: Record<string, number>) {
  const rows = buildRows(automations, profileMap, blockerCounts);
  const headers = ["Nome", "Responsável", "Status", "Prioridade", "Prazo", "Horas Gastas", "Bloqueios", "Risco", "Progresso"];
  const csv = [
    headers.join(";"),
    ...rows.map(r => [r.nome, r.responsavel, r.status, r.prioridade, r.prazo, r.horasGastas, r.bloqueios, r.risco, r.progresso].join(";"))
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `automacoes_${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success("Relatório Excel (CSV) exportado!");
}

function exportPDF(automations: Automation[], profileMap: Record<string, string>, blockerCounts: Record<string, number>) {
  const rows = buildRows(automations, profileMap, blockerCounts);
  const headers = ["Nome", "Responsável", "Status", "Prazo", "Horas", "Bloq.", "Risco"];

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Permita pop-ups para exportar PDF");
    return;
  }

  const tableRows = rows.map(r => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${r.nome}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px">${r.responsavel}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px">${r.status}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px">${r.prazo}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:center">${r.horasGastas}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:center">${r.bloqueios}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px">${r.risco}</td>
    </tr>
  `).join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Relatório de Automações</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 30px; color: #1a1a1a; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p.sub { font-size: 11px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 8px; background: #f3f4f6; border-bottom: 2px solid #d1d5db; font-size: 11px; text-align: left; }
        @media print { body { margin: 15px; } }
      </style>
    </head>
    <body>
      <h1>Relatório de Automações</h1>
      <p class="sub">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — ${automations.length} automações</p>
      <table>
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
  toast.success("Relatório PDF aberto para impressão!");
}

export function AutomationExport({ automations, profileMap, blockerCounts }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportPDF(automations, profileMap, blockerCounts)}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportCSV(automations, profileMap, blockerCounts)}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar Excel (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
