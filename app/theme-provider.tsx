"use client";

import { useEffect, useState } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set dark mode by default for academic aesthetic
    const isDark = localStorage.getItem("theme") !== "light";
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  if (!mounted) return null;

  return <>{children}</>;
}
