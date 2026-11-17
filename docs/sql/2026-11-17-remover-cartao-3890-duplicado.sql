-- 17/11/2026: o Nubank passou a mandar o número 3890 na mesma conta do cartão 5327 (croma-platinum).
-- O Open Finance criou um segundo cartão em 08/11 e reimportou 31 compras parceladas que já estão no 5327.
-- Este script devolve a conta ao cartão 5327 e apaga o cartão 3890 com as compras repetidas (e suas parcelas).
begin;
update pluggy_contas set cartao_final = '5327' where account_id = 'cac61017-ee09-4b3d-8934-5ee55b15d7ce';
delete from despesas where cartao_id = '0488d154-d83b-48f8-b508-ce6fd85abf5f' and cartao_final = '3890' and origem = 'pluggy';
delete from cartoes where id = '0488d154-d83b-48f8-b508-ce6fd85abf5f' and final = '3890';
commit;
