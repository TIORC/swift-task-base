## Request tracking chat
- Requester chat reads and uploads must use the token-validated solicitacoes function; anonymous visitors must never read application tables directly.
- Poll only incremental messages while the requester conversation is visible; merge by message ID to avoid repeated history downloads and duplicates.
- The public maintenance picker must load through the token-validated solicitacoes list action only when open; this preserves requester access without requiring a Gestão session.

## Task list pagination
- /tasks uses its own invoker-RLS paginated query with server-side filters and aggregates; keep useTasks unchanged for other screens to preserve their full-dataset behavior.