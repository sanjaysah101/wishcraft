import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { connect } from "@/lib/anna";

const root = document.getElementById("root")!;

function applyTheme(theme?: string) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
}

function applyLocale(locale?: string) {
  if (locale) document.documentElement.lang = locale;
}

async function boot() {
  try {
    const rt = await connect();
    applyTheme(rt.theme);
    applyLocale(rt.locale);
    rt.onThemeChange?.(({ theme }) => applyTheme(theme));
    rt.window.set_title({ title: "WishCraft" }).catch(() => {});
    root.textContent = "";
    createRoot(root).render(
      <StrictMode>
        <Toaster>
          <TooltipProvider delay={300}>
            <App />
          </TooltipProvider>
        </Toaster>
      </StrictMode>,
    );
  } catch (e) {
    console.error("[wishcraft] connect failed", e);
    root.innerHTML =
      '<div class="boot-message"><h1>WishCraft</h1><p>WishCraft runs inside Anna. Open it from the Anna app store, or type #WishCraft in an Anna chat.</p></div>';
  }
}

void boot();
