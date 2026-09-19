import { expect, test } from "bun:test";
import { lerPlanilhaDePara } from "@/lib/depara";

test("importa CSV com delimitador e aspas sem duplicar estabelecimentos", async () => {
  const arquivo = new File(
    ['descricao;categoria;subcategoria\n"Mercearia; Joana 18";Compras;Supermercado\n"Mercearia; Joana 18";Outro;Outro\n'],
    "de-para.csv",
    { type: "text/csv" },
  );
  const linhas = await lerPlanilhaDePara(arquivo);
  expect(linhas).toHaveLength(1);
  expect(linhas[0]?.categoria).toBe("Compras");
  expect(linhas[0]?.subcategoria).toBe("Supermercado");
});

test("rejeita planilha legada e tamanho excessivo", async () => {
  await expect(lerPlanilhaDePara(new File(["teste"], "antigo.xls"))).rejects.toThrow(".xls");
  await expect(lerPlanilhaDePara(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.csv"))).rejects.toThrow("5 MB");
});
