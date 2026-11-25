-- E-mail da cliente (para recuperar a senha sozinha) e controle de envio
alter table public.perfis
    add column email text,
    add column recuperacao_em timestamptz;

alter table public.perfis
    add constraint perfis_email_formato check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- um e-mail por conta (sem diferenciar maiúsculas)
create unique index perfis_email_unico on public.perfis (lower(email));
