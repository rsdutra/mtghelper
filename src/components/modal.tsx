"use client";

import { createPortal } from "react-dom";
import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/**
 * Fundo das modais (F-009 / US-009-04). Renderiza no `<body>`, fora de qualquer painel `fixed`/`z-*`
 * que prenderia a modal no contexto de empilhamento dele. Todas usam a mesma camada; a aberta por
 * último fica por cima por vir depois no `<body>`.
 */
export function Modal({ children, className = "", ...rest }: Props) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 ${className}`} {...rest}>
      {children}
    </div>,
    document.body,
  );
}
