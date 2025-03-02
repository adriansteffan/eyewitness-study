import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "@adriansteffan/reactive/style.css";
import "./index.css";
import { ExperimentProvider } from "@adriansteffan/reactive";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ExperimentProvider>
      <App />
    </ExperimentProvider>
  </React.StrictMode>
);
