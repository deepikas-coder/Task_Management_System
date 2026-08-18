"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { 
  getTodayAttendance, 
  checkInEmployee, 
  checkOutEmployee, 
  getEmployeeAttendanceLogs, 
  getTasksForEmployee, 
  updateTaskStatus, 
  uploadTaskReport 
} from "../../lib/db";

export default function EmployeeDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if not authorized
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role !== "employee") {
        router.replace("/ceo");
      }
    }
  }, [user, authLoading, router]);

  // Dashboard State
  const [todayLog, setTodayLog] = useState(null);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");

  // Clock State
  const [currentTime, setCurrentTime] = useState("");

  const [currentDate, setCurrentDate] = useState("");

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [reportNotes, setReportNotes] = useState("");
  const [reportFile, setReportFile] = useState(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportMsg, setReportMsg] = useState({ text: "", isError: false });

  // References
  const fileInputRef = useRef(null);

  // Digital clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setCurrentDate(
  now.toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  })
);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial employee stats
  const fetchEmployeeData = async () => {
    if (!user) return;
    try {
      setLoadingData(true);
      const [todayAtt, history, taskList] = await Promise.all([
        getTodayAttendance(user.uid),
        getEmployeeAttendanceLogs(user.uid),
        getTasksForEmployee(user.uid)
      ]);
      setTodayLog(todayAtt);
      setAttendanceLogs(history);
      setTasks(taskList);
    } catch (error) {
      console.error("Error loading employee dashboard data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && user.role === "employee") {
      fetchEmployeeData();
    }
  }, [user]);

  // Check In handler
  const handleCheckIn = async () => {
    if (checkingIn) return;
    setCheckingIn(true);
    setAttendanceError("");
    try {
      // Step 1: Core Firebase check-in (critical)
      const record = await checkInEmployee(user.uid, user.name);
      setTodayLog(record);
      
      // Step 2: Refresh supporting data (non-critical, errors handled silently)
      try {
        const [history, taskList] = await Promise.all([
          getEmployeeAttendanceLogs(user.uid),
          getTasksForEmployee(user.uid)
        ]);
        setAttendanceLogs(history);
        setTasks(taskList);
      } catch (refreshErr) {
        console.warn("Data refresh after check-in failed (non-critical):", refreshErr);
      }
    } catch (err) {
      console.error("Check-in failed:", err);
      setAttendanceError("Check-in failed: " + err.message);
    } finally {
      setCheckingIn(false);
    }
  };

  // Check Out handler
  const handleCheckOut = async () => {
    if (checkingOut) return;
    setAttendanceError("");

    // 🔒 Block checkout if any task is still in-progress
    const inProgressTasks = tasks.filter(t => t.status === "in-progress");
    if (inProgressTasks.length > 0) {
      setAttendanceError(
        `⚠ You have ${inProgressTasks.length} task(s) still "In Progress". Please submit a report or move them back to Pending before checking out.`
      );
      return;
    }

    setCheckingOut(true);
    try {
      // Step 1: Core Firebase check-out (critical)
      await checkOutEmployee(user.uid);
      
      // Step 2: Re-fetch fresh data from Firestore (active session will now be null)
      const freshLog = await getTodayAttendance(user.uid);
      setTodayLog(freshLog); // Will be null after checkout = tasks will lock
      
      // Step 3: Refresh history (non-critical)
      try {
        const history = await getEmployeeAttendanceLogs(user.uid);
        setAttendanceLogs(history);
      } catch (refreshErr) {
        console.warn("History refresh after check-out failed (non-critical):", refreshErr);
      }
    } catch (err) {
      console.error("Check-out failed:", err);
      setAttendanceError("Check-out failed: " + err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  // Status text resolver
  const getShiftStatusText = () => {
    if (!todayLog) return "Off Duty";
    if (todayLog.checkIn && !todayLog.checkOut) return "Active Working";
    if (todayLog.checkIn && todayLog.checkOut) return "Shift Completed";
    return "Off Duty";
  };

  // Task Status toggle (Pending <=> In Progress)
  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    let nextStatus = "in-progress";
    if (currentStatus === "in-progress") {
      nextStatus = "pending";
    }
    try {
      await updateTaskStatus(taskId, nextStatus);
      // Update local state
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  // Trigger Report Modal
  const openReportSubmission = (task) => {
    setActiveTask(task);
    setReportNotes("");
    setReportFile(null);
    setReportMsg({ text: "", isError: false });
    setShowReportModal(true);
  };

  // Handle Report Submission
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setReportMsg({ text: "", isError: false });
    setSubmittingReport(true);

    try {
      await uploadTaskReport(activeTask.id, reportNotes, reportFile);
      
      setReportMsg({ text: "Deliverable report submitted successfully! Task marked as completed.", isError: false });
      
      // Reset variables
      setReportNotes("");
      setReportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Refresh tasks
      const taskList = await getTasksForEmployee(user.uid);
      setTasks(taskList);

      setTimeout(() => {
        setShowReportModal(false);
        setActiveTask(null);
      }, 1500);
    } catch (err) {
      console.error(err);
      setReportMsg({ text: "Error submitting report: " + err.message, isError: true });
    } finally {
      setSubmittingReport(false);
    }
  };

  if (!mounted || authLoading || !user || user.role !== "employee") {
    return (
      <div className="auth-wrapper">
        <div className="glass-panel" style={{ textAlign: "center", padding: "2rem" }}>
          <div className="spinner"></div>
          <p style={{ marginTop: "1rem" }}>Verifying Credentials...</p>
        </div>
        <style jsx global>{`
          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid rgba(255, 255, 255, 0.08);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // Deactivated Account Guard
  if (user.status === "deactivated") {
    return (
      <div className="auth-wrapper">
        <div className="glass-panel" style={{ 
          textAlign: "center", 
          padding: "3rem 2rem", 
          maxWidth: "420px",
          margin: "0 auto"
        }}>
          <div style={{
            width: "80px",
            height: "80px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "2px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2rem",
            margin: "0 auto 1.5rem"
          }}>
            
          </div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "0.75rem", color: "#f87171" }}>
            Account Deactivated
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: "1.6", marginBottom: "1.5rem" }}>
            Your account has been deactivated by the administrator. 
            Please contact your CEO or HR department for assistance.
          </p>
          <button className="btn btn-secondary" onClick={() => logout()}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Dashboard states - robust boolean checks
  const isCheckedIn = !!(todayLog && todayLog.checkIn);
  const isCheckedOut = !!(todayLog && todayLog.checkOut && todayLog.checkOut !== null);
  const currentStatusText = getShiftStatusText();

  // Task Stats
  const pendingTasksCount = tasks.filter(t => t.status !== "completed").length;
  const completedTasksCount = tasks.filter(t => t.status === "completed").length;

  return (
    <div className="app-container animate-fade-in">
      {/* Header Panel */}
      <header className="dashboard-header glass-panel">
        <div>
          <h1 style={{ fontSize: "1.75rem", background: "linear-gradient(135deg, #fff 30%, #a5b4fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Kibozera Workspace
          </h1>
          <p style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Employee Portal • {user.name} ({user.employeeId})
          </p>
        </div>
        <div className="nav-profile">
          <div className="avatar">{user.name.substring(0, 2).toUpperCase()}</div>
          <button className="btn btn-secondary" onClick={() => logout()}>Sign Out</button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="two-col-layout">
        
        {/* Left Column: Attendance and Clock-in Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Shift Time Card */}
          <div className="glass-panel" style={{ textAlign: "center" }}>
            <h2>Today's Shift </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
              {currentDate}
            </p>
            
            <div className="clock-timer">
              {currentTime || "00:00:00"}
            </div>

            {/* Error display */}
            {attendanceError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "#f87171",
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
                margin: "0.5rem 0",
                textAlign: "left"
              }}>
                ⚠ {attendanceError}
              </div>
            )}

            <div style={{ margin: "1rem 0" }}>
              <span className={`badge ${
                currentStatusText === "Active Working" ? "badge-success" : 
                currentStatusText === "Shift Completed" ? "badge-info" : "badge-danger"
              }`} style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}>
                Status: {currentStatusText}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1.5rem" }}>
              <button 
                className="btn btn-success" 
                onClick={handleCheckIn}
                disabled={isCheckedIn || checkingIn}
                style={{ width: "100%", opacity: checkingIn ? 0.7 : 1 }}
              >
                {checkingIn ? "Clocking In..." : "Check In"}
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleCheckOut}
                disabled={!isCheckedIn || isCheckedOut || checkingOut}
                style={{ 
                  width: "100%", 
                  opacity: (isCheckedOut || checkingOut) ? 0.5 : 1,
                  cursor: isCheckedOut ? "not-allowed" : "pointer"
                }}
              >
                {checkingOut ? "Clocking Out..." : isCheckedOut ? "Checked Out ✓" : "Check Out"}
              </button>
            </div>

            {isCheckedIn && (
              <div style={{ 
                marginTop: "1.5rem", 
                padding: "1rem", 
                background: "rgba(255,255,255,0.02)", 
                borderRadius: "8px", 
                border: "1px solid var(--glass-border)",
                textAlign: "left",
                fontSize: "0.85rem"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span>Check-In Recorded:</span>
                  <strong>{todayLog.checkIn?.toDate ? todayLog.checkIn.toDate().toLocaleTimeString() : "Pending"}</strong>
                </div>
                {isCheckedOut && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span>Check-Out Recorded:</span>
                      <strong>{todayLog.checkOut?.toDate ? todayLog.checkOut.toDate().toLocaleTimeString() : "Pending"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "0.5rem" }}>
                      <span>Total Time Logged:</span>
                      <strong style={{ color: "#34d399" }}>{todayLog.duration} Hours</strong>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Historical Logs */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: "1rem" }}>Recent Attendances</h3>
            {loadingData ? (
              <p>Loading history...</p>
            ) : attendanceLogs.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No shift history found.</p>
            ) : (
              <div className="table-wrapper">
                <table className="custom-table" style={{ fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceLogs.map((log) => {
                      const cin = log.checkIn?.toDate ? log.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                      const cout = log.checkOut?.toDate ? log.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                      return (
                        <tr key={log.id}>
                          <td>{log.date}</td>
                          <td>{cin}</td>
                          <td>{cout}</td>
                          <td><strong>{log.duration !== null ? `${log.duration} hrs` : "Working"}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Assigned Tasks - Only visible after Check-In */}
        <div>
          {!isCheckedIn ? (
            /* LOCKED STATE: Show only when employee has NOT checked in */
            <div className="glass-panel" style={{ 
              height: "100%", 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              justifyContent: "center",
              textAlign: "center",
              padding: "4rem 2rem",
              border: "1px dashed rgba(99,102,241,0.2)"
            }}>
              {/* Lock Icon */}
              <div style={{
                width: "80px",
                height: "80px",
                background: "rgba(99,102,241,0.1)",
                border: "2px solid rgba(99,102,241,0.2)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                marginBottom: "1.5rem"
              }}>
                🔒
              </div>
              <h3 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: "#ffffff" }}>
                Tasks Locked
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: "1.6", maxWidth: "260px" }}>
                Your task board will be unlocked once you <strong style={{ color: "#a5b4fc" }}>Check In</strong> for today's shift. Please check in to begin your work session.
              </p>
              <div style={{
                marginTop: "1.5rem",
                padding: "0.5rem 1.25rem",
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.15)",
                borderRadius: "9999px",
                fontSize: "0.8rem",
                color: "#a5b4fc"
              }}>
                ← Check In to unlock tasks
              </div>
            </div>
          ) : (
          <div className="glass-panel" style={{ height: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2>Assigned Tasks</h2>
              <span className="badge badge-info">{pendingTasksCount} Tasks Pending</span>
            </div>

            {loadingData ? (
              <p>Loading task schedule...</p>
            ) : tasks.length === 0 ? (
              <p style={{ textAlign: "center", padding: "4rem 1rem", border: "1px dashed var(--glass-border)", borderRadius: "12px", color: "var(--text-muted)" }}>
                No tasks assigned.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {tasks.map((task) => (
                  <div key={task.id} className="task-item">
                    <div className="task-header">
                      <div>
                        <h4 style={{ fontSize: "1.1rem" }}>{task.title}</h4>
                        <p style={{ fontSize: "0.85rem", marginTop: "0.25rem", color: "var(--text-muted)" }}>{task.description}</p>
                      </div>
                      <span className={`badge ${
                        task.status === "completed" ? "badge-success" : 
                        task.status === "in-progress" ? "badge-info" : "badge-warning"
                      }`}>
                        {task.status}
                      </span>
                    </div>

                    <div className="task-meta">
                      <span>Priority: <strong style={{ color: task.priority === "high" ? "#f87171" : task.priority === "medium" ? "#fbbf24" : "#60a5fa" }}>{task.priority.toUpperCase()}</strong></span>
                      <span>Due: <strong>{task.dueDate}</strong></span>
                    </div>

                    {task.status !== "completed" && (
                      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "1rem" }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ flex: 1, padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                          onClick={() => handleToggleTaskStatus(task.id, task.status)}
                        >
                          {task.status === "in-progress" ? "Mark Pending" : "Set In-Progress"}
                        </button>
                        
                        <button 
                          className="btn btn-primary" 
                          style={{ flex: 1, padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                          onClick={() => openReportSubmission(task)}
                        >
                          Submit Report
                        </button>
                      </div>
                    )}

                    {task.report && (
                      <div style={{
                        marginTop: "1rem",
                        padding: "0.75rem 1rem",
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "8px",
                        fontSize: "0.85rem"
                      }}>
                        <strong style={{ color: "#34d399" }}>✅ Submitted Report:</strong>
                        <p style={{ color: "#e5e7eb", margin: "0.25rem 0" }}>{task.report.notes}</p>
                        {task.report.file && (
                          <a 
                            href={task.report.file.base64} 
                            download={task.report.file.name}
                            style={{ color: "#6366f1", textDecoration: "underline", fontWeight: "600" }}
                          >
                            📎 {task.report.file.name} ({(task.report.file.size / 1024).toFixed(0)} KB)
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )} {/* End of isCheckedIn ternary */}
        </div>
      </div>

      {/* MODAL: SUBMIT REPORT */}
      {showReportModal && activeTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowReportModal(false)}>×</button>
            <h3 className="modal-title">Submit Deliverable Report</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "-1rem", marginBottom: "1.5rem" }}>
              Task: <strong>{activeTask.title}</strong>
            </p>

            {reportMsg.text && (
              <div style={{
                background: reportMsg.isError ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                border: `1px solid ${reportMsg.isError ? "rgba(239, 68, 68, 0.25)" : "rgba(16, 185, 129, 0.25)"}`,
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                color: reportMsg.isError ? "#f87171" : "#34d399",
                fontSize: "0.9rem",
                marginBottom: "1.25rem"
              }}>
                {reportMsg.text}
              </div>
            )}

            <form onSubmit={handleReportSubmit}>
              <div className="form-group">
                <label className="glass-label">Report Notes / Comments</label>
                <textarea 
                  className="glass-input" 
                  placeholder="Explain findings, results, or notes about the completion..." 
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  required
                  rows={4}
                  style={{ resize: "none" }}
                />
              </div>

              <div className="form-group">
                <label className="glass-label">Attach File / Document (Optional)</label>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="glass-input" 
                  onChange={(e) => setReportFile(e.target.files[0] || null)}
                  style={{ color: "#fff" }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                  PDF, Images, or text reports allowed. Max size 10MB.
                </span>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowReportModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submittingReport}>
                  {submittingReport ? "Uploading..." : "Submit & Complete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
