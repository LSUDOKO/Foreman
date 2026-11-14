import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// "/" is the landing page; "/app" is the dashboard (its sub-pages stay on the hash).
const App = lazy(() => import("./App"));
const Landing = lazy(() => import("./Landing"));
const isApp = location.pathname.startsWith("/app");

createRoot(document.getElementById("root")!).render(
  <StrictMode><Suspense fallback={null}>{isApp ? <App /> : <Landing />}</Suspense></StrictMode>,
);
