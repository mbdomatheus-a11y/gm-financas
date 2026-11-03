import { useEffect, useState } from "react";

/**
 * 03/11/2026: aviso de conexão do site. Hoje mostra o estado e avisa que lançamentos
 * precisam de internet. A fila de sincronização offline virá na próxima etapa.
 */
export function AvisoConexao() {
  const [online, setOnline] = useState(true);
  const [voltou, setVoltou] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    setOnline(navigator.onLine);
    const naoOnline = () => {
      setOnline(false);
      setVoltou(false);
    };
    const online_ = () => {
      setOnline(true);
      setVoltou(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVoltou(false), 3000);
    };
    window.addEventListener("offline", naoOnline);
    window.addEventListener("online", online_);
    return () => {
      window.removeEventListener("offline", naoOnline);
      window.removeEventListener("online", online_);
      clearTimeout(timer);
    };
  }, []);

  if (online && !voltou) return null;
  return (
    <div
      role="status"
      className={`fixed inset-x-0 top-0 z-[100] px-4 py-2 text-center text-sm font-medium ${
        online ? "bg-emerald-600 text-white" : "bg-amber-500 text-black"
      }`}
    >
      {online
        ? "Conexão restabelecida."
        : "Sem internet. Você pode ver os dados já carregados. Lançamentos precisam de conexão para serem salvos."}
    </div>
  );
}
