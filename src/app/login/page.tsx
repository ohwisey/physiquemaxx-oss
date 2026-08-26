"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign-in — the only public surface. Two accounts exist and signups are
 * disabled, so this is a door, not a funnel: wordmark, two hairline fields,
 * one pill. No marketing, no signup, no reset flow.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("WRONG EMAIL OR PASSWORD");
      setBusy(false);
      return;
    }
    router.replace("/");
  };

  const field =
    "mt-1.5 w-full bg-transparent pb-2.5 text-[16px] outline-none border-b";
  const border = { borderColor: "rgba(243,241,237,0.14)", color: "#F3F1ED" };

  return (
    <main
      className="fixed inset-0 flex flex-col justify-between overflow-hidden"
      style={{ height: "100dvh", background: "#030303" }}
    >
      <div
        className="px-6"
        style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}
      >
        <h1
          className="masthead mt-10"
          style={{
            color: "#F3F1ED",
            fontSize: "clamp(64px, 19vw, 128px)",
          }}
        >
          PHYSIQUE
          <br />
          MAXX
        </h1>
      </div>

      <form
        onSubmit={submit}
        className="mx-auto w-full px-6"
        style={{
          maxWidth: 430,
          paddingBottom: "max(env(safe-area-inset-bottom), 32px)",
        }}
      >
        <div>
          <label className="micro-11" htmlFor="email" style={{ color: "#8E8E8A" }}>
            EMAIL
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
            style={border}
          />
        </div>

        <div className="mt-6">
          <label className="micro-11" htmlFor="password" style={{ color: "#8E8E8A" }}>
            PASSWORD
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
            style={border}
          />
        </div>

        <p
          className="micro mt-4"
          style={{
            color: "#F04438",
            minHeight: 14,
            opacity: error ? 1 : 0,
          }}
          aria-live="polite"
        >
          {error ?? " "}
        </p>

        <button
          type="submit"
          disabled={!canSubmit}
          className="micro-11 mt-4 w-full rounded-full py-4 text-center transition-opacity"
          style={{
            background: canSubmit ? "#F3F1ED" : "rgba(243,241,237,0.14)",
            color: canSubmit ? "#030303" : "rgba(243,241,237,0.4)",
          }}
        >
          {busy ? "ENTERING…" : "ENTER"}
        </button>
      </form>
    </main>
  );
}
