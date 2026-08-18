import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Retrieve configuration dynamically from environment variables or browser localStorage
const getFirebaseConfig = () => {
  if (typeof window !== "undefined") {
    const localConfig = localStorage.getItem("WORKSYNC_FIREBASE_CONFIG");
    if (localConfig) {
      try {
        return JSON.parse(localConfig);
      } catch (e) {
        console.error("Failed to parse local config from localStorage:", e);
      }
    }
  }
  
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
};

const firebaseConfig = getFirebaseConfig();

// Verify if credentials are valid and not default placeholders
const hasValidKeys = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "your_api_key_here" && 
  !firebaseConfig.apiKey.includes("DummyKey")
);

let app;
let auth;
let db;
let storage;

if (hasValidKeys) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} else {
  // Safe mock configuration initialization to prevent SSR / Client import crashes
  const fallbackConfig = {
    apiKey: "AIzaSyDummyKeyForBuildVerification",
    authDomain: "mock-auth.firebaseapp.com",
    projectId: "mock-project-12345",
    storageBucket: "mock-storage.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcd1234efgh5678",
  };
  app = getApps().length === 0 ? initializeApp(fallbackConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage, hasValidKeys, firebaseConfig };
