-- =========================================================
-- Permissões das tabelas (o projeto exige GRANT explícito).
-- As regras de linha (RLS) da migração anterior continuam valendo:
-- os GRANTs abaixo só liberam o acesso, e o RLS decide QUAIS linhas.
-- =========================================================

-- Servidor (funções): acesso total
grant select, insert, update, delete on public.perfis, public.admins, public.agendamentos, public.push_inscricoes to service_role;

-- Usuárias logadas (clientes e Rebeca) — filtrado pelo RLS
grant select, update on public.perfis to authenticated;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.agendamentos to authenticated;
grant select, insert, update, delete on public.push_inscricoes to authenticated;

-- Visitantes sem login: nenhum acesso às tabelas
-- (só à função pública horarios_ocupados, liberada na migração anterior)

-- Funções usadas dentro das regras
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.horarios_ocupados(date, date) to service_role;
