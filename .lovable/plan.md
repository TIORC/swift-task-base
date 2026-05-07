## Objetivo

Transformar o app atual em um sistema 2-em-1 com dois ambientes isolados (Gestão de TI e Social Media), compartilhando login mas com dados, telas e permissões separadas. **O sistema de TI atual permanece 100% intacto** — apenas adicionamos uma camada de seleção e um novo módulo paralelo.

---

## Arquitetura

```text
                  ┌──────────────────┐
                  │  /select-system  │ ← tela inicial nova
                  └────────┬─────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
        /login/ti                 /login/social
              │                         │
              ▼                         ▼
        /ti/* (atual)             /social/*
        (todas as rotas           (novo módulo)
         atuais movidas
         com prefixo)
```

**Decisão de segurança:** o usuário escolhe o ambiente **antes** do login. O login valida se ele tem permissão para aquele ambiente (`user_systems`). Se tentar acessar URL de ambiente sem permissão → redireciona para `/select-system`.

**Compatibilidade:** rotas antigas (`/`, `/kanban`, `/tasks`, etc.) redirecionam automaticamente para `/ti/...` para não quebrar bookmarks.

---

## Fase 1 — Fundação (sem quebrar nada)

### 1.1 Banco de dados — controle de acesso por sistema

Nova tabela `user_systems`:
- `user_id`, `system` (`'ti' | 'social'`), `enabled`
- RLS: usuário lê o próprio; admin gerencia tudo
- Seed: timaracas@orcoma.com.br ganha acesso aos dois sistemas; **todos os usuários atuais ganham acesso a `ti`** (preserva comportamento)

Novo enum `social_role`: `admin`, `gestor`, `social_media`, `designer`, `redator`, `cliente`

Nova tabela `user_social_roles` (paralela a `user_roles`, sem conflito).

### 1.2 Tela de seleção e roteamento

- `src/pages/SelectSystem.tsx` — tela inicial com 2 cards grandes (TI / Social Media), mesma identidade visual
- `src/pages/AuthTI.tsx` e `src/pages/AuthSocial.tsx` — wrappers do `Auth` atual com branding por ambiente
- `src/App.tsx` — agrupar rotas atuais sob `/ti/*` e adicionar `/social/*`; criar redirects de rotas antigas → `/ti/*`
- `src/hooks/useCurrentSystem.tsx` — hook + provider que lê o ambiente da URL e valida permissão

### 1.3 Sidebar contextual

`AppSidebar` detecta o ambiente atual e mostra o menu correto. Adiciona botão "Trocar ambiente" no rodapé (volta para `/select-system`).

---

## Fase 2 — Schema Social Media

Tabelas novas (todas com RLS por `user_systems` + roles):

| Tabela | Função |
|---|---|
| `sm_clients` | clientes/marcas (briefing, identidade, links úteis) |
| `sm_campaigns` | campanhas por cliente |
| `sm_social_networks` | redes cadastradas (Instagram, TikTok…) |
| `sm_content_types` | tipos de conteúdo (Reels, Story, Carrossel…) |
| `sm_posts` | card principal — equivale a "task" do TI, com cliente/rede/tipo/data/status/prioridade |
| `sm_post_approvals` | fluxo de aprovação interna + cliente |
| `sm_post_comments` | comentários com menções |
| `sm_post_attachments` | anexos (reusa bucket `task-attachments` com prefixo `sm/`) |
| `sm_ideas` | banco de ideias |
| `sm_briefings` | briefings por cliente/campanha |
| `sm_metrics` | métricas manuais por post |
| `sm_tasks` | tarefas operacionais (não-conteúdo), com recorrência |
| `sm_client_users` | mapa cliente ↔ usuário aprovador (portal do cliente) |

Status do Kanban Social como enum: `ideia`, `roteiro`, `design`, `revisao_interna`, `aprovacao_cliente`, `agendado`, `publicado`, `reprovado`.

---

## Fase 3 — Páginas Social Media

Estrutura espelhando o TI atual:

```text
src/pages/social/
  Dashboard.tsx          KPIs: planejados, publicados, aprovações pendentes,
                         campanhas ativas, atrasados, entregas da semana
  ManagerDashboard.tsx   visão por cliente / responsável / gargalos
  Kanban.tsx             8 colunas do fluxo de conteúdo
  Tasks.tsx              tarefas operacionais (reusa lógica de recorrência do TI)
  FocusMode.tsx          tarefas + posts do dia agrupados por prioridade
  EditorialCalendar.tsx  mensal/semanal/diário com drag-and-drop
  ContentLibrary.tsx     biblioteca de criativos/legendas
  Approvals.tsx          fila de aprovação interna + cliente
  Clients.tsx            CRUD de clientes/marcas
  Campaigns.tsx          CRUD de campanhas
  IdeaBank.tsx           ideias → converter em post/tarefa
  Briefings.tsx          briefings por cliente/campanha
  PublishingSchedule.tsx agenda de publicações com filtros
  Metrics.tsx            input manual + dashboard comparativo
  Reports.tsx            por cliente/campanha/rede/equipe + export PDF/Excel
  Ranking.tsx            produtividade, pontualidade, retrabalho
  Admin.tsx              usuários + permissões SM + cadastros base
  ClientPortal.tsx       /social/portal — visão limitada do aprovador
```

**Componentes reutilizados:** `TaskCard`, `CreateTaskDialog`, `TaskComments`, `TaskAttachments`, `KanbanBoard`, `EmptyState`, `PageHeader`, `StatusBadge`, `UserXPBadge`, sistema de notificações, modo foco, exportadores de relatório. Adaptados via props/variants — sem fork.

---

## Fase 4 — Portal do Cliente

- Role `cliente` em `user_social_roles` vinculada a um `sm_client_id`
- RLS filtra `sm_posts` apenas dos clientes vinculados
- Layout reduzido (sem sidebar admin), só `/social/portal/aprovacoes` e `/social/portal/calendario`
- Aprovar/reprovar/comentar grava em `sm_post_approvals`

---

## Fase 5 — Migração suave e admin

- Página `/ti/admin` ganha aba "Acesso a Sistemas" para conceder/revogar TI/Social por usuário
- `/social/admin` espelha funcionalidade de admin do TI mas só para roles SM
- Admin TI atual (timaracas) recebe automaticamente admin SM

---

## Detalhes técnicos

- **Sem alterar `src/integrations/supabase/client.ts` nem `types.ts`** (regerados).
- **Edge function nova:** `sm-spawn-recurring-posts` (espelho de `spawn-recurring-tasks` para posts recorrentes).
- **Realtime:** habilitar em `sm_posts`, `sm_post_comments`, `sm_post_approvals`.
- **Storage:** reusar bucket `task-attachments`, separar por prefixo `sm/{client_id}/...`.
- **Notificações:** estender tabela `notifications` com coluna opcional `system` (`ti`|`social`) — default `ti` para preservar dados.
- **Rotas legadas → TI:** `<Route path="/" element={<Navigate to="/ti" replace />} />` para `/`, `/kanban`, `/tasks`, `/focus`, `/automacoes`, `/manager`, `/reports`, `/ranking`, `/notifications`, `/dependencies`, `/support`, `/admin`. Mantém `/auth` redirecionando para `/select-system`.

---

## Entrega em ondas (cada onda é deployável)

| Onda | Conteúdo | Risco |
|---|---|---|
| **1** | `user_systems`, `/select-system`, prefixo `/ti/*`, redirects, bloqueio por permissão | Baixo — só roteamento |
| **2** | Schema SM completo + admin de permissões SM | Baixo — tabelas novas isoladas |
| **3** | Dashboard, Kanban, Tarefas, Calendário Editorial, Clientes, Campanhas | Médio |
| **4** | Aprovações, Briefings, Banco de Ideias, Biblioteca, Agenda, Métricas | Médio |
| **5** | Relatórios, Ranking, Modo Foco, Painel Gestor SM | Baixo |
| **6** | Portal do Cliente + recorrência de posts | Médio |

---

## Tamanho e tempo

Isto é um **projeto grande** — o equivalente a refazer ~70% do app para um novo domínio de negócio. Estimativa: **6 mensagens/iterações** seguindo as ondas acima. Cada onda deixa o app funcional para que você possa validar antes da próxima.

**Quero começar pela Onda 1** (fundação + tela de seleção + redirects) para garantir que nada do TI quebra. Confirmo antes de seguir para as próximas ondas. OK?