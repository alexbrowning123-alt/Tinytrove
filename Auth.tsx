import { useState } from "react";
import { useLocation } from "wouter";
import { useSignup, useLogin } from "@/lib/hooks";
import { Logo } from "@/components/common";
import { useToast } from "@/hooks/use-toast";

type Mode = "login" | "signup";

export default function Auth({ mode }: { mode: Mode }) {
  const [, navigate] = useLocation();
  const signup = useSignup();
  const login = useLogin();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const pending = signup.isPending || login.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/.+@.+\..+/.test(cleanEmail)) {
      toast({ title: "Please enter a valid email" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters" });
      return;
    }
    if (mode === "signup") {
      if (!name.trim()) {
        toast({ title: "Please enter your name" });
        return;
      }
      signup.mutate(
        { email: cleanEmail, password, displayName: name.trim(), location: location.trim() || "United Kingdom" },
        {
          onSuccess: () => {
            navigate("/sell");
          },
          onError: (err: Error) => toast({ title: "Couldn't sign up", description: err.message }),
        },
      );
    } else {
      login.mutate(
        { email: cleanEmail, password },
        {
          onSuccess: () => {
            navigate("/");
          },
          onError: (err: Error) => toast({ title: "Couldn't log in", description: err.message }),
        },
      );
    }
  };

  const field = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-md flex-col justify-center px-4 py-8 md:min-h-[calc(100vh-4rem)]">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo />
        <h1 className="mt-5 font-serif text-2xl font-700">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signup"
            ? "Join families buying and selling preloved baby & kids' bits."
            : "Log in to message sellers and manage your listings."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <div>
            <label className="text-xs font-600 text-muted-foreground">Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" className={`mt-1 ${field}`} />
          </div>
        )}
        <div>
          <label className="text-xs font-600 text-muted-foreground">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={`mt-1 ${field}`} autoComplete="email" />
        </div>
        <div>
          <label className="text-xs font-600 text-muted-foreground">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className={`mt-1 ${field}`} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </div>
        {mode === "signup" && (
          <div>
            <label className="text-xs font-600 text-muted-foreground">Location (optional)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Norwich, Norfolk" className={`mt-1 ${field}`} />
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-600 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {mode === "signup" ? "Already have an account?" : "New to TinyTrove?"}{" "}
        <a href={mode === "signup" ? "#/login" : "#/signup"} className="font-600 text-primary hover:underline">
          {mode === "signup" ? "Log in" : "Sign up"}
        </a>
      </p>

      {mode === "login" && (
        <div className="mt-6 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
          <p className="font-600 text-foreground">Try the demo account</p>
          <p className="mt-1">Email <span className="font-500">demo@tinytrove.app</span></p>
          <p>Password <span className="font-500">tinytrove123</span></p>
        </div>
      )}
    </div>
  );
}
