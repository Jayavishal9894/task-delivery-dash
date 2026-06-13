
DROP POLICY "Anyone can join waitlist" ON public.waitlist;
REVOKE SELECT ON public.waitlist FROM anon, authenticated;
CREATE POLICY "Anyone can join waitlist" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (length(email) BETWEEN 3 AND 320 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
