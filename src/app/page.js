"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === "ceo") {
          router.replace("/ceo");
        } else if (user.role === "employee") {
          router.replace("/employee");
        } else {
          // Fallback if role is not assigned (e.g. error condition)
          router.replace("/login");
        }
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="auth-wrapper" style={{ flexDirection: "column", gap: "1.5rem" }}>
      <div className="glass-panel" style={{ textAlign: "center", padding: "3rem 2rem", maxWidth: "400px" }}>
        <h1 className="logo-title" style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>Kibozera WorkSync</h1>
        <div style={{ display: "flex", justifyContent: "center", margin: "2rem 0" }}>
          <div className="spinner"></div>
        </div>
        <p>Loading application session...</p>
      </div>

      <style jsx global>{`
        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(255, 255, 255, 0.08);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
