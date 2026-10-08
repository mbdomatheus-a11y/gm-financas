-- Perfis antigos estavam sem e-mail, o que fazia o convite de grupo dizer que o
-- destinatário não tinha conta ativa. Preenche a partir da autenticação.
update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id and p.email is null and u.email is not null
  and u.email not like '%@financascasal.app';
