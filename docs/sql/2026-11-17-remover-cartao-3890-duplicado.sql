-- 17/11/2026: o Nubank passou a mandar o número 3890 na mesma conta do cartão 5327 (croma-platinum).
-- O Open Finance criou um segundo cartão e reimportou as compras parceladas que já estão no 5327.
-- Este script devolve a conta ao cartão 5327 e apaga o(s) cartão(ões) 3890 com as compras repetidas (e parcelas).
-- Pode rodar de novo sem problema.
begin;
update pluggy_contas set cartao_final = '5327' where account_id = 'cac61017-ee09-4b3d-8934-5ee55b15d7ce';
delete from despesas where cartao_id in (select id from cartoes where final = '3890' and grupo_id = '00000000-0000-0000-0000-000000000001') and origem = 'pluggy';
delete from cartoes where final = '3890' and grupo_id = '00000000-0000-0000-0000-000000000001'
  and not exists (select 1 from despesas d where d.cartao_id = cartoes.id);
commit;
