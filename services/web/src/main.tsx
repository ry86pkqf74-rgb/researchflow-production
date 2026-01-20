import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { registerServiceWorker } from "./pwa/register";

// Register PWA service worker
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
