# Vincular usuários da Gestão a um setor

## Situação atual

Já existe a estrutura de vínculo usuário–setor: a tabela `user_sectors` (usuário + setor), o diálogo "Setores permitidos" na Administração e a função de banco `has_sector_access`, usada na política de leitura das automações. **Nenhuma tabela nova de vínculo será criada.**

Três problemas hoje:

1. Quem não tem setor definido cai automaticamente em "TI" e passa a ver as automações de TI (regra de fallback no banco).
2. O acesso global vem só do cargo (admin/gestor), não de uma permissão explícita.
3. O setor não aparece na listagem de usuários e não há registro de quem alterou.

## O que será feito

### 1. Administração de usuários

- O diálogo de setores passa a ter também o interruptor **"Ver automações de todos os setores"** (permissão global explícita).
- A lista de usuários mostra o setor atual como etiqueta; quem não tem setor aparece com **"Setor não definido"** em destaque âmbar.
- Ao criar um usuário, o formulário pede o setor; ele é obrigatório se o usuário não receber acesso global.
- Toda troca de setor fica registrada no histórico administrativo (quem alterou, quando, de qual setor para qual).

### 2. Tela de Automações

- Usuário setorial: vê apenas automações do próprio setor; o filtro de setor vem preenchido e travado, sem a opção "Todos os setores".
- Usuário global: continua vendo tudo e podendo filtrar por setor.
- Usuário sem setor e sem acesso global: a tela mostra um aviso claro pedindo que um administrador defina o setor, e nenhuma automação é carregada.
- Ao criar automação ou solicitação, o setor é preenchido com o setor do usuário e fica travado; usuários globais escolhem o setor.

### 3. Segurança (banco de dados)

- Remoção do fallback "sem setor = TI".
- `has_sector_access` passa a considerar: acesso global explícito, papel admin, ou setor exatamente igual ao vínculo do usuário.
- Política de escrita das automações valida o setor no momento de criar/alterar — o front não consegue enviar um setor diferente do permitido.
- Tarefas, mensagens, anexos, bloqueios e históricos continuam presos ao acesso da automação-mãe (funções `can_view_automation` / `can_manage_automation`), que passam a herdar a nova regra. Acesso direto por ID de outro setor retorna vazio.

## Detalhes técnicos

**Migrations necessárias (sim, 2 blocos no mesmo arquivo):**

- `user_global_sector_access (user_id uuid PK, granted_by uuid, created_at)` — permissão explícita de acesso global, com GRANTs e RLS (leitura do próprio registro; gestão só por admin).
- `user_sector_history (id, user_id, old_sector, new_sector, changed_by, changed_at)` — trilha administrativa, leitura só por admin.
- `has_global_sector_access(_user_id uuid)` — SECURITY DEFINER: admin OR linha em `user_global_sector_access`.
- `has_sector_access` reescrita sem o fallback TI, usando `has_global_sector_access`.
- `has_global_automation_access` passa a delegar para `has_global_sector_access` (mantém admin, deixa de dar acesso total a lider/dev por cargo).
- Política INSERT/UPDATE de `public.automations`: exige `has_sector_access(auth.uid(), sector)` no `WITH CHECK`.

**Arquivos alterados:**

- `src/hooks/useUserSectors.tsx` — `useSectorVisibility` passa a consultar a permissão global do banco e a expor `hasSector`; remove o default "TI".
- `src/components/UserSectorsDialog.tsx` — interruptor de acesso global + gravação do histórico.
- `src/pages/AdminPanel.tsx` — etiqueta de setor / "Setor não definido" na listagem e setor no formulário de criação.
- `src/pages/AutomacoesPage.tsx` — bloqueio com aviso quando não há setor; filtro travado.
- `src/components/automations/AutomationFilters.tsx` — esconde "Todos os setores" para usuário setorial.
- `src/components/automations/CreateAutomationDialog.tsx` e `RequestAutomationDialog.tsx` — setor travado no setor do usuário.

**Validação:** teste dos três cenários (setor único, acesso global, sem setor) no navegador, verificando console limpo e ausência de dados de outros setores.
