"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function FirebaseConfigGuard({ children }) {
  const { hasValidKeys } = useAuth();
  const [configText, setConfigText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSaveConfig = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (!configText.trim()) {
        throw new Error("Please paste your Firebase configuration code snippet.");
      }

      // Smart Parser to extract keys from a copied config block
      const keys = [
        "apiKey",
        "authDomain",
        "projectId",
        "storageBucket",
        "messagingSenderId",
        "appId"
      ];
      
      const config = {};
      let keysFound = 0;

      keys.forEach((key) => {
        // Regex to search for key: "value", key: 'value', or key: `value`
        // Also supports JSON double quotes "key": "value"
        const regex = new RegExp(`"?${key}"?\\s*:\\s*["'\`]([^"'\`]+)["'\`]`);
        const match = configText.match(regex);
        if (match && match[1]) {
          config[key] = match[1];
          keysFound++;
        }
      });

      // Verification
      if (keysFound < 3 || !config.apiKey || !config.projectId) {
        throw new Error(
          "Could not parse a valid Firebase config. Please copy the entire 'firebaseConfig' object from the Firebase console."
        );
      }

      // Save to localStorage
      localStorage.setItem("WORKSYNC_FIREBASE_CONFIG", JSON.stringify(config));
      
      setSuccess("Configuration saved successfully! Syncing database...");
      
      // Reload page to apply config
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleClearConfig = () => {
    if (confirm("Are you sure you want to clear stored database configuration keys?")) {
      localStorage.removeItem("WORKSYNC_FIREBASE_CONFIG");
      window.location.reload();
    }
  };


  if (true) {
    return (
      <>
        {children}
        {/* Floating helper at the bottom of the screens to let the user clear database keys if needed */}
        <button 
          onClick={handleClearConfig}
          style={{
            position: "fixed",
            bottom: "1rem",
            right: "1rem",
            background: "rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            color: "rgba(255, 255, 255, 0.3)",
            padding: "0.4rem 0.8rem",
            borderRadius: "6px",
            fontSize: "0.75rem",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#f87171";
            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.3)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
          }}
        >
          Reset Database Connection
        </button>
      </>
    );
  }

  return (
    <div className="auth-wrapper" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="glass-panel" style={{ width: "100%", maxWidth: "600px", padding: "2.5rem 2rem", margin: "1rem animate-fade-in" }}>
        
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 className="logo-title" style={{ fontSize: "2.25rem" }}> kibozera WorkSync</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>Database Initialization Wizard</p>
        </div>

        <div style={{
          background: "rgba(99, 102, 241, 0.1)",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          borderRadius: "8px",
          padding: "1rem",
          fontSize: "0.9rem",
          color: "#a5b4fc",
          lineHeight: "1.5",
          marginBottom: "1.5rem"
        }}>
          <strong>Connect Firebase to Get Started:</strong> 
          <ol style={{ paddingLeft: "1.25rem", marginTop: "0.5rem" }}>
            <li>Go to your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "#fff", fontWeight: "600" }}>Firebase Console</a>.</li>
            <li>Select your project, click <strong>Project Settings</strong> (gear icon), and scroll down to <strong>Your Apps</strong>.</li>
            <li>Copy the <code>{"const firebaseConfig = { ... };"}</code> block and paste it below.</li>
          </ol>
        </div>

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#f87171",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            fontSize: "0.9rem",
            marginBottom: "1.25rem"
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            color: "#34d399",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            fontSize: "0.9rem",
            marginBottom: "1.25rem"
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSaveConfig}>
          <div className="form-group">
            <label className="glass-label">Paste Firebase Web App config</label>
            <textarea
              className="glass-input"
              rows={8}
              placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "...",\n  projectId: "...",\n  storageBucket: "...",\n  messagingSenderId: "...",\n  appId: "..."\n};`}
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              required
              style={{
                fontFamily: "monospace",
                fontSize: "0.8rem",
                lineHeight: "1.4",
                resize: "none"
              }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "1rem" }}>
            Link Database & Launch
          </button>
        </form>

        <div style={{ 
          marginTop: "1.5rem", 
          borderTop: "1px solid var(--glass-border)", 
          paddingTop: "1.25rem", 
          fontSize: "0.8rem", 
          color: "var(--text-muted)", 
          textAlign: "center" 
        }}>
          💡 <strong>Alternative Developer Setup:</strong> You can also fill in variables directly inside the <code>.env.local</code> file in the root workspace folder.
        </div>
      </div>
    </div>
  );
}
