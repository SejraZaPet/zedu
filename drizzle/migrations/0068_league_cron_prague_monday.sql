SELECT cron.unschedule('close-league-week');
SELECT cron.schedule('close-league-week', '5 22,23 * * 0',
  $$SELECT public.close_league_week() WHERE extract(isodow FROM now() AT TIME ZONE 'Europe/Prague') = 1 AND extract(hour FROM now() AT TIME ZONE 'Europe/Prague') = 0$$);