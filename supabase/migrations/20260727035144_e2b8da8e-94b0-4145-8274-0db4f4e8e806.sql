-- ROLE ENUM
create type public.workspace_role as enum ('manager', 'member');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- WORKSPACES
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.workspaces to authenticated;
grant all on public.workspaces to service_role;
alter table public.workspaces enable row level security;

-- WORKSPACE MEMBERS
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
grant select, insert, update, delete on public.workspace_members to authenticated;
grant all on public.workspace_members to service_role;
alter table public.workspace_members enable row level security;

-- INVITES
create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'member',
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);
grant select, insert, update, delete on public.workspace_invites to authenticated;
grant all on public.workspace_invites to service_role;
alter table public.workspace_invites enable row level security;

-- TEAM TASKS
create table public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  due_at timestamptz not null,
  priority text not null default 'medium',
  urgent boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  assigned_to uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz,
  working_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index team_tasks_workspace_idx on public.team_tasks (workspace_id);
create index team_tasks_assigned_idx on public.team_tasks (assigned_to);
grant select, insert, update, delete on public.team_tasks to authenticated;
grant all on public.team_tasks to service_role;
alter table public.team_tasks enable row level security;

-- HELPER FUNCTIONS (security definer, avoid recursive RLS)
create or replace function public.is_workspace_member(_user_id uuid, _workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = _user_id and workspace_id = _workspace_id
  )
$$;

create or replace function public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role public.workspace_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = _user_id and workspace_id = _workspace_id and role = _role
  )
$$;

create or replace function public.shares_workspace(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.workspace_members m1
    join public.workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = _a and m2.user_id = _b
  )
$$;

-- POLICIES: profiles
create policy "Users can view own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "Users can view workspace peers" on public.profiles
  for select to authenticated using (public.shares_workspace(auth.uid(), id));
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "Users can update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- POLICIES: workspaces
create policy "Members can view workspace" on public.workspaces
  for select to authenticated using (public.is_workspace_member(auth.uid(), id));
create policy "Users can create workspaces" on public.workspaces
  for insert to authenticated with check (owner_id = auth.uid());
create policy "Managers can update workspace" on public.workspaces
  for update to authenticated using (public.has_workspace_role(auth.uid(), id, 'manager'))
  with check (public.has_workspace_role(auth.uid(), id, 'manager'));
create policy "Managers can delete workspace" on public.workspaces
  for delete to authenticated using (public.has_workspace_role(auth.uid(), id, 'manager'));

-- POLICIES: workspace_members
create policy "Members can view members" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "Owner or manager can add members" on public.workspace_members
  for insert to authenticated with check (
    public.has_workspace_role(auth.uid(), workspace_id, 'manager')
    or exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
  );
create policy "Managers can update members" on public.workspace_members
  for update to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'manager'))
  with check (public.has_workspace_role(auth.uid(), workspace_id, 'manager'));
create policy "Managers can remove members" on public.workspace_members
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'manager'));

-- POLICIES: invites
create policy "Managers can view invites" on public.workspace_invites
  for select to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'manager'));
create policy "Managers can create invites" on public.workspace_invites
  for insert to authenticated with check (
    public.has_workspace_role(auth.uid(), workspace_id, 'manager') and invited_by = auth.uid()
  );
create policy "Managers can update invites" on public.workspace_invites
  for update to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'manager'))
  with check (public.has_workspace_role(auth.uid(), workspace_id, 'manager'));
create policy "Managers can delete invites" on public.workspace_invites
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'manager'));

-- POLICIES: team_tasks
create policy "Managers can view all workspace tasks" on public.team_tasks
  for select to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'manager'));
create policy "Members can view assigned tasks" on public.team_tasks
  for select to authenticated using (assigned_to = auth.uid());
create policy "Managers can create tasks" on public.team_tasks
  for insert to authenticated with check (
    public.has_workspace_role(auth.uid(), workspace_id, 'manager') and created_by = auth.uid()
  );
create policy "Managers can update tasks" on public.team_tasks
  for update to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'manager'))
  with check (public.has_workspace_role(auth.uid(), workspace_id, 'manager'));
create policy "Assignees can update their tasks" on public.team_tasks
  for update to authenticated using (assigned_to = auth.uid()) with check (assigned_to = auth.uid());
create policy "Managers can delete tasks" on public.team_tasks
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'manager'));

-- updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();
create trigger workspaces_updated_at before update on public.workspaces for each row execute function public.update_updated_at_column();
create trigger workspace_members_updated_at before update on public.workspace_members for each row execute function public.update_updated_at_column();
create trigger workspace_invites_updated_at before update on public.workspace_invites for each row execute function public.update_updated_at_column();
create trigger team_tasks_updated_at before update on public.team_tasks for each row execute function public.update_updated_at_column();

-- new user: create profile + auto-accept pending invites
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email,''), '@', 1)))
  on conflict (id) do nothing;

  for inv in
    select * from public.workspace_invites
    where lower(email) = lower(coalesce(new.email, '')) and accepted_at is null
  loop
    insert into public.workspace_members (workspace_id, user_id, role)
    values (inv.workspace_id, new.id, inv.role)
    on conflict (workspace_id, user_id) do nothing;
    update public.workspace_invites set accepted_at = now() where id = inv.id;
  end loop;

  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- realtime
alter table public.team_tasks replica identity full;
alter publication supabase_realtime add table public.team_tasks;