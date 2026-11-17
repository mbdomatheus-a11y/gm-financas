-- 17/11/2026: parcelas importadas pelo Open Finance no cartão final 3890 caíram na fatura aberta (dez/2026).
-- Recalcula cada parcela pela data da compra e pelo ciclo do cartão:
-- parcela 1 = vencimento do mês da compra se o dia for antes do fechamento, senão do mês seguinte;
-- as demais, um mês depois da anterior. Fatura já vencida fica paga.
-- Exemplo: SALTON 23/12/2025 em 2x passa de 16/12/2026 e 16/01/2027 para 16/01/2026 e 16/02/2026 (pagas).
with c as (
  select id, dia_fechamento f, dia_vencimento v from cartoes where final = '3890' or apelido ilike '%3890%'
), calc as (
  select d.id,
    (date_trunc('month', d.data_primeira_parcela)
      + case when extract(day from d.data_primeira_parcela) < c.f then interval '0 month' else interval '1 month' end
      + (c.v - 1) * interval '1 day')::date v1
  from despesas d join c on c.id = d.cartao_id
  where d.origem = 'pluggy' and d.total_parcelas > 1
)
update parcelas pa
set vencimento = (calc.v1 + (pa.numero - 1) * interval '1 month')::date,
    paga = (calc.v1 + (pa.numero - 1) * interval '1 month')::date < current_date
from calc
where calc.id = pa.despesa_id;
