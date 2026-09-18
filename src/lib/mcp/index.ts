import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarDespesas from "./tools/listar-despesas";
import listarInvestimentos from "./tools/listar-investimentos";
import resumoMensal from "./tools/resumo-mensal";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "financas",
  title: "Finanças",
  version: "0.1.0",
  instructions:
    "Ferramentas de consulta do Control ALL. Use-as para analisar o resumo mensal, as despesas e os investimentos do casal autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [resumoMensal, listarDespesas, listarInvestimentos],
});
