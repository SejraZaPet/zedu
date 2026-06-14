DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;
DROP FUNCTION IF EXISTS public.auto_approve_on_email_confirm();

-- Reset the test parent we just registered so the next test is clean (and to verify pending screen)
UPDATE public.profiles SET status='pending' WHERE id='e2fb6854-0910-4310-95f0-76128f58347a';