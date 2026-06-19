"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      role="switch"
      aria-checked={dark}
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${dark ? "bg-stone-600" : "bg-stone-300"}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${dark ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}
