// TripShare - App Core (Firebase + Auth + Navigation)

// ===== Firebase imports =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile }
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
    const splashActive = splash && splash.classList.contains("active");

    if (splashActive) {
      const loginBtns = document.getElementById("splash-btns");
      if (loginBtns) loginBtns.style.display = "none";

      // ログイン中ステータス表示
      const loginStatus = document.getElementById("splash-login-status");
      if (loginStatus) {
        const displayName = user.displayName || user.email?.replace('@tripshare.local','') || 'ユーザー';
        loginStatus.textContent = displayName + ' でログイン中...';
        loginStatus.style.display = '';
      }
    }

    // ニックネーム未設定チェック（Googleログイン初回）
    let hasNickname = true;
    try {
      const userRef2 = doc(db, "users", user.uid);
      const uSnap = await getDoc(userRef2);
      hasNickname = uSnap.exists() && uSnap.data().nickname;
    } catch(e) { console.warn("ニックネームチェックスキップ:", e.message); }

    if (!hasNickname && !user.email?.endsWith('@tripshare.local') && splashActive) {
      window._pendingNickname = true;
      const modal = document.getElementById('modal-nickname');
      if (modal) {
        const inp = document.getElementById('inp-nickname');
        if (inp) inp.value = user.displayName || '';
        modal.classList.add('show');
        startWatchingTrips(user.uid);
        startWatchingPublicPosts();
      } else {
        // モーダルが見つからない場合はそのままホームへ
        setTimeout(() => {
          goTo("home");
          startWatchingTrips(user.uid);
          startWatchingPublicPosts();
        }, 500);
      }
    } else {
      setTimeout(() => {
        goTo("home");
        startWatchingTrips(user.uid);
        startWatchingPublicPosts();
      }, splashActive ? 1500 : 0);
    }
  } else {
    window._fbUser = null;
    if (unsubTrips) { unsubTrips(); unsubTrips = null; }
    if (unsubPublicPosts) { unsubPublicPosts(); unsubPublicPosts = null; }

    // 初回 or セッション切れ → ボタン表示
    const loginBtns = document.getElementById("splash-btns");
    if (!localStorage.getItem('tripshare_logged_in')) {
      // 初回訪問: ボタンを表示
      if (loginBtns) loginBtns.style.display = "";
    } else {
      // セッション切れ: 2秒待ってからボタン表示
      setTimeout(() => {
        localStorage.removeItem('tripshare_logged_in');
        if (loginBtns) loginBtns.style.display = "";
      }, 2000);
    }
  }
});

// ===== Googleログイン（popup → 失敗時は常にredirect） =====
window.loginGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch(e) {
    if (e.code === 'auth/popup-closed-by-user') return; // ユーザーが自分で閉じた
    console.warn("Popup失敗 (" + e.code + ")、redirectにフォールバック");
    try {
      await signInWithRedirect(auth, provider);
    } catch(e2) {
      alert("ログイン失敗: " + e2.message);
    }
  }
};

// リダイレクト結果の処理（モバイルログイン後のページ復帰時）
getRedirectResult(auth).then((result) => {
  if (result && result.user) console.log("リダイレクトログイン成功:", result.user.displayName);
}).catch(e => console.warn("リダイレクト結果:", e.message));

// ===== ゲストIDフォーム表示/非表示 =====
window.showGuestForm = () => {
  const form = document.getElementById('guest-form');
  if (form) form.style.display = '';
};
window.hideGuestForm = () => {
  const form = document.getElementById('guest-form');
  if (form) form.style.display = 'none';
};
window.switchGuestTab = (tab, el) => {
  document.querySelectorAll('.guest-tab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('guest-tab-login').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('guest-tab-register').style.display = tab === 'register' ? '' : 'none';
};

// ===== ゲストID新規登録 =====
window.registerGuest = async () => {
  const id = document.getElementById('guest-reg-id')?.value?.trim();
  const pw = document.getElementById('guest-reg-pw')?.value;
  const nick = document.getElementById('guest-reg-nick')?.value?.trim();
  if (!id) { alert('ゲストIDを入力してください'); return; }
  if (!pw || pw.length < 6) { alert('パスワードは6文字以上で入力してください'); return; }
  if (!nick) { alert('ニックネームを入力してください'); return; }
  try {
    const email = id + '@tripshare.local';
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await updateProfile(cred.user, { displayName: nick });
    // Firestoreにユーザー文書作成
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      name: nick,
      nickname: nick,
      email: email,
      avatar: "",
      createdAt: serverTimestamp()
    });
    // onAuthStateChangedが処理する
  } catch(e) {
    if (e.code === 'auth/email-already-in-use') {
      alert('このゲストIDは既に使われています');
    } else {
      alert('登録失敗: ' + e.message);
    }
  }
};

// ===== ゲストIDログイン =====
window.loginGuest = async () => {
  const id = document.getElementById('guest-login-id')?.value?.trim();
  const pw = document.getElementById('guest-login-pw')?.value;
  if (!id || !pw) { alert('IDとパスワードを入力してください'); return; }
  try {
    await signInWithEmailAndPassword(auth, id + '@tripshare.local', pw);
    // onAuthStateChangedが処理する
  } catch(e) {
    if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      alert('IDまたはパスワードが間違っています');
    } else {
      alert('ログイン失敗: ' + e.message);
    }
  }
};

// ===== ニックネーム保存 =====
window.saveNickname = async () => {
  const nick = document.getElementById('inp-nickname')?.value?.trim();
  if (!nick) { alert('ニックネームを入力してください'); return; }
  const user = auth.currentUser;
  if (!user) return;
  try {
    await updateProfile(user, { displayName: nick });
    await updateDoc(doc(db, "users", user.uid), { name: nick, nickname: nick });
    window._fbUser = user;
    document.getElementById('modal-nickname')?.classList.remove('show');

    // 全参加グループのmembers配列を更新
    try {
      const tripsSnap = await getDocs(query(collection(db, "trips"), where("memberUids", "array-contains", user.uid)));
      for (const tripDoc of tripsSnap.docs) {
        const data = tripDoc.data();
        const members = data.members || [];
        const updated = members.map(m => m.uid === user.uid ? { ...m, name: nick, initial: nick.charAt(0) } : m);
        await updateDoc(doc(db, "trips", tripDoc.id), { members: updated });
      }
    } catch(e2) { console.warn('グループのニックネーム更新スキップ:', e2.message); }

    goTo("home");
  } catch(e) { alert('保存失敗: ' + e.message); }
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
    // 埋め込みチャットにも表示
    if (window.renderMessages) {
      const tdChat = document.getElementById('td-chat-messages');
      if (tdChat) {
        const origEl = document.getElementById('chat-messages');
        if (origEl) tdChat.innerHTML = origEl.innerHTML;
        tdChat.scrollTop = tdChat.scrollHeight;
      }
    }
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

  // Update footer highlights
  const footerMap = {'album':'album','map':'map','trip-detail':'home','schedule':'sched','chat':'chat'};
  const activeFooterKey = footerMap[id];
  if (activeFooterKey) {
    const bnav = el.querySelector('.td-bnav');
    if (bnav) {
      bnav.querySelectorAll('.bnav-i').forEach(b => b.classList.remove('on'));
      // Find the matching bnav-i by checking its id ending
      bnav.querySelectorAll('.bnav-i').forEach(b => {
        if (b.id && b.id.endsWith('-' + activeFooterKey)) b.classList.add('on');
      });
    }
  }

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
  if (id === 'trip-detail') { resetTripPanels(); }
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
  const fmtJP = (d) => `${d.getMonth()+1}月${d.getDate()}日`;
  if (!e) return fmtJP(sd);
  const ed = new Date(e + "T00:00:00");
  return `${fmtJP(sd)} - ${fmtJP(ed)}`;
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

// tripTabGo / resetTripPanels: kept as no-ops for compatibility
window.tripTabGo = () => {};
function resetTripPanels() {}

// 埋め込みチャットの送信
window.sendTripChat = () => {
  const inp = document.getElementById('td-chat-input');
  const text = inp?.value?.trim();
  if (!text) return;
  const tripId = window._currentTripId;
  if (tripId && window.sendMsgFB) {
    window.sendMsgFB(tripId, text);
  }
  inp.value = '';
  inp.focus();
};

// 埋め込みチャットのEnter送信
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('td-chat-input');
  if (inp) {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window.sendTripChat();
      }
    });
  }
});

// ユーティリティをグローバル公開（他ファイルのテンプレートから参照できるように）
window.esc = esc;
window.formatDateRange = formatDateRange;

// ===== Swipe navigation between footer screens =====
const footerScreenOrder = ['album', 'map', 'trip-detail', 'schedule', 'chat'];
let swipeStartX = 0;
let swipeStartY = 0;
let swiping = false;

function getFooterIndex(screenId) {
  return footerScreenOrder.indexOf(screenId);
}

function getCurrentFooterScreen() {
  // Check which footer screen is currently active
  const active = document.querySelector('.screen.active');
  if (!active) return -1;
  const screenMap = {
    'screen-album': 'album',
    'screen-map': 'map',
    'screen-trip-detail': 'trip-detail',
    'screen-schedule': 'schedule',
    'screen-chat': 'chat'
  };
  const id = active.id;
  const name = screenMap[id];
  return name ? getFooterIndex(name) : -1;
}

document.addEventListener('touchstart', (e) => {
  const idx = getCurrentFooterScreen();
  if (idx === -1) return;
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swiping = true;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  if (!swiping) return;
  swiping = false;
  const dx = e.changedTouches[0].clientX - swipeStartX;
  const dy = e.changedTouches[0].clientY - swipeStartY;
  // Only trigger if horizontal swipe is dominant and long enough
  if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return;

  const idx = getCurrentFooterScreen();
  if (idx === -1) return;

  if (dx < 0 && idx < footerScreenOrder.length - 1) {
    // Swipe left → next screen
    goTo(footerScreenOrder[idx + 1]);
  } else if (dx > 0 && idx > 0) {
    // Swipe right → previous screen
    goTo(footerScreenOrder[idx - 1]);
  }
}, { passive: true });
