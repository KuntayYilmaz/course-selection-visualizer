import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./planner.css";
import "./readability.css";
import "./theme.css";
import { initializeTheme } from "./components/ThemeToggle";
initializeTheme();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
