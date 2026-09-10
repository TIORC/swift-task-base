UPDATE public.inventory_assets a
SET collaborator_id = COALESCE(a.collaborator_id, m.collaborator_id),
    department = COALESCE(a.department, m.department),
    location_id = COALESCE(a.location_id, m.to_location_id),
    updated_at = now()
FROM (
  SELECT DISTINCT ON (item_id) item_id, collaborator_id, department, to_location_id
  FROM public.inventory_movements
  WHERE type = 'out' AND collaborator_id IS NOT NULL
  ORDER BY item_id, created_at DESC
) m
WHERE a.item_id = m.item_id
  AND a.status = 'in_use'
  AND a.collaborator_id IS NULL;