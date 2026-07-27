revoke all on function public.is_workspace_member(uuid, uuid) from public, anon;
revoke all on function public.has_workspace_role(uuid, uuid, public.workspace_role) from public, anon;
revoke all on function public.shares_workspace(uuid, uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, uuid, public.workspace_role) to authenticated;
grant execute on function public.shares_workspace(uuid, uuid) to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;