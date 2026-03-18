import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./app.css";
import "./stores/theme-store"; // initialize theme on load
import "./stores/ui-language-store"; // initialize UI language on load

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
