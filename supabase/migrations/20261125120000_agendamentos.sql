-- =========================================================
-- Studio Rebeca Cristina — banco de dados dos agendamentos
-- =========================================================

-- Perfis das clientes (nome e WhatsApp). Criados pela função "cadastro".
create table public.perfis (
    id        uuid primary key references auth.users (id) on delete cascade,
    nome      text not null check (char_length(nome) between 2 and 80),
    telefone  text not null unique check (telefone ~ '^55[0-9]{10,11}$'),
    criado_em timestamptz not null default now()
);

-- Quem é administradora (a Rebeca)
create table public.admins (
    user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
    select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Agendamentos
create table public.agendamentos (
    id          uuid primary key default gen_random_uuid(),
    cliente_id  uuid references auth.users (id) on delete set null,
    nome        text not null check (char_length(nome) between 1 and 80),
    telefone    text check (telefone is null or telefone ~ '^55[0-9]{10,11}$'),
    servicos    text[] not null check (cardinality(servicos) between 1 and 10),
    data        date not null,
    hora        text not null check (hora ~ '^[0-2][0-9]:[0-5][0-9]$'),
    observacao  text check (observacao is null or char_length(observacao) <= 500),
    status      text not null default 'pendente'
                check (status in ('pendente', 'confirmado', 'recusado', 'cancelado')),
    origem      text not null default 'site' check (origem in ('site', 'manual')),
    criado_em   timestamptz not null default now(),
    decidido_em timestamptz
);

-- Garante no banco que nunca existam dois agendamentos CONFIRMADOS no mesmo dia e horário
create unique index agendamentos_horario_confirmado
    on public.agendamentos (data, hora)
    where status = 'confirmado';

create index agendamentos_status_data on public.agendamentos (status, data);
create index agendamentos_cliente on public.agendamentos (cliente_id);

-- Celulares da Rebeca que recebem notificação
create table public.push_inscricoes (
    endpoint  text primary key,
    p256dh    text not null,
    auth      text not null,
    user_id   uuid not null references auth.users (id) on delete cascade,
    criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Segurança (Row Level Security)
-- ---------------------------------------------------------
alter table public.perfis          enable row level security;
alter table public.admins          enable row level security;
alter table public.agendamentos    enable row level security;
alter table public.push_inscricoes enable row level security;

-- Perfis: cada cliente vê e edita só o seu; a Rebeca vê todos
create policy "perfis_ver" on public.perfis
    for select using (id = auth.uid() or public.is_admin());
create policy "perfis_editar_proprio" on public.perfis
    for update using (id = auth.uid()) with check (id = auth.uid());

-- Admins: cada um só consegue ver a própria linha (para saber se é admin)
create policy "admins_ver_propria" on public.admins
    for select using (user_id = auth.uid());

-- Agendamentos: cliente vê os seus; a Rebeca vê, cria, altera e apaga todos.
-- (Clientes criam pedidos pela função "agendar", que valida tudo antes de gravar.)
create policy "agendamentos_ver" on public.agendamentos
    for select using (cliente_id = auth.uid() or public.is_admin());
create policy "agendamentos_admin_criar" on public.agendamentos
    for insert with check (public.is_admin());
create policy "agendamentos_admin_alterar" on public.agendamentos
    for update using (public.is_admin()) with check (public.is_admin());
create policy "agendamentos_admin_apagar" on public.agendamentos
    for delete using (public.is_admin());

-- Notificações: só a própria administradora gerencia os aparelhos dela
create policy "push_admin" on public.push_inscricoes
    for all using (user_id = auth.uid() and public.is_admin())
    with check (user_id = auth.uid() and public.is_admin());

-- ---------------------------------------------------------
-- Horários ocupados (público, sem dados pessoais) — o site usa
-- para não oferecer às clientes horários que já estão tomados
-- ---------------------------------------------------------
create or replace function public.horarios_ocupados(inicio date, fim date)
returns table (data date, hora text)
language sql stable security definer
set search_path = public
as $$
    select a.data, a.hora
    from public.agendamentos a
    where a.status = 'confirmado'
      and a.data between inicio and fim;
$$;

revoke all on function public.horarios_ocupados(date, date) from public;
grant execute on function public.horarios_ocupados(date, date) to anon, authenticated;

-- Atualização ao vivo da lista no painel da Rebeca
alter publication supabase_realtime add table public.agendamentos;
