REVOKE EXECUTE ON FUNCTION public.join_workspace_by_code(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.join_workspace_by_code(text) TO authenticated;