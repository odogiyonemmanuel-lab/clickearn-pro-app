import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App.tsx";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#0f172a",
                color: "#f1f5f9",
                border: "1px solid #1e293b",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                padding: "0.75rem 1rem",
              },
              success: {
                iconTheme: {
                  primary: "#22c55e",
                  secondary: "#0f172a",
                },
              },
              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#0f172a",
                },
                duration: 5000,
              },
              loading: {
                iconTheme: {
                  primary: "#3b82f6",
                  secondary: "#0f172a",
                },
              },
            }}
          />
        </BrowserRouter>
      </ConvexAuthProvider>
    </ConvexProvider>
  </StrictMode>
);
