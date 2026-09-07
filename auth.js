// ===== 認証 =====
import { auth, db, GoogleAuthProvider, signInWithPopup, signOut,
  onAuthStateChanged, doc, setDoc, getDoc, serverTimestamp } from "./firebase.js";

// 現在ログイン中のユーザー
export let currentUser = null;

// ===== Googleでログイン =====
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    await createUserIfNew(result.user);
    return result.user;
  } catch (e) {
    console.error("ログインエラー:", e);
    throw e;
  }
}

// ===== ログアウト =====
export async function logout() {
  await signOut(auth);
  currentUser = null;
}

// ===== 初回ログイン時にFirestoreにユーザー作成 =====
async function createUserIfNew(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid:       user.uid,
      name:      user.displayName || "ユーザー",
      email:     user.email,
      avatar:    user.photoURL || "",
      createdAt: serverTimestamp(),
    });
  }
}

// ===== ログイン状態の監視 =====
// コールバックで画面を切り替える
export function watchAuthState(onLogin, onLogout) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      onLogin(user);
    } else {
      currentUser = null;
      onLogout();
    }
  });
}
