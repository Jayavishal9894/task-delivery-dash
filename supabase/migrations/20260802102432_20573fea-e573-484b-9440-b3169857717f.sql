drop policy if exists "Assignees can upload proofs" on storage.objects;
create policy "Assignees can upload proofs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'task-proofs'
  and (storage.foldername(name))[1] in (
    select tt.id::text from public.team_tasks tt
    where tt.assigned_to = auth.uid()
  )
);

drop policy if exists "Group members can view proofs" on storage.objects;
create policy "Group members can view proofs"
on storage.objects for select to authenticated
using (
  bucket_id = 'task-proofs'
  and (storage.foldername(name))[1] in (
    select tt.id::text from public.team_tasks tt
    where public.is_workspace_member(auth.uid(), tt.workspace_id)
  )
);