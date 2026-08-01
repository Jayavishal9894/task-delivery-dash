-- 1. Shareable invite code per group
ALTER TABLE public.workspaces ADD COLUMN invite_code text;
UPDATE public.workspaces SET invite_code = upper(substr(md5(random()::text || id::text), 1, 8)) WHERE invite_code IS NULL;
ALTER TABLE public.workspaces ALTER COLUMN invite_code SET NOT NULL;
ALTER TABLE public.workspaces ALTER COLUMN invite_code SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
CREATE UNIQUE INDEX workspaces_invite_code_key ON public.workspaces (invite_code);

-- 2. Completion-verification fields on team tasks
ALTER TABLE public.team_tasks
  ADD COLUMN submitted_at timestamp with time zone,
  ADD COLUMN proof_text text,
  ADD COLUMN proof_photo_path text,
  ADD COLUMN review_status text NOT NULL DEFAULT 'none',
  ADD COLUMN review_comment text,
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN reviewed_at timestamp with time zone;

-- 3. Join a group via invite code (security definer: no broad workspace SELECT needed)
CREATE OR REPLACE FUNCTION public.join_workspace_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare ws_id uuid;
begin
  select id into ws_id from public.workspaces where upper(invite_code) = upper(trim(_code));
  if ws_id is null then
    raise exception 'Invalid invite code';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, auth.uid(), 'member')
  on conflict (workspace_id, user_id) do nothing;
  return ws_id;
end;
$$;
GRANT EXECUTE ON FUNCTION public.join_workspace_by_code(text) TO authenticated;

-- 4. Proof-photo storage access (bucket 'task-proofs', path: {task_id}/{filename})
CREATE POLICY "Assignees can upload proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-proofs'
  AND EXISTS (
    SELECT 1 FROM public.team_tasks tt
    WHERE tt.id = (storage.foldername(name))[1]::uuid
      AND tt.assigned_to = auth.uid()
  )
);

CREATE POLICY "Group members can view proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-proofs'
  AND EXISTS (
    SELECT 1 FROM public.team_tasks tt
    WHERE tt.id = (storage.foldername(name))[1]::uuid
      AND public.is_workspace_member(auth.uid(), tt.workspace_id)
  )
);