"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { useToasts } from "@/lib/toast";
import { Icon } from "./Icon";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useApp.persist.rehydrate();
  }, []);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={() => dismiss(t.id)}
            className="card pointer-events-auto flex w-full max-w-sm items-center gap-3 px-4 py-3 text-left"
          >
            <span
              className={
                "grid size-10 shrink-0 place-items-center rounded-xl " +
                (t.kind === "level"
                  ? "bg-accent text-white"
                  : t.kind === "goal"
                    ? "bg-good-soft text-good"
                    : "bg-warn-soft text-warn")
              }
            >
              <Icon name={t.icon} className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="eyebrow block">
                {t.kind === "achievement" ? "Achievement freigeschaltet" : t.kind === "level" ? "Level-Up" : "Geschafft"}
              </span>
              <span className="block font-semibold">{t.title}</span>
              {t.body && <span className="block text-sm text-muted">{t.body}</span>}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
