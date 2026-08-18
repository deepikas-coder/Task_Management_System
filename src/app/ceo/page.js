"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { 
  getEmployees, 
  registerEmployee, 
  deactivateEmployee,
  reactivateEmployee,
  createTask, 
  getAllTasks, 
  getTodayAttendanceLogs 
} from "../../lib/db";

export default function CEODashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect if not authorized
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role !== "ceo") {
        router.replace("/employee");
      }
    }
  }, [user, authLoading, router]);

  // UI State
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Forms State
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empId, setEmpId] = useState("");
  
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueDate, setTaskDueDate] = useState("");

  // Modals / Overlays
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");

  // Feedback Notifications
  const [empMsg, setEmpMsg] = useState({ text: "", isError: false });
  const [taskMsg, setTaskMsg] = useState({ text: "", isError: false });
  const [submittingEmp, setSubmittingEmp] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);

  // Fetch dashboard data
  const fetchData = async () => {
    try {
      setLoadingData(true);
      const [empList, taskList, attendanceLogs] = await Promise.all([
        getEmployees(),
        getAllTasks(),
        getTodayAttendanceLogs()
      ]);
      setEmployees(empList);
      setTasks(taskList);
      setAttendance(attendanceLogs);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && user.role === "ceo") {
      fetchData();
    }
  }, [user]);

  // Handle Employee Registration
  const handleRegisterEmployee = async (e) => {
    e.preventDefault();
    setEmpMsg({ text: "", isError: false });
    setSubmittingEmp(true);

    try {
      if (!empName.trim() || !empEmail.trim() || !empPassword.trim() || !empId.trim()) {
        throw new Error("All fields are required.");
      }
      if (empPassword.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      await registerEmployee(empEmail, empPassword, empName, empId);
      
      setEmpMsg({ text: "Employee successfully registered!", isError: false });
      
      // Reset form
      setEmpName("");
      setEmpEmail("");
      setEmpPassword("");
      setEmpId("");
      
      // Refresh list
      await fetchData();
      
      // Close modal after delay
      setTimeout(() => {
        setShowEmpModal(false);
        setEmpMsg({ text: "", isError: false });
      }, 1500);
    } catch (err) {
      console.error(err);
      let msg = err.message;
      if (err.code === "auth/email-already-in-use") {
        msg = "This email is already in use by another account.";
      } else if (err.code === "auth/invalid-email") {
        msg = "The email format is invalid.";
      }
      setEmpMsg({ text: msg, isError: true });
    } finally {
      setSubmittingEmp(false);
    }
  };

  // Handle Task Allocation
  const handleCreateTask = async (e) => {
    e.preventDefault();
    setTaskMsg({ text: "", isError: false });
    setSubmittingTask(true);

    try {
      if (!taskTitle.trim() || !taskDesc.trim() || !taskAssignee || !taskDueDate) {
        throw new Error("All fields are required.");
      }

      const selectedEmp = employees.find(emp => emp.uid === taskAssignee);
      if (!selectedEmp) throw new Error("Please select a valid employee.");

      await createTask(
        taskTitle,
        taskDesc,
        selectedEmp.uid,
        selectedEmp.name,
        user.uid,
        taskPriority,
        taskDueDate
      );

      setTaskMsg({ text: "Task assigned successfully!", isError: false });
      
      // Reset form
      setTaskTitle("");
      setTaskDesc("");
      setTaskAssignee("");
      setTaskPriority("medium");
      setTaskDueDate("");

      // Refresh list
      await fetchData();

      // Close modal after delay
      setTimeout(() => {
        setShowTaskModal(false);
        setTaskMsg({ text: "", isError: false });
      }, 1500);
    } catch (err) {
      console.error(err);
      setTaskMsg({ text: err.message, isError: true });
    } finally {
      setSubmittingTask(false);
    }
  };

  if (authLoading || !user || user.role !== "ceo") {
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

  // Derived Stats
  const totalEmployees = employees.length;
  const activeToday = attendance.filter(log => log.checkIn && !log.checkOut).length;
  const completedTasks = tasks.filter(task => task.status === "completed").length;
  const pendingTasks = tasks.filter(task => task.status === "pending" || task.status === "in-progress").length;

  return (
    <div className="app-container animate-fade-in">
      {/* Header Panel */}
      <header className="dashboard-header glass-panel">
        <div>
          <h1 style={{ fontSize: "1.75rem", background: "linear-gradient(135deg, #fff 30%, #a5b4fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Kibozera WorkSync
          </h1>
          <p style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>Logged in as CEO • {user.name}</p>
        </div>
        <div className="nav-profile">
          <div className="avatar">CEO</div>
          <button className="btn btn-secondary" onClick={() => logout()}>Sign Out</button>
        </div>
      </header>

      {/* Metrics Row */}
      <section className="dashboard-grid">
        <div className="glass-panel metric-card info">
          <p>Total Employees</p>
          <div className="metric-value">{totalEmployees}</div>
        </div>
        <div className="glass-panel metric-card success">
          <p>Active Employees Today</p>
          <div className="metric-value">{activeToday}</div>
        </div>
        <div className="glass-panel metric-card warning">
          <p>Active Tasks Running</p>
          <div className="metric-value">{pendingTasks}</div>
        </div>
        <div className="glass-panel metric-card success">
          <p>Tasks Completed</p>
          <div className="metric-value">{completedTasks}</div>
        </div>
      </section>

      {/* Main Grid */}
      <div className="two-col-layout">
        {/* Left Column: Tasks Board and Directory */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Tasks Tracker */}
          <div className="glass-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", width: "100%" }}>
              <h2>Task Progress </h2>
              <button className="btn btn-primary" onClick={() => setShowTaskModal(true)}>Assign New Task</button>
            </div>

            {/*  Employee Search */}
            <div style={{ marginBottom: "1.25rem", position: "relative",width:"100%" }}>
              <input
                type="text"
                placeholder="Search by employee name..."
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                className="input-field"
                style={{ width: "100%", paddingRight: "3rem",height:"52px",padding: "0 90px 0 18px", background: "#111827", border: "1px solid #303b52", borderRadius: "12px",color: "#ffffff",fontSize: "15px",outline: "none",boxSizing: "border-box" }}/>


              {taskSearchQuery && (
                <button
                  onClick={() => setTaskSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#f87171",
                    borderRadius: "6px",
                    padding: "0.2rem 0.5rem",
                    cursor: "pointer",
                    fontSize: "0.75rem"
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>
            
            {(() => {
              const filteredTasks = taskSearchQuery.trim()
                ? tasks.filter(t => 
                    t.assignedToName?.toLowerCase().includes(taskSearchQuery.toLowerCase())
                  )
                : tasks;
              
              const sortedTasks = [...filteredTasks].sort((a, b) => {
                if (a.status === "completed" && b.status !== "completed") return -1;
                if (a.status !== "completed" && b.status === "completed") return 1;
                if (a.status === "in-progress" && b.status === "pending") return -1;
                if (a.status === "pending" && b.status === "in-progress") return 1;
                return 0;
              });

              return loadingData ? (
                <p>Loading analytics data...</p>
              ) : sortedTasks.length === 0 ? (
                <p style={{ textAlign: "center", padding: "3rem 1rem", border: "1px dashed var(--glass-border)", borderRadius: "12px", color: "var(--text-muted)" }}>
                  {taskSearchQuery ? `No tasks found for "${taskSearchQuery}"` : 'No tasks assigned yet. Click "Assign New Task" to begin.'}
                </p>
              ) : (
                <>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {sortedTasks.map((task) => (
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
                      <span>Assigned To: <strong>{task.assignedToName}</strong></span>
                      <span>Priority: <strong style={{ color: task.priority === "high" ? "#f87171" : task.priority === "medium" ? "#fbbf24" : "#60a5fa" }}>{task.priority.toUpperCase()}</strong></span>
                      <span>Due: <strong>{task.dueDate}</strong></span>
                    </div>

                    {task.report && (
                      <div style={{
                        marginTop: "1rem",
                        padding: "0.75rem 1rem",
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "8px",
                        fontSize: "0.85rem"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                          <strong style={{ color: "#34d399" }}>✓ Report Submitted</strong>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                            {task.report.uploadedAt?.toDate ? task.report.uploadedAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
                          </span>
                        </div>
                        <p style={{ color: "#e5e7eb", margin: "0.25rem 0" }}>{task.report.notes}</p>
                        {task.report.file && (
                          <a 
                            href={task.report.file.base64} 
                            download={task.report.file.name}
                            style={{ color: "#6366f1", textDecoration: "underline", fontWeight: "600", display: "inline-block", marginTop: "0.25rem" }}
                          >
                            📎 Download: {task.report.file.name} ({(task.report.file.size / 1024).toFixed(0)} KB)
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Employees Directory */}
          <div className="glass-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", width: "100%" }}>
              <h2>Active Employees</h2>
              <button className="btn btn-secondary" onClick={() => setShowEmpModal(true)}>Add Employee</button>
            </div>

            {loadingData ? (
              <p>Loading directory...</p>
            ) : employees.length === 0 ? (
              <p style={{ textAlign: "center", padding: "2rem 1rem", border: "1px dashed var(--glass-border)", borderRadius: "12px" }}>
                No employees registered yet. Click "Add Employee" to seed accounts.
              </p>
            ) : (
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Today's Activity</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.uid} style={{ opacity: emp.status === "deactivated" ? 0.5 : 1 }}>
                        <td style={{ fontFamily: "monospace", color: "#a5b4fc" }}>{emp.employeeId}</td>
                        <td><strong>{emp.name}</strong></td>
                        <td>{emp.email}</td>
                        <td>
                          <span className={`badge ${
                            emp.status === "active" ? "badge-success" : 
                            emp.status === "deactivated" ? "badge-danger" : "badge-warning"
                          }`}>
                            {emp.status === "active" ? "Active (Online)" : 
                            emp.status === "deactivated" ? "Deactivated" : "Offline"}
                          </span>
                        </td>
                        <td>
                          {emp.status === "deactivated" ? (
                            <button 
                              className="btn btn-success"
                              style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}
                              onClick={async () => {
                                if (confirm(`Reactivate ${emp.name}?`)) {
                                  try {
                                    await reactivateEmployee(emp.uid);
                                    fetchData();
                                  } catch (err) {
                                    alert("Failed: " + err.message);
                                  }
                                }
                              }}
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}
                              onClick={async () => {
                                if (confirm(`Deactivate ${emp.name}? They will no longer be able to check in.`)) {
                                  try {
                                    await deactivateEmployee(emp.uid);
                                    fetchData();
                                  } catch (err) {
                                    alert("Failed: " + err.message);
                                  }
                                }
                              }}
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Attendance Shift Logs */}
        <div>
          <div className="glass-panel" style={{ height: "100%" }}>
            <h2 style={{ marginBottom: "1.5rem" }}>Today's Time Records</h2>
            
            {loadingData ? (
              <p>Loading registry logs...</p>
            ) : attendance.length === 0 ? (
              <p style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--text-muted)" }}>
                No clock-in records logged for today yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {attendance.map((log) => {
                  const cin = log.checkIn?.toDate ? log.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                  const cout = log.checkOut?.toDate ? log.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Working";
                  return (
                    <div 
                      key={log.id} 
                      className="glass-panel" 
                      style={{ 
                        padding: "1rem", 
                        borderLeft: `4px solid ${log.checkOut ? "var(--warning)" : "var(--success)"}`,
                        background: "rgba(255, 255, 255, 0.01)",
                        borderRadius: "8px" 
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "600" }}>{log.employeeName}</span>
                        <span className={`badge ${log.checkOut ? "badge-warning" : "badge-success"}`}>
                          {log.checkOut ? "Shift End" : "On Shift"}
                        </span>
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                        <span>In: <strong>{cin}</strong></span>
                        <span>Out: <strong>{cout}</strong></span>
                        {log.duration !== null && (
                          <span>Duration: <strong>{log.duration} hrs</strong></span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: REGISTER EMPLOYEE */}
      {showEmpModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowEmpModal(false)}>×</button>
            <h3 className="modal-title">Create Employee Account</h3>
            
            {empMsg.text && (
              <div style={{
                background: empMsg.isError ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                border: `1px solid ${empMsg.isError ? "rgba(239, 68, 68, 0.25)" : "rgba(16, 185, 129, 0.25)"}`,
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                color: empMsg.isError ? "#f87171" : "#34d399",
                fontSize: "0.9rem",
                marginBottom: "1.25rem"
              }}>
                {empMsg.text}
              </div>
            )}

            <form onSubmit={handleRegisterEmployee}>
              <div className="form-group">
                <label className="glass-label">Employee ID</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="e.g. EMP-101" 
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="glass-label">Full Name</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="e.g. Liam Sterling" 
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="glass-label">Email Address</label>
                <input 
                  type="email" 
                  className="glass-input" 
                  placeholder="liam@company.com" 
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="glass-label">Initial Password</label>
                <input 
                  type="password" 
                  className="glass-input" 
                  placeholder="Minimum 6 characters" 
                  value={empPassword}
                  onChange={(e) => setEmpPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowEmpModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submittingEmp}>
                  {submittingEmp ? "Registering..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN TASK */}
      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowTaskModal(false)}>×</button>
            <h3 className="modal-title">Task Allocation</h3>
            
            {taskMsg.text && (
              <div style={{
                background: taskMsg.isError ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                border: `1px solid ${taskMsg.isError ? "rgba(239, 68, 68, 0.25)" : "rgba(16, 185, 129, 0.25)"}`,
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                color: taskMsg.isError ? "#f87171" : "#34d399",
                fontSize: "0.9rem",
                marginBottom: "1.25rem"
              }}>
                {taskMsg.text}
              </div>
            )}

            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label className="glass-label">Select Assignee</label>
                <select 
                  className="glass-input" 
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  required
                  style={{ color: taskAssignee ? "#fff" : "#6b7280" }}
                >
                  <option value="" style={{ background: "#0e1322", color: "#6b7280" }}>Choose employee...</option>
                  {employees.map(emp => (
                    <option key={emp.uid} value={emp.uid} style={{ background: "#0e1322", color: "#fff" }}>
                      {emp.name} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="glass-label">Task Title</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="e.g. Train CNN Image Model" 
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="glass-label">Description</label>
                <textarea 
                  className="glass-input" 
                  placeholder="Detailed instructions..." 
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  required
                  rows={3}
                  style={{ resize: "none" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label className="glass-label">Priority</label>
                  <select 
                    className="glass-input" 
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    style={{ color: "#fff" }}
                  >
                    <option value="low" style={{ background: "#0e1322" }}>Low</option>
                    <option value="medium" style={{ background: "#0e1322" }}>Medium</option>
                    <option value="high" style={{ background: "#0e1322" }}>High</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="glass-label">Due Date</label>
                  <input 
                    type="date" 
                    className="glass-input" 
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    required
                    style={{ color: "#fff" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submittingTask}>
                  {submittingTask ? "Allocating..." : "Assign Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
