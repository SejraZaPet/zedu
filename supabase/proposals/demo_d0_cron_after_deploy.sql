-- NÁVRH KE SCHVÁLENÍ – NEAPLIKOVÁNO.
-- Spustit až po nasazení upravených funkcí demo-expiry-reminders a demo-cleanup.
-- Adresa a X-Cron-Secret se převezmou ze stávající úlohy; žádná adresa ani tajná hodnota se nepíše sem.

DO $do$
DECLARE
  original_command text;
  reminder_command text;
  cleanup_jobid integer;
BEGIN
  SELECT jobid, command INTO cleanup_jobid, original_command
  FROM cron.job
  WHERE jobname = 'demo-cleanup-nightly';

  IF cleanup_jobid IS NULL OR original_command IS NULL THEN
    RAISE EXCEPTION 'demo-cleanup-nightly was not found';
  END IF;

  reminder_command := replace(original_command, '/functions/v1/demo-cleanup', '/functions/v1/demo-expiry-reminders');
  IF reminder_command = original_command THEN
    RAISE EXCEPTION 'demo-cleanup URL was not found in the existing command';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'demo-expiry-reminders-daily') THEN
    PERFORM cron.unschedule('demo-expiry-reminders-daily');
  END IF;

  -- 01:00 UTC = 02:00 CET / 03:00 CEST v Praze, vždy v pražském D−0.
  PERFORM cron.schedule('demo-expiry-reminders-daily', '0 1 * * *', reminder_command);

  -- 04:00 UTC = 05:00 CET / 06:00 CEST; nikdy před pražskou půlnocí D+1.
  PERFORM cron.alter_job(cleanup_jobid, schedule := '0 4 * * *');
END
$do$;
