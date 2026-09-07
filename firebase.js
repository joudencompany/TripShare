// ===== Firebase 初期化 =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc,
  deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDatabase, ref, set, onValue, off, push, serverTimestamp as rtServerTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhfNSM8lghkwMt3ury-pwjh2GtD-39K_c",
  authDomain: "tripshare-fa284.firebaseapp.com",
  databaseURL: "https://tripshare-fa284-default-rtdb.firebaseio.com",
  projectId: "tripshare-fa284",
  storageBucket: "tripshare-fa284.firebasestorage.app",
  messagingSenderId: "794362309245",
  appId: "1:794362309245:web:29ca898969502d72799f14",
  measurementId: "G-6P5WJDKDS5",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const rtdb = getDatabase(app);

export { app, auth, db, rtdb,
  // Auth
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  // Firestore
  collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion,
  // Realtime DB
  ref, set, onValue, off, push, rtServerTimestamp
};
