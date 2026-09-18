"use client";

import dynamic from "next/dynamic";
import "tldraw/tldraw.css";

const Tldraw = dynamic(async () => (await import("tldraw")).Tldraw, {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-zinc-400">
      Carregando canvas…
    </div>
  ),
});

export function BoardCanvas() {
  return (
    <div className="h-full w-full">
      <Tldraw
        onMount={(editor) => {
          editor.user.updateUserPreferences({ colorScheme: "dark" });
        }}
      />
    </div>
  );
}
