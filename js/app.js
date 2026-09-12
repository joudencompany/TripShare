// TripShare - App Core (Firebase + Auth + Navigation)

// ===== Firebase imports =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where,
  onSnapshot, serverTimestamp, doc, setDoc, getDoc, getDocs, Timestamp, updateDoc, arrayUnion }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===== Firebase初期化 =====
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// グローバル公開（外部ファイルから参照できるように）
window._db = db;
window._collection = collection;
window._addDoc = addDoc;
window._query = query;
window._where = where;
window._onSnapshot = onSnapshot;
window._serverTimestamp = serverTimestamp;
window._doc = doc;
window._setDoc = setDoc;
window._getDoc = getDoc;
window._getDocs = getDocs;
window._updateDoc = updateDoc;

// ===== unsub変数群 =====
let unsubTrips = null;
let unsubMessages = null;
let unsubPhotos = null;
let unsubSchedules = null;
let unsubPublicPosts = null;
let unsubAllSchedules = null;

// ===== ナビ履歴 =====
let navHistory = [];
let navIndex = -1;
let navLock = false; // back/forward時のpush防止

// ============================================================
//  認証関連
// ============================================================

// ===== ログイン状態監視 =====
onAuthStateChanged(auth, async (user) => {
  if (user) {
    window._fbUser = user;
    localStorage.setItem('tripshare_logged_in', 'true');
    console.log("Firebase: ログイン成功 -", user.displayName);
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName || "User",
          email: user.email,
          avatar: user.photoURL || "",
          createdAt: serverTimestamp()
        });
      }
      // ログインユーザーをデモ旅行に追加
      const tripIds = ["trip_miyazaki", "trip_kyoto", "trip_hokkaido"];
      for (const tid of tripIds) {
        try {
          const tSnap = await getDoc(doc(db, "trips", tid));
          if (tSnap.exists()) {
            const d = tSnap.data();
            if (d.memberUids && !d.memberUids.includes(user.uid)) {
              await updateDoc(doc(db, "trips", tid), {
                memberUids: arrayUnion(user.uid),
                members: arrayUnion({
                  uid: user.uid,
                  name: user.displayName || "User",
                  avatar: user.photoURL || "",
                  role: "member",
                  color: "c4",
                  initial: (user.displayName || "U").charAt(0)
                })
              });
            }
          }
        } catch(e) { console.warn("旅行参加スキップ:", tid, e.message); }
      }
    } catch(e) { console.warn("Firestore処理スキップ:", e.message); }

    const splash = document.getElementById("screen-splash");
    if (splash && splash.classList.contains("active")) {
      // ログイン済み → splashをスキップして即座にhomeへ遷移
      goTo("home");
      startWatchingTrips(user.uid);
      startWatchingPublicPosts();
    }
  } else {
    window._fbUser = null;
    if (unsubTrips) { unsubTrips(); unsubTrips = null; }
    if (unsubPublicPosts) { unsubPublicPosts(); unsubPublicPosts = null; }

    // 以前ログインしていた場合 → splash画面で「ログイン中...」表示
    if (localStorage.getItem('tripshare_logged_in')) {
      const st = document.getElementById("splash-status");
      if (st) st.textContent = "ログイン中...";
      const loginBtns = document.querySelector(".splash-btns");
      if (loginBtns) loginBtns.style.display = "none";
      // セッション切れの場合: ポップアップでログイン試行
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        // 成功すればonAuthStateChangedが再発火してhomeへ遷移する
      } catch(e) {
        console.warn("自動再ログイン失敗:", e.message);
        localStorage.removeItem('tripshare_logged_in');
        // ボタンを再表示して通常のsplashに戻す
        if (st) st.textContent = "";
        if (loginBtns) loginBtns.style.display = "";
      }
    }
  }
});

// ===== Googleログイン =====
window.loginGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    setTimeout(() => {
      if (document.getElementById("screen-splash")?.classList.contains("active")) {
        goTo("home");
        startWatchingTrips(result.user.uid);
        startWatchingPublicPosts();
      }
    }, 2000);
  } catch(e) { alert("ログイン失敗: " + e.message); }
};

// ===== ログアウト =====
window.fbLogout = async () => {
  if (unsubTrips) { unsubTrips(); unsubTrips = null; }
  if (unsubPublicPosts) { unsubPublicPosts(); unsubPublicPosts = null; }
  localStorage.removeItem('tripshare_logged_in');
  await signOut(auth);
  goTo("splash");
};

// ============================================================
//  旅行作成
// ============================================================

window.createTripFB = async (name, startDate, endDate, coverColor) => {
  if (!window._fbUser) return;
  const uid = window._fbUser.uid;
  const myName = window._fbUser.displayName || "User";
  const ref = await addDoc(collection(db, "trips"), {
    name, startDate, endDate,
    coverColor: coverColor || "cov-m",
    createdBy: uid,
    memberUids: [uid],
    members: [{
      uid, name: myName,
      avatar: window._fbUser.photoURL || "",
      role: "owner",
      color: "c4",
      initial: myName.charAt(0)
    }],
    createdAt: serverTimestamp(),
    isPublic: false,
    latestAction: myName + "が作成",
  });
  return ref.id;
};

// ============================================================
//  メッセージ送信
// ============================================================

window.sendMsgFB = async (tripId, text) => {
  if (!window._fbUser || !text.trim()) return;
  await addDoc(collection(db, "trips", tripId, "messages"), {
    text, type: "text",
    senderId: window._fbUser.uid,
    senderName: window._fbUser.displayName || "User",
    senderAvatar: window._fbUser.photoURL || "",
    sentAt: serverTimestamp(),
  });
};

// ============================================================
//  リアルタイム監視
// ============================================================

// ===== 旅行一覧をリアルタイム監視 =====
function startWatchingTrips(uid) {
  if (unsubTrips) unsubTrips();
  const q = query(collection(db, "trips"), where("memberUids", "array-contains", uid));
  unsubTrips = onSnapshot(q, (snap) => {
    const trips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    trips.sort((a, b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return tb - ta;
    });
    window._trips = trips;
    if (window.renderTripList) window.renderTripList(trips);
  }, (err) => {
    console.error("旅行一覧の取得エラー:", err);
    const el = document.getElementById("trip-list");
    if (el) el.innerHTML = '<div style="padding:20px;text-align:center;color:#999">データの読み込みに失敗しました</div>';
  });
}

// ===== 公開投稿を監視（世界タブ） =====
function startWatchingPublicPosts() {
  if (unsubPublicPosts) unsubPublicPosts();
  const q = query(collection(db, "public_posts"));
  unsubPublicPosts = onSnapshot(q, (snap) => {
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (window.renderWorldTab) window.renderWorldTab(posts);
  }, (err) => { console.error("公開投稿の取得エラー:", err); });
}

// ===== 旅行詳細を開く =====
window.openTrip = (tripId) => {
  const trip = (window._trips || []).find(t => t.id === tripId);
  if (!trip) return;
  window._currentTrip = trip;
  window._currentTripId = tripId;

  // トリップ詳細画面を更新
  const tdName = document.getElementById("td-trip-name");
  if (tdName) tdName.textContent = trip.name;
  if (window.renderTripDetailMembers) window.renderTripDetailMembers(trip.members || []);

  // Update cover
  const cover = document.getElementById('td-cover');
  if (cover) {
    cover.className = 'td-cover ' + (trip.coverColor || 'cov-k');
    if (trip.coverUrl) {
      cover.style.backgroundImage = 'url(' + trip.coverUrl + ')';
      cover.style.backgroundSize = 'cover';
      cover.style.backgroundPosition = 'center';
    } else {
      cover.style.backgroundImage = '';
    }
  }
  // Update date range
  const dateEl = document.getElementById('td-date-range');
  if (dateEl) dateEl.textContent = formatDateRange(trip.startDate, trip.endDate);

  // 各サブデータの監視を開始
  startWatchingMessages(tripId);
  startWatchingPhotos(tripId);
  startWatchingAllSchedules(tripId, trip.startDate, trip.endDate);

  goTo("trip-detail");
};

// ===== メッセージ監視 =====
function startWatchingMessages(tripId) {
  if (unsubMessages) unsubMessages();
  const q = query(collection(db, "trips", tripId, "messages"));
  unsubMessages = onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    msgs.sort((a, b) => {
      const ta = a.sentAt?.toDate ? a.sentAt.toDate().getTime() : 0;
      const tb = b.sentAt?.toDate ? b.sentAt.toDate().getTime() : 0;
      return ta - tb;
    });
    if (window.renderMessages) window.renderMessages(msgs);
  });
}

// ===== 写真監視 =====
function startWatchingPhotos(tripId) {
  if (unsubPhotos) unsubPhotos();
  const q = query(collection(db, "trips", tripId, "photos"));
  unsubPhotos = onSnapshot(q, (snap) => {
    const photos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    photos.sort((a, b) => {
      const ta = a.takenAt?.toDate ? a.takenAt.toDate().getTime() : 0;
      const tb = b.takenAt?.toDate ? b.takenAt.toDate().getTime() : 0;
      return tb - ta;
    });
    window._currentPhotos = photos;
    if (window.renderPhotoGrid) window.renderPhotoGrid(photos);
    if (window.renderAlbum) window.renderAlbum(photos);
  });
}

// ===== 全スケジュール監視（日付タブ用） =====
function startWatchingAllSchedules(tripId, startDate, endDate) {
  if (unsubAllSchedules) unsubAllSchedules();
  const q = query(collection(db, "trips", tripId, "schedules"));
  unsubAllSchedules = onSnapshot(q, (snap) => {
    const allScheds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    allScheds.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    window._allSchedules = allScheds;
    if (window.renderTripDetailSchedule) window.renderTripDetailSchedule(allScheds, startDate, endDate);
    if (window.renderNextSchedule) window.renderNextSchedule(allScheds);
  });
}

// ===== スケジュール監視（個別画面用） =====
function startWatchingSchedules(tripId, date) {
  if (unsubSchedules) unsubSchedules();
  window._currentSchedDate = date;
  const q = query(collection(db, "trips", tripId, "schedules"), where("date", "==", date));
  unsubSchedules = onSnapshot(q, (snap) => {
    const scheds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    scheds.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    if (window.renderSchedule) window.renderSchedule(scheds, date);
  });
}

// ============================================================
//  ナビゲーション
// ============================================================

function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screens = {
    'splash':      'screen-splash',
    'home':        'screen-home',
    'trip-detail': 'screen-trip-detail',
    'schedule':    'screen-schedule',
    'camera-roll': 'screen-camera-roll',
    'album':       'screen-album',
    'camera':      'screen-camera',
    'chat':        'screen-chat',
    'members':     'screen-members',
    'profile':     'screen-profile',
    'settings':    'screen-settings',
    'map':         'screen-map'
  };
  const el = document.getElementById(screens[id]);
  if (el) el.classList.add('active');

  // ナビ履歴に追加
  if (!navLock) {
    if (navIndex < navHistory.length - 1) {
      navHistory = navHistory.slice(0, navIndex + 1);
    }
    navHistory.push(id);
    navIndex = navHistory.length - 1;
  }
  updateNavArrows();

  // 各画面の初期化処理
  if (id === 'members') { if (window.renderMembers) window.renderMembers(); }
  if (id === 'settings') { if (window.renderSettings) window.renderSettings(); }
  if (id === 'chat') {
    const tn = document.getElementById("chat-trip-name");
    if (tn && window._currentTrip) tn.textContent = window._currentTrip.name;
    setTimeout(() => {
      const chatEl = document.getElementById("chat-messages");
      if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
    }, 100);
  }
  if (id === 'camera') setTimeout(() => { if (window.startCamera) window.startCamera(); }, 100);
  if (id !== 'camera') { if (window.stopCamera) window.stopCamera(); }
  if (id === 'profile') { if (window.renderProfile) window.renderProfile(); }
  if (id === 'map') { if (window.initMap) window.initMap(); }
  if (id === 'album' && !window._currentTrip && window._trips?.length) {
    const t = window._trips[0];
    window._currentTrip = t;
    window._currentTripId = t.id;
    startWatchingPhotos(t.id);
  }
  if (id === 'album' && window._currentPhotos) {
    if (window.renderAlbum) window.renderAlbum(window._currentPhotos);
  }
  if (id === 'schedule' && window._currentTripId) {
    startWatchingSchedules(
      window._currentTripId,
      window._currentTrip?.startDate || new Date().toISOString().split('T')[0]
    );
  }
}

function navBack() {
  if (navIndex <= 0) return;
  navLock = true;
  navIndex--;
  goTo(navHistory[navIndex]);
  navLock = false;
}

function navForward() {
  if (navIndex >= navHistory.length - 1) return;
  navLock = true;
  navIndex++;
  goTo(navHistory[navIndex]);
  navLock = false;
}

function updateNavArrows() {
  const backBtn = document.getElementById('nav-back');
  const fwdBtn = document.getElementById('nav-forward');
  if (backBtn) backBtn.disabled = navIndex <= 0;
  if (fwdBtn) fwdBtn.disabled = navIndex >= navHistory.length - 1;
}

// ============================================================
//  ユーティリティ
// ============================================================

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

function formatDateRange(s, e) {
  if (!s) return "";
  const sd = new Date(s + "T00:00:00");
  const fmt = (d) => `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  if (!e) return fmt(sd);
  const ed = new Date(e + "T00:00:00");
  if (sd.getFullYear() === ed.getFullYear() && sd.getMonth() === ed.getMonth()) {
    return `${fmt(sd)} - ${ed.getMonth()+1}/${ed.getDate()}`;
  }
  return `${fmt(sd)} - ${fmt(ed)}`;
}

// ============================================================
//  window公開
// ============================================================

window.goTo = goTo;
window.navBack = navBack;
window.navForward = navForward;
window.startWatchingSchedules = startWatchingSchedules;

// 外部ファイルで定義される関数（camera.js 等で window に登録される）
// window.startCamera / window.stopCamera / window.flipCamera
// window.takePhoto / window.takeDualPhoto / window.setCamMode
// window.onShutterDown / window.onShutterUp
// window.startVideoRecording / window.stopVideoRecording
// window.renderMembers / window.renderSettings / window.renderProfile
// window.renderTripList / window.renderWorldTab / window.renderMessages
// window.renderPhotoGrid / window.renderAlbum / window.renderSchedule
// window.renderTripDetailMembers / window.renderTripDetailSchedule
// window.initMap

// ユーティリティをグローバル公開（他ファイルのテンプレートから参照できるように）
window.esc = esc;
window.formatDateRange = formatDateRange;
