"use client";

import { Eye, EyeOff, Loader2, LogIn, Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { sendPasswordReset, signIn, signUp } from "@/lib/auth";
import { NAME_MAX } from "@/lib/ranking";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { Button } from "./ui";

type Mode = "login" | "register" | "reset";

const field =
  "h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[15px] outline-none transition focus:border-accent";

/** Anmelden, Registrieren oder Passwort zurücksetzen – vor der App, solange niemand angemeldet ist. */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "register") await signUp(name, email, password);
      else if (mode === "login") await signIn(email, password);
      else {
        await sendPasswordReset(email);
        setInfo("Wenn es ein Konto mit dieser Adresse gibt, ist eine E-Mail zum Zurücksetzen unterwegs. Schau auch im Spam-Ordner nach.");
      }
    } catch (e) {
      setError(e instanceof TypeError ? "Keine Verbindung – bist du online?" : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const title = { login: "Willkommen zurück", register: "Konto erstellen", reset: "Passwort vergessen" }[mode];

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2">
          <Logo className="size-9 drop-shadow-[0_2px_6px_rgb(76_91_255/0.35)]" />
          <span className="display text-2xl">Lernwerk</span>
        </div>
        <h1 className="display mt-8 text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          {mode === "register"
            ? "Mit deinem Konto ist dein Lernstand auf allen Geräten gleich, und du erscheinst in der Rangliste."
            : mode === "login"
              ? "Melde dich an, um weiterzulernen."
              : "Gib deine E-Mail-Adresse ein, dann schicken wir dir einen Link für ein neues Passwort."}
        </p>

        {mode !== "reset" && (
          <div className="mt-6 grid grid-cols-2 rounded-full border border-line bg-surface p-1" role="tablist">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchTo(m)}
                className={cn(
                  "h-10 rounded-full text-sm font-semibold transition",
                  mode === m ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
                )}
              >
                {m === "login" ? "Anmelden" : "Registrieren"}
              </button>
            ))}
          </div>
        )}

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {mode === "register" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink-2">Name (sichtbar in der Rangliste)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={NAME_MAX}
                autoComplete="nickname"
                placeholder="z. B. Dominik"
                required
                className={field}
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-2">E-Mail-Adresse</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
              className={field}
            />
          </label>
          {mode !== "reset" && (
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink-2">
                Passwort
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  minLength={6}
                  required
                  aria-describedby={mode === "register" ? "password-hint" : undefined}
                  className={cn(field, "pr-12")}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
                  className="absolute inset-y-0 right-1 grid w-10 place-items-center text-muted hover:text-ink"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {mode === "register" && (
                <p id="password-hint" className="mt-1 text-xs text-muted">
                  Mindestens 6 Zeichen.
                </p>
              )}
            </div>
          )}

          {error && <p className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>}
          {info && <p className="rounded-2xl bg-good-soft px-4 py-3 text-sm text-good">{info}</p>}

          <Button type="submit" className="h-12 w-full" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === "register" ? (
              <UserPlus className="size-4" />
            ) : mode === "login" ? (
              <LogIn className="size-4" />
            ) : (
              <Mail className="size-4" />
            )}
            {mode === "register" ? "Konto erstellen" : mode === "login" ? "Anmelden" : "Link senden"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm">
          {mode === "login" ? (
            <button type="button" onClick={() => switchTo("reset")} className="font-medium text-accent hover:underline">
              Passwort vergessen?
            </button>
          ) : mode === "reset" ? (
            <button type="button" onClick={() => switchTo("login")} className="font-medium text-accent hover:underline">
              Zurück zur Anmeldung
            </button>
          ) : null}
        </p>
      </div>
    </main>
  );
}
