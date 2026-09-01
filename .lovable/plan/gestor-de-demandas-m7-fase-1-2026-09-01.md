# Gestor de Demandas M7 — Fase 1

Implementação do que é possível hoje no sistema (sem o CRM externo, que fica preparado para integração futura).

## 1. Natureza da demanda

Novo campo obrigatório em tarefas M7: **Comercial**, **Onboarding**, **Recorrente**, **Avulsa**.

- Seletor no formulário de criação/edição de tarefa (padrão: Recorrente).
- Badge colorido no card (Tarefas, Kanban, Modo Foco).
- Filtro por natureza em Tarefas, Kanban, Painel Gestor e Relatórios.
- Tarefas existentes são classificadas como Recorrente (as geradas por recorrência) ou Avulsa (as demais).

## 2. Funis de status por natureza

O board passa a exibir colunas conforme a natureza selecionada:

```text
Comercial/Onboarding : Diagnóstico > Proposta > Negociação > Contrato > Onboarding > Handoff
Recorrente           : Roteiro/Ideia > Produção > Edição > Aprovação cliente > Publicado
Avulsa               : Solicitado > Em execução > Aprovação > Entregue
```

Um seletor de funil no topo do Kanban troca o conjunto de colunas. Os status internos existentes continuam válidos para relatórios/histórico.

## 3. Onboarding padrão (30 dias)

- Template fixo de onboarding (checklist): acessos e senhas das redes, dados do cliente, briefing, definição de temas/formatos, gravação inicial.
- Botão "Iniciar onboarding" na tela de Clientes cria um card único de onboarding para o cliente, com prazo de 30 dias e as subtarefas padrão já preenchidas.
- Ao concluir o card, um passo de **Handoff** cria o cliente na Agenda de Publicações com o plano contratado (quantidade de posts/mês, formatos, recorrência) definido em um novo bloco "Plano contratado" no cadastro do cliente.

## 4. Demanda avulsa

Ao escolher natureza Avulsa, campo obrigatório **Cobrável** (cobrável com orçamento à parte / interna), além de prioridade e prazo. Exibido no card e somado nos relatórios.

## 5. SLA por prioridade

Prazo-alvo por prioridade (Urgente 4h, Alta 1 dia, Média 3 dias, Baixa 7 dias), configurável no Admin M7. No card aparece o tempo restante ("vence em 3h") e destaque vermelho quando estourado.

## 6. Motivo de descarte obrigatório

Ao mover para "Desconsiderada", abre diálogo pedindo motivo (Cancelado pelo cliente / Duplicidade / Não é mais necessária / Fora de escopo / Outro + texto). Motivo entra nos Relatórios como ranking de descartes.

## 7. Simplificação de módulos

- **Banco de Ideias** deixa de ser item de menu e vira filtro/status dentro do Calendário Editorial (Ideia > Planejado > Publicado). A rota antiga redireciona.
- **Modo Foco** deixa de ser item de menu e vira botão dentro de Tarefas (rota mantida).
- Kanban e Tarefas permanecem (visões distintas: fluxo vs. lista/filtros).

## 8. Preparação do handoff com o CRM

Endpoint de entrada (função de backend protegida por chave) que recebe um contrato fechado do CRM e cria o cliente + card de onboarding automaticamente. Documentado para quando o CRM estiver pronto.

## Detalhes técnicos

- Banco: colunas `nature`, `billable`, `discard_reason` em `sm_tasks`; `plan_posts_per_month`, `plan_formats`, `plan_notes` em `sm_clients`; tabela `sm_sla_config`. Migração com GRANTs e políticas RLS no padrão atual do módulo.
- Frontend: novo `src/lib/sm-demands.ts` com naturezas, funis e SLA; ajustes em `SocialTasks.tsx`, `SocialKanban.tsx`, `SocialClients.tsx`, `SocialEditorialCalendar.tsx`, `SocialReports.tsx`, `SocialManagerDashboard.tsx`, `SocialLayout.tsx`.
- Edge function `sm-crm-handoff` para a integração futura.
