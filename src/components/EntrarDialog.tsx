import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BrandMark } from "@/components/BrandMark";
import { EntrarForm } from "@/components/EntrarForm";

/**
 * Item 6 do backlog de 2026-09-26: clicar em "Entrar" na home mostra o
 * login num popup sobre a própria página (menu superior continua visível,
 * sem navegação pra outra tela nem botão de "voltar"). Só o LOGIN vira
 * popup — o cadastro (que envolve código de convite, dados pessoais e
 * aceite de termos) continua em página própria (`/entrar`) pra não perder
 * o que a pessoa já preencheu se o popup fechar sem querer.
 */
export function EntrarDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm border-none bg-transparent p-0 shadow-none">
        <DialogHeader className="mb-2 flex flex-col items-center text-center">
          <BrandMark className="mb-3 size-12 rounded-2xl shadow-soft" />
          <DialogTitle className="text-xl">Entrar no Control ALL</DialogTitle>
          <DialogDescription>Acesse o painel com seu e-mail (ou CPF) e senha.</DialogDescription>
        </DialogHeader>
        <EntrarForm onSucesso={() => setOpen(false)} esqueciSenhaComoLink={false} />
        <div className="mt-3 space-y-2 text-center">
          <Link
            to="/esqueci-senha"
            className="block text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setOpen(false)}
          >
            Esqueci minha senha
          </Link>
          <Link
            to="/entrar"
            search={{ criar: true }}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            Não tem conta? Criar conta <ArrowRight className="size-3" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
