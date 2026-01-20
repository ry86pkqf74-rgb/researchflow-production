import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSentry } from "./lib/sentry";

// Initialize Sentry for error tracking (PHI-safe)
// Configure VITE_SENTRY_DSN environment variable to enable
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
