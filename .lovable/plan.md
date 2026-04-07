
# Plano de Evolução do Módulo de Tarefas

## O que JÁ existe no sistema:
- ✅ Filtros básicos de status/prioridade/responsável (TaskFilterSelect)
- ✅ Transferência de responsável com histórico (responsibility_history)
- ✅ Dependências entre tarefas (task_dependencies)
- ✅ Sistema de aprovação hierárquico (approvals)
- ✅ Menções com notificações no sistema (comments + notifications)
- ✅ Timer/time tracking (time_logs)
- ✅ Dashboard com métricas básicas (Recharts)

## Fase 1 — Filtros Avançados + Timeline
- Adicionar filtros rápidos por chips (Abertas, Em andamento, Pendentes, Concluídas, Desconsideradas)
- Filtro por período (data início/fim)
- Timeline visual de eventos dentro da tarefa (criação, início, aprovação, menções, mudanças)
- Criar tabela `task_events` para log de todos os eventos

## Fase 2 — Métricas de Tempo (Execução vs Espera)
- Calcular tempo em execução vs tempo em espera por tarefa
- Adicionar campos/cálculos baseados nos eventos
- Destacar tarefas travadas e com alto tempo de espera

## Fase 3 — Relatório Analítico
- Dashboard dedicado com gráficos (barras, linhas, cards)
- Métricas: tempo médio execução, espera, por responsável, por status
- Filtros por semana/mês/usuário
- Exportação PDF e Excel

## Fase 4 — Notificações por Email
- Configurar domínio de email
- Enviar email em menção, atribuição e aprovação pendente
- Email com nome da tarefa, quem mencionou e link direto

## Fase 5 — Inteligência
- Detecção automática de tarefas travadas
- Alertas de tarefas com tempo alto de espera
- Indicadores de saúde por tarefa

---

**Recomendação:** Implementar em fases para não quebrar funcionalidades existentes. Começar pela Fase 1?
