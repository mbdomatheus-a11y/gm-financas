import {
  type LucideIcon,
  Calculator,
  Car,
  FileHeart,
  FolderOpen,
  HeartHandshake,
  Link2,
  MapPin,
  PawPrint,
  ReceiptText,
  ShoppingCart,
  Wallet,
} from "lucide-react";

import type { ModuloGlobal } from "@/hooks/useAuthData";

/** Cada módulo do site, com o destino principal e o texto curto do cartão. */
export const MODULOS_INFO = {
  financas: {
    to: "/dashboard",
    titulo: "Finanças",
    descricao: "Receitas, despesas, cartões, investimentos e faturas.",
    icon: Wallet,
  },
  lista: {
    to: "/lista-compras",
    titulo: "Lista de compras",
    descricao: "Lista compartilhada e aprovações.",
    icon: ShoppingCart,
  },
  veiculo: {
    to: "/veiculos",
    titulo: "Veículo",
    descricao: "Manutenção, documentos, garantias e alertas.",
    icon: Car,
  },
  pet: {
    to: "/pets",
    titulo: "Pet",
    descricao: "Vacinas e cuidados dos animais.",
    icon: PawPrint,
  },
  exames: {
    to: "/exames",
    titulo: "Exames",
    descricao: "Histórico privado de saúde.",
    icon: FileHeart,
  },
  onde_esta: {
    to: "/onde-esta",
    titulo: "Onde está?",
    descricao: "Guarde e encontre seus itens.",
    icon: MapPin,
  },
  notas: {
    to: "/notas",
    titulo: "Notas fiscais",
    descricao: "Notas, comprovantes e garantias.",
    icon: ReceiptText,
  },
  links: {
    to: "/links",
    titulo: "Anotações com link",
    descricao: "Anotações publicadas pela administração.",
    icon: Link2,
  },
  calculadora: {
    to: "/ferramentas",
    titulo: "Calculadoras",
    descricao: "Datas, horários, doses e link temporário.",
    icon: Calculator,
  },
} as const satisfies Record<
  ModuloGlobal,
  { to: string; titulo: string; descricao: string; icon: LucideIcon }
>;

export type AreaId = "dinheiro" | "casa" | "documentos" | "ferramentas";

/**
 * Navegação em 4 áreas (2026-10-09): a tela Início mostra só as áreas e o
 * menu agrupa os módulos dentro delas. Dinheiro e Ferramentas abrem direto o
 * módulo (só têm um); Casa e vida e Documentos abrem uma tela com os módulos.
 */
export const AREAS: Record<
  AreaId,
  {
    titulo: string;
    descricao: string;
    icon: LucideIcon;
    to: "/dashboard" | "/casa" | "/documentos" | "/ferramentas";
    modulos: ModuloGlobal[];
  }
> = {
  dinheiro: {
    titulo: "Dinheiro",
    descricao: "Receitas, despesas, cartões e investimentos.",
    icon: Wallet,
    to: "/dashboard",
    modulos: ["financas"],
  },
  casa: {
    titulo: "Casa e vida",
    descricao: "Compras, veículo, pet, exames e onde estão suas coisas.",
    icon: HeartHandshake,
    to: "/casa",
    modulos: ["lista", "veiculo", "pet", "exames", "onde_esta"],
  },
  documentos: {
    titulo: "Documentos",
    descricao: "Notas fiscais e anotações.",
    icon: FolderOpen,
    to: "/documentos",
    modulos: ["notas", "links"],
  },
  ferramentas: {
    titulo: "Ferramentas",
    descricao: "Calculadoras de datas, horários e dose.",
    icon: Calculator,
    to: "/ferramentas",
    modulos: ["calculadora"],
  },
};

export const ORDEM_AREAS: AreaId[] = ["dinheiro", "casa", "documentos", "ferramentas"];

/** Estilo discreto para o que só a administração enxerga (ainda não liberado). */
export const ADMIN_ONLY_CARD = "border-violet-300/70 bg-violet-500/[0.06] dark:border-violet-400/30";
export const ADMIN_ONLY_TAG =
  "inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300";
