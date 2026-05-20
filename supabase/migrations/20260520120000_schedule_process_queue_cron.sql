-- ============================================================
-- Reliable delivery for queued broadcasts.
--
-- Background: message_queue rows are written by send_broadcast (and the
-- per-lead automations) with status 'queued'. Until now the ONLY thing
-- that drained the queue was a best-effort, fire-and-forget call inside
-- the process-queue edge function, and only for *immediate* sends.
-- Anything scheduled for later (e.g. a WhatsApp seminar invite) was
-- never sent, because no cron existed to pick it up. The comment in
-- seminar-application/index.ts ("process-queue picks these up on its
-- cron") assumed a scheduler that was never created.
--
-- This migration enables pg_cron + pg_net and schedules a job that calls
-- the process-queue edge function once a minute to drain due messages.
--
-- ── ONE-TIME SETUP (run once in the SQL editor; NOT committed, since the
--    key is a secret) ──
--   select vault.create_secret(
--     '<SUPABASE_SERVICE_ROLE_KEY>',
--     'service_role_key',
--     'Used by the drain-message-queue cron to invoke edge functions');
--
-- process-queue runs with verify_jwt = false, so the call also works if
-- the secret is absent; the header is included for when JWT is required.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-runnable: remove any previous version of the job before rescheduling.
do $$
begin
  perform cron.unschedule('drain-message-queue');
exception
  when others then null;
end $$;

select cron.schedule(
  'drain-message-queue',
  '* * * * *',
  $cmd$
  select net.http_post(
    url     := 'https://lvizldmdficsfpgegehp.supabase.co/functions/v1/process-queue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets
           where name = 'service_role_key' limit 1), '')
    ),
    body    := jsonb_build_object('action', 'process_queue')
  );
  $cmd$
);
