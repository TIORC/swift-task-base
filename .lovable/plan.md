
# TaskFlow — IT Team Task Management System

## Overview
Build the foundational structure of a SaaS task management system for IT teams, using Lovable Cloud (Supabase) with a dark navy theme.

## 1. Authentication
- Login and signup pages using Supabase Auth (email/password)
- Persistent session with `onAuthStateChange`
- Protected routes (redirect to login if not authenticated)
- Password reset flow with `/reset-password` page

## 2. Database Schema (Lovable Cloud)
- **profiles** table: `id (uuid, FK to auth.users)`, `full_name`, `avatar_url`, `created_at` — with auto-create trigger on signup
- **user_roles** table: `id`, `user_id (FK)`, `role (enum: admin, member)` — separate from profiles for security
- **tasks** table: `id`, `title`, `description`, `status (enum: backlog, todo, in_progress, review, done)`, `priority (enum: low, medium, high, urgent)`, `assigned_to (FK)`, `created_by (FK)`, `created_at`, `updated_at`
- **time_logs** table: `id`, `task_id (FK)`, `user_id (FK)`, `duration_minutes`, `description`, `logged_at`
- RLS policies so users can only access their team's data

## 3. Layout & Navigation
- **Dark navy SaaS theme** — navy blue sidebar, clean dark tones
- Fixed sidebar with icon + text, collapsible to icon-only mode
- Pages with placeholder content:
  - **Dashboard** (`/`) — welcome message, summary cards
  - **Kanban** (`/kanban`) — placeholder board layout
  - **Tasks** (`/tasks`) — placeholder task list
  - **Notifications** (`/notifications`) — placeholder list
- Active route highlighting in sidebar
- User avatar + name in sidebar footer with logout option

## 4. Design System
- Dark navy palette: backgrounds `#0f172a` / `#1e293b`, accent `#3b82f6`, text `#f1f5f9`
- Clean typography, rounded cards, subtle borders
- Responsive layout (sidebar collapses on mobile)
