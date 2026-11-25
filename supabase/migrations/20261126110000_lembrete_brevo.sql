-- Toda segunda-feira às 09h (Salvador) usa a chave do Brevo para ela não expirar por inatividade
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
    'manter-chave-brevo',
    '0 12 * * 1',
    $$
    select net.http_post(
        url := 'https://herzntjzefolqmuuxllp.supabase.co/functions/v1/manter-email',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);
