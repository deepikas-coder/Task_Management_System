import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  limit,
  Timestamp 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { db, storage, firebaseConfig } from "./firebase";

// ==========================================
// 1. Employee Management (CEO actions)
// ==========================================

// Get all registered employees
export const getEmployees = async () => {
  try {
    const q = query(collection(db, "users"), where("role", "==", "employee"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error in getEmployees:", error);
    throw error;
  }
};

// Deactivate an employee (CEO action) - employee can no longer login/work
export const deactivateEmployee = async (uid) => {
  try {
    await updateDoc(doc(db, "users", uid), {
      status: "deactivated",
      deactivatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Error deactivating employee:", error);
    throw error;
  }
};

// Reactivate a deactivated employee (CEO action)
export const reactivateEmployee = async (uid) => {
  try {
    await updateDoc(doc(db, "users", uid), {
      status: "inactive",
      deactivatedAt: null
    });
    return true;
  } catch (error) {
    console.error("Error reactivating employee:", error);
    throw error;
  }
};

// CEO registers an employee using a temporary app instance
// to avoid signing out the current CEO session.
export const registerEmployee = async (email, password, name, employeeId) => {
  let tempApp;
  try {
    // Generate a unique app name to avoid duplicates in Firebase registry
    const tempAppName = `TempApp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);
    
    // Create authentication user credentials
    const credential = await createUserWithEmailAndPassword(tempAuth, email, password);
    const uid = credential.user.uid;
    
    // Save employee profile in the main database
    const employeeProfile = {
      uid,
      name,
      email,
      role: "employee",
      employeeId,
      status: "inactive", // Status defaults to inactive (not checked-in)
      createdAt: new Date().toISOString(),
    };
    
    await setDoc(doc(db, "users", uid), employeeProfile);
    
    // Clean up temporary session
    await signOut(tempAuth);
    await tempApp.delete();
    
    return employeeProfile;
  } catch (error) {
    if (tempApp) {
      try {
        await tempApp.delete();
      } catch (err) {
        console.error("Failed to delete temp app:", err);
      }
    }
    console.error("Error in registerEmployee:", error);
    throw error;
  }
};

// ==========================================
// 2. Attendance System (Real-time logs)
// ==========================================

// Helper to get local date string YYYY-MM-DD
export const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Check-in helper - creates a new session each time (supports multiple sessions per day)
export const checkInEmployee = async (userId, employeeName) => {
  try {
    const today = getLocalDateString();
    // Unique ID per session using timestamp = supports multiple check-ins per day
    const sessionId = `${userId}_${today}_${Date.now()}`;
    
    const attendanceDocRef = doc(db, "attendance", sessionId);
    
    const checkInRecord = {
      id: sessionId,
      userId,
      employeeName,
      date: today,
      checkIn: Timestamp.now(),
      checkOut: null,
      duration: null
    };
    
    await setDoc(attendanceDocRef, checkInRecord);
    await updateDoc(doc(db, "users", userId), { status: "active" });
    
    return checkInRecord;
  } catch (error) {
    console.error("Error checking in:", error);
    throw error;
  }
};

// Check-out helper - finds the current open session and closes it
export const checkOutEmployee = async (userId) => {
  try {
    const today = getLocalDateString();
    
    // Find the open session for today (checkOut is null)
    const q = query(
      collection(db, "attendance"),
      where("userId", "==", userId),
      where("date", "==", today),
      where("checkOut", "==", null)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error("No active check-in session found. Please check in first.");
    }
    
    const sessionDoc = snapshot.docs[0];
    const sessionId = sessionDoc.id;
    const checkInTime = sessionDoc.data().checkIn.toDate();
    const checkOutTime = new Date();
    
    const diffMs = checkOutTime.getTime() - checkInTime.getTime();
    const durationHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    
    const updates = {
      checkOut: Timestamp.fromDate(checkOutTime),
      duration: durationHours
    };
    
    await updateDoc(doc(db, "attendance", sessionId), updates);
    await updateDoc(doc(db, "users", userId), { status: "inactive" });
    
    return { id: sessionId, ...sessionDoc.data(), ...updates };
  } catch (error) {
    console.error("Error checking out:", error);
    throw error;
  }
};

// Fetch TODAY's active (open) session - returns null if not checked in or already checked out
export const getTodayAttendance = async (userId) => {
  try {
    const today = getLocalDateString();
    // Only return open session (no checkOut yet)
    const q = query(
      collection(db, "attendance"),
      where("userId", "==", userId),
      where("date", "==", today),
      where("checkOut", "==", null)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching today's attendance:", error);
    return null;
  }
};

// Fetch all attendance logs for an employee (ordered by date desc)
export const getEmployeeAttendanceLogs = async (userId) => {
  try {
    const q = query(
      collection(db, "attendance"), 
      where("userId", "==", userId),
      orderBy("checkIn", "desc"),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error in getEmployeeAttendanceLogs:", error);
    // Fallback: simple sorting client side if indexes aren't created yet in firestore
    try {
      const q = query(collection(db, "attendance"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.checkIn.seconds - a.checkIn.seconds);
    } catch (fallbackError) {
      console.error("Firestore queries index failure, returning empty logs:", fallbackError);
      return [];
    }
  }
};

// Fetch all attendance logs for today (for CEO dashboard)
export const getTodayAttendanceLogs = async () => {
  try {
    const today = getLocalDateString();
    const q = query(collection(db, "attendance"), where("date", "==", today));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching today's attendance logs:", error);
    return [];
  }
};

// ==========================================
// 3. Task Management (Allocating and monitoring)
// ==========================================

// Create a task (CEO)
export const createTask = async (title, description, assignedToId, assignedToName, assignedById, priority, dueDate) => {
  try {
    const taskCollectionRef = collection(db, "tasks");
    const taskId = doc(taskCollectionRef).id; // Generate random id
    
    const newTask = {
      id: taskId,
      title,
      description,
      assignedTo: assignedToId,
      assignedToName,
      assignedBy: assignedById,
      priority, // 'high' | 'medium' | 'low'
      status: "pending", // 'pending' | 'in-progress' | 'completed'
      dueDate,
      createdAt: Timestamp.now(),
      report: null // Will contain text, document URL, and timestamp
    };
    
    await setDoc(doc(db, "tasks", taskId), newTask);
    return newTask;
  } catch (error) {
    console.error("Error in createTask:", error);
    throw error;
  }
};

// Get tasks assigned to specific employee
export const getTasksForEmployee = async (userId) => {
  try {
    const q = query(
      collection(db, "tasks"), 
      where("assignedTo", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error in getTasksForEmployee (indexed query):", error);
    // Fallback if index not ready
    try {
      const q = query(collection(db, "tasks"), where("assignedTo", "==", userId));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
    } catch (fallbackError) {
      return [];
    }
  }
};

// Get all tasks (CEO view)
export const getAllTasks = async () => {
  try {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error in getAllTasks (indexed query):", error);
    // Fallback
    try {
      const snapshot = await getDocs(collection(db, "tasks"));
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
    } catch (fallbackError) {
      return [];
    }
  }
};

// Update task status (Employee updates workflow)
export const updateTaskStatus = async (taskId, status) => {
  try {
    const taskDocRef = doc(db, "tasks", taskId);
    await updateDoc(taskDocRef, { status });
    return { taskId, status };
  } catch (error) {
    console.error("Error updating task status:", error);
    throw error;
  }
};

// Upload report for task and mark completed (Employee action)
// Files are stored as Base64 in Firestore directly (no Firebase Storage needed)
export const uploadTaskReport = async (taskId, notes, file = null) => {
  try {
    const taskDocRef = doc(db, "tasks", taskId);
    let fileData = null;
    
    // Handle file - convert to Base64 and store in Firestore
    if (file) {
      // Check file size (limit to 800KB for Firestore doc safety)
      if (file.size > 800 * 1024) {
        throw new Error("File too large! Maximum file size is 800KB. Please compress your PDF or upload a smaller file.");
      }
      
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
        
        fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          base64: base64  // Full data URL (includes "data:application/pdf;base64,...")
        };
      } catch (fileReadError) {
        console.warn("File reading failed:", fileReadError);
        notes = `${notes} (Note: File could not be processed)`;
      }
    }
    
    const reportData = {
      notes: notes || "No additional comments.",
      file: fileData,
      uploadedAt: Timestamp.now()
    };
    
    await updateDoc(taskDocRef, {
      report: reportData,
      status: "completed"
    });
    
    return reportData;
  } catch (error) {
    console.error("Error uploading task report:", error);
    throw error;
  }
};

// Check if any CEO exists in database (determines signup vs login flow)
export const checkIfCEOExists = async () => {
  try {
    const q = query(collection(db, "users"), where("role", "==", "ceo"), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error("Error checking CEO exists:", error);
    return false;
  }
};
