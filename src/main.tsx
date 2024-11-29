import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "reactive-psych/style.css";
import "./index.css";
import { ExperimentProvider } from "reactive-psych";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ExperimentProvider>
      <App />
    </ExperimentProvider>
  </React.StrictMode>
);
