import { createContext, useContext, useState, type ReactNode } from "react";

interface SearchCtx {
  q: string;
  setQ: (v: string) => void;
}

const Ctx = createContext<SearchCtx>({ q: "", setQ: () => {} });

export function SearchProvider({ children }: { children: ReactNode }) {
  const [q, setQ] = useState("");
  return <Ctx.Provider value={{ q, setQ }}>{children}</Ctx.Provider>;
}

export function useSearch() {
  return useContext(Ctx);
}
