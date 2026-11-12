## Request tracking chat
- Requester chat reads and uploads must use the token-validated solicitacoes function; anonymous visitors must never read application tables directly.
- Poll only incremental messages while the requester conversation is visible; merge by message ID to avoid repeated history downloads and duplicates.