"use client";

import { useEffect, useState } from "react";
import { formatBRLFromCents, maskBRLTyping, parseBRLToCents } from "@/lib/money-br";

type Props = {
  valueCents: number | null;
  onChangeCents: (cents: number | null) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
};

/** Input de preço em R$ (F-004 / F-005). */
export function MoneyInputBr({ valueCents, onChangeCents, disabled, id, "aria-label": ariaLabel }: Props) {
  const [text, setText] = useState(() => formatBRLFromCents(valueCents));

  useEffect(() => {
    setText(formatBRLFromCents(valueCents));
  }, [valueCents]);

  return (
    <input
      id={id}
      aria-label={ariaLabel ?? "Preço em reais"}
      inputMode="decimal"
      disabled={disabled}
      value={text}
      placeholder="R$ 0,00"
      className="h-10 w-full border border-black px-3 text-sm tabular-nums disabled:opacity-60"
      onChange={(event) => {
        const next = maskBRLTyping(event.target.value);
        setText(next);
      }}
      onBlur={() => {
        const cents = parseBRLToCents(text);
        onChangeCents(cents);
        setText(formatBRLFromCents(cents));
      }}
    />
  );
}
