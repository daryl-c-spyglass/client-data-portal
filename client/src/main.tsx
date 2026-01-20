import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Early debug logging - runs before React mounts
console.log('[Early Debug] main.tsx executing');
console.log('[Early Debug] window.self === window.top:', window.self === window.top);
console.log('[Early Debug] In iframe:', window.self !== window.top);
console.log('[Early Debug] Current URL:', window.location.href);

createRoot(document.getElementById("root")!).render(<App />);
