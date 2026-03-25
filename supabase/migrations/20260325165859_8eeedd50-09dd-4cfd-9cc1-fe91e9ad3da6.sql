
-- Add new status values to task_status enum
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'pending' AFTER 'backlog';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'discarded' AFTER 'done';
