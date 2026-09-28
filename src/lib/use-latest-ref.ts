import { useLayoutEffect, useRef } from "react";

/** Ref com o valor do último render, para handlers registrados fora do ciclo do React. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
