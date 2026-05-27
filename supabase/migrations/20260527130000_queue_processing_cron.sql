-- ============================================================
-- Automatic queue processing via pg_cron.
--
-- Calls the process-queue Edge Function every 2 minutes so
-- scheduled broadcasts (WhatsApp, SMS, email) are sent on time
-- without needing an external cron trigger.
-- ============================================================

-- Enable pg_cron if not already active.
create extension if not exists pg_cron with schema extensions;

-- Grant usage so the cron job can call net functions.
grant usage on schema cron to postgres;

-- Schedule: every 2 minutes, hit the Edge Function.
-- Uses pg_net (built into Supabase) to make an HTTP POST.
select cron.schedule(
  'process-message-queue',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://lvizldmdficsfpgegehp.supabase.co/functions/v1/process-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{"action":"process_queue"}'::jsonb
  );
  $$
);
