"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  title?: string;
  message?: string;
};

/** Overlay bloqueante durante importação de lista (F-002). */
export function LoadingModal({
  open,
  title = "Processando lista",
  message = "Buscando e adicionando cartas. Aguarde…",
}: Props) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="loading-modal-title"
      aria-describedby="loading-modal-desc"
    >
      <div className="w-full max-w-sm border border-black bg-white p-6 shadow-xl">
        <div className="mb-4 flex justify-center" aria-hidden>
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-black" />
        </div>
        <h2 id="loading-modal-title" className="text-center text-base font-semibold">
          {title}
        </h2>
        <p id="loading-modal-desc" className="mt-2 text-center text-sm text-neutral-600">
          {message}
        </p>
      </div>
    </div>
  );
}
