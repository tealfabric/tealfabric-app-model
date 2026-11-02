import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

const rootEl = document.getElementById("app-model-root");
if (!rootEl) {
  throw new Error("Missing #app-model-root");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
