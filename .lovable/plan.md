
# Almoxarifado TI

Novo módulo dentro do sistema Gestão TI. Todos os usuários autenticados **visualizam**; apenas membros da TI (admin, gestor, líder, membro com sistema `ti`) podem **cadastrar, editar, movimentar, descartar**.

## 1. Banco de dados (migration única)

Tabelas em `public` — todas com `GRANT` para authenticated + service_role, RLS ativo, `updated_at` trigger.

```text
inventory_categories        (id, name, description)
inventory_locations         (id, name, description)
inventory_items             (id, name, sku, category_id, location_id,
                             tracked_individually bool,      -- true = por patrimônio
                             unit_price numeric,
                             min_stock int, ideal_stock int,
                             quantity int,                    -- só para não-patrimoniados
                             status text: active|inactive,
                             notes, created_by)
inventory_assets            (id, item_id, patrimony_number unique,
                             serial_number, value numeric,
                             status: available|in_use|damaged|discarded|maintenance,
                             location_id, assigned_to uuid, acquired_at,
                             notes)
inventory_movements         (id, item_id, asset_id nullable,
                             type: in|out|transfer|damage|discard|adjust,
                             quantity int,                    -- 1 quando asset
                             reason, notes,
                             from_location_id, to_location_id,
                             performed_by uuid, created_at)
inventory_requests          (id, requester_id, item_id, quantity,
                             justification, status: pending|approved|rejected|delivered,
                             reviewed_by, reviewed_at, created_at)
```

### RLS
- `SELECT`: `authenticated` → todas as tabelas (visualização global).
- `INSERT/UPDATE/DELETE`: apenas quando `has_ti_write(auth.uid())` = true.
  - Função `has_ti_write` = admin OR gestor OR lider OR (tem sistema `ti` habilitado E papel membro).
- `inventory_requests.INSERT` aberto para qualquer authenticated (solicitar); update só TI.
- Bloqueio de exclusão de item com movimentação: função `prevent_item_delete_with_movements` como trigger BEFORE DELETE.

### Regras de negócio (triggers/funções)
- `apply_movement()` trigger AFTER INSERT em `inventory_movements`:
  - Para item não-patrimoniado: `in`/`adjust+` soma, `out`/`discard`/`damage` subtrai `quantity`.
  - Para asset: atualiza `status` e `location_id`/`assigned_to` conforme tipo.
  - Rejeita se `out` deixaria quantidade negativa.

## 2. Frontend

Rota base `/almoxarifado` com sub-rotas via tabs internas para manter simples:

```text
src/pages/almoxarifado/
  AlmoxarifadoLayout.tsx      (tabs: Dashboard | Itens | Entradas | Saídas |
                               Patrimônios | Danificados | Descartados |
                               Reposição | Solicitações | Relatórios | Config)
  Dashboard.tsx               cards: total itens, valor total, em uso, danificados,
                               alertas de estoque baixo, últimas movimentações
  Items.tsx                   CRUD itens + filtros (categoria, local, status, busca)
  Movements.tsx               reutilizado por Entradas/Saídas com filtro por tipo
  Assets.tsx                  lista/edita patrimônios, histórico por asset
  Damaged.tsx / Discarded.tsx views filtradas de assets
  Restock.tsx                 lista automática: qtd_disponivel <= min_stock,
                               sugestão = ideal - disponivel, exportar CSV
  Requests.tsx                solicitações; TI aprova/entrega
  Reports.tsx                 filtros por período/categoria, exportação CSV + print
  Settings.tsx                categorias e locais
```

Componentes compartilhados:
```text
src/components/almoxarifado/
  ItemFormDialog.tsx
  MovementDialog.tsx     (validação: saída ≤ disponível)
  AssetFormDialog.tsx
  StockBadge.tsx         (crítico/baixo/ok)
  SummaryCards.tsx
```

Hook `src/hooks/useInventory.ts` centraliza queries (React Query) — items, assets, movements, low-stock, dashboard KPIs.

Permissões: hook `useCanWriteInventory()` combina `useUserRole` + `useUserSystems('ti')` para desabilitar botões de escrita para não-TI.

## 3. Navegação e acesso
- `src/App.tsx`: rota `/almoxarifado` protegida por `ProtectedTI` (todos com sistema TI já entram; visualização é global mas o sistema é TI-only por ora — se quiser abrir a outros sistemas, adiciono depois).
- `src/components/AppSidebar.tsx`: novo item "Almoxarifado" (ícone `Package`) visível a todos os perfis.
- `src/hooks/useUserRole.tsx` + `src/lib/menu-access.ts`: registrar `/almoxarifado` liberado para todos os perfis.

## 4. UX
- Layout com `PageHeader`, tabs sticky, tabelas com busca e paginação client-side.
- Cards de resumo no Dashboard usam design tokens existentes (sem cores hardcoded).
- Botões de escrita ocultos/`disabled` para usuários fora da TI com tooltip "Somente TI".
- Exportação CSV nativa; botão "Imprimir" abre janela com HTML formatado (padrão já usado em SupportReport).

## 5. Ordem de execução
1. Migration (schema + RLS + triggers + função `has_ti_write`).
2. Após aprovação e regeneração de types: hook `useInventory`, componentes, páginas, rota, sidebar, menu-access.
3. Smoke test manual via preview.

Confirme para eu rodar a migration.
