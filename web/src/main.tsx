import { render } from "preact";
import "@fontsource/caprasimo/400.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/caveat/500.css";
import "@fontsource/caveat/700.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/600.css";
import "./styles.css";
import { App } from "./App";
import { connect } from "./lib/anna";

const root = document.getElementById("root")!;

function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}

async function boot() {
  try {
    const rt = await connect();
    if (rt.onThemeChange) rt.onThemeChange(({ theme }) => applyTheme(theme));
    else if (rt.theme) applyTheme(rt.theme);
    try {
      await rt.window.set_title({ title: "WishCraft" });
    } catch {
      /* optional */
    }
    root.textContent = "";
    render(<App />, root);
  } catch (e) {
    console.error("[wishcraft] connect failed", e);
    root.innerHTML =
      '<div class="boot-error"><h1>WishCraft</h1><p>WishCraft runs inside Anna. Open it from the Anna app store or by typing #WishCraft in an Anna chat.</p></div>';
  }
}

boot();
