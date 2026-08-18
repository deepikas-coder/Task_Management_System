"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { checkIfCEOExists } from "../../lib/db";

export default function Login() {
  const { user, login, registerCEO, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isCEOSetup, setIsCEOSetup] = useState(false);
  const [checkingDb, setCheckingDb] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check if we need to show the CEO setup form (first time launch)
  useEffect(() => {
    const verifyCEO = async () => {
      try {
        const exists = await checkIfCEOExists();
        setIsCEOSetup(!exists);
      } catch (err) {
        console.error("Db check failed", err);
      } finally {
        setCheckingDb(false);
      }
    };
    verifyCEO();
  }, []);

  // Redirect if logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "ceo") {
        router.replace("/ceo");
      } else if (user.role === "employee") {
        router.replace("/employee");
      }
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      if (isCEOSetup) {
        // Validation
        if (!name.trim()) throw new Error("Full Name is required.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");

        await registerCEO(email, password, name);
        setSuccess("CEO Account successfully created! Redirecting...");
        setTimeout(() => {
          router.replace("/ceo");
        }, 1500);
      } else {
        // Log in
        const loggedUser = await login(email, password);
        // AuthContext listener will handle redirection
      }
    } catch (err) {
      console.error(err);
      let errMsg = err.message;
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errMsg = "Invalid email or password. Please try again.";
      } else if (err.code === "auth/email-already-in-use") {
        errMsg = "This email is already in use.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Please enter a valid email address.";
      }
      setError(errMsg);
      setSubmitting(false);
    }
  };

  if (checkingDb || authLoading) {
    return (
      <div className="auth-wrapper">
        <div className="glass-panel" style={{ textAlign: "center", padding: "3rem 2rem", maxWidth: "400px" }}>
          <h1 className="logo-title">Kibozera WorkSync</h1>
          <div style={{ display: "flex", justifyContent: "center", margin: "2rem 0" }}>
            <div className="spinner"></div>
          </div>
          <p>Initialising secure gateway...</p>
        </div>
        <style jsx global>{`
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.08);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card glass-panel">
        <div className="logo-header">
          <h1 className="logo-title">Kibozera WorkSync</h1>
          <p className="logo-subtitle">
            {isCEOSetup
              ? "Initial Setup: Register CEO Account"
              : "Welcome Back , Team!"}
          </p>
        </div>

        {isCEOSetup && (
          <div style={{
            background: "rgba(99, 102, 241, 0.12)",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            fontSize: "0.85rem",
            color: "#a5b4fc",
            marginBottom: "1.5rem",
            lineHeight: "1.4"
          }}>
            <strong>Welcome to  kibozera WorkSync!</strong> No CEO account was detected. Please create the master administrator account. Subsequent employee accounts will be created from the CEO dashboard.
          </div>
        )}

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            color: "#f87171",
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
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            color: "#34d399",
            fontSize: "0.9rem",
            marginBottom: "1.25rem"
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off">
          {isCEOSetup && (
            <div className="form-group">
              <label className="glass-label">CEO Full Name</label>
              <input 
                type="text" 
                className="glass-input" 
                placeholder="e.g. Alexander Vance"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="glass-label">Email Address</label>
            <input 
              type="email" 
              className="glass-input" 
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label className="glass-label">Password</label>
            <input 
              type="password" 
              className="glass-input" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {isCEOSetup && (
            <div className="form-group">
              <label className="glass-label">Confirm Password</label>
              <input 
                type="password" 
                className="glass-input" 
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: "100%", marginTop: "1rem" }}
            disabled={submitting}
          >
            {submitting ? "Processing secure handshake..." : isCEOSetup ? "Establish CEO Master Key" : "Authenticate Session"}
          </button>
        </form>

        {!isCEOSetup && (
          <div style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            
          </div>
        )}
      </div>
    </div>
  );
}
