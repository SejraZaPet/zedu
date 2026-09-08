ALTER FUNCTION public.submit_portfolio_assignment(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.submit_portfolio_assignment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_portfolio_assignment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_portfolio_assignment(uuid) TO authenticated;