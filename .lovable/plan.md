# Gestão de TI — XP unificado, solicitações de automação, tarefas internas e acesso por setor

## Causa das divergências de XP (diagnóstico já feito)

Hoje existem **quatro cálculos independentes** de pontuação:

1. `useGamification.useRanking` — soma tarefas + automações do time fixo `TI_TEAM`.
2. `useGamification.useMyGamification` — recalcula tudo de novo só para o usuário logado.
3. `useTeamMetrics` — lê colunas que **não existem** (`tasks.assignee_id`, `automations.owner_id`), então volta vazio/errado e mostra números diferentes na aba Equipe.
4. `UserXPBadge` (perfil na barra lateral) — usa o hook 2, sem atualização quando algo é concluído em outra tela.

Além disso, a tabela `xp_logs` existe no banco mas **não é usada** pelas telas, e as medalhas são recalculadas na hora em cada componente. Resultado: valores diferentes em /ranking, perfil, Meu Progresso e Medalhas.

## 1. Fonte única de verdade para gamificação

- Criar uma função no banco (`public.get_gamification()`) que devolve, por usuário: XP total, tarefas concluídas, chamados concluídos, automações concluídas, XP semente, medalhas do mês e do ano — sempre a partir da **primeira** conclusão registrada (`task_events` / `automation_events`), o que torna a contagem idempotente (reabrir e concluir de novo não pontua duas vezes).
- Criar um único hook `useGamificationData()` que consome essa função. `useRanking`, `useMyGamification`, `UserXPBadge`, aba Equipe e Medalhas passam todos a ler esse mesmo hook/cache.
- `useTeamMetrics` corrigido para as colunas reais (`assigned_to`) e reduzido a horas trabalhadas (é o que a aba Equipe exibe).
- Invalidação central: ao concluir tarefa, chamado, tarefa de automação ou automação, o cache de gamificação é invalidado — perfil, ranking e Meu Progresso atualizam juntos.
- Recarregar a página não muda nada, pois tudo vem do mesmo cálculo no banco.

## 2. Solicitações de automação em /automacoes

Reaproveita as tabelas já existentes: `automations`, `automation_events` (histórico/linha do tempo), `automation_comments` (chat), `automation_subtasks` (tarefas internas), `user_automation_visibility`.

Banco (aditivo, sem apagar dados):
- Novos status na lista da aplicação: Solicitada, Em análise, Aguardando informações, Aprovada, Em desenvolvimento, Em testes, Aguardando validação, Alteração solicitada, Concluída, Cancelada — mapeados sobre a coluna `status` atual, preservando os registros existentes.
- Nova tabela `automation_attachments` (imagens/vídeos) + bucket de arquivos com limite de tamanho e validação de tipo.

Interface:
- Botão "Solicitar automação" aberto a qualquer colaborador: título, descrição, prioridade sugerida, setor preenchido automaticamente pelo setor do usuário.
- Tela de acompanhamento com abas: Detalhes, Chat, Anexos, Tarefas, Linha do tempo — reaproveitando o painel de detalhes atual.
- Chat por solicitação com autor, data/hora e atualização em tempo real; estados de carregando, enviando, sucesso e erro com opção de tentar de novo.
- O solicitante vê tudo, mas não edita responsável, prioridade definitiva, status, complexidade nem bônus.

## 3. Tarefas internas e XP por complexidade

- As tarefas usam `automation_subtasks`, ampliada com descrição, status, prazo, data de conclusão e responsável — seguindo o visual do módulo de Chamados.
- Nova tabela `xp_ledger` (origem, usuário, automação/tarefa, motivo, valor, autor, data) como trilha única de auditoria da pontuação; alimentada por gatilho no banco, portanto idempotente.
- 1 XP na **primeira** conclusão de cada tarefa interna. Reabrir não repontua. Invalidar/excluir uma tarefa concluída gera um lançamento negativo com motivo registrado.
- Bônus na conclusão da automação, por complexidade, configurável em tabela (`xp_settings`): Simples 1, Média 3, Complexa 5, Estratégica 8.
- Só perfis autorizados definem complexidade e bônus.

## 4. Isolamento por setor (tenant)

- Regra no banco, via políticas de acesso, não só na tela: o colaborador vê apenas automações do próprio setor e as que ele mesmo abriu.
- Acesso global para Qualidade/QA, Diretoria, TI/Desenvolvedores e Administradores — apoiado nas funções já existentes `has_role` e `has_sector_access`, ampliadas conforme necessário.
- As mesmas regras valem para chat, anexos, tarefas internas e histórico (nada acessível trocando ID na URL).
- Tentativas de acesso negado ficam registradas.

## Pontos que dependem de decisão sua

1. "Qualidade/QA" e "Diretoria" não existem hoje como perfis — hoje há admin, gestor, líder, membro, dev, suporte. Posso criar dois perfis novos ou tratar Diretoria como "gestor" e QA como um perfil novo. Qual prefere?
2. O XP semente do Welder (3600) e do Angel (1750) continua valendo na nova contagem — confirme que sim.
3. Tarefa interna de automação vale 1 XP; automação concluída hoje vale 50 XP. Mantenho os 50 **mais** o bônus de complexidade, ou o bônus substitui os 50?

## Entrega

Ao final informo arquivos alterados, mudanças no banco, regras de permissão, nova fórmula de XP, testes dos fluxos principais e verificação de console limpo.
