// ===== Firestore データベース操作 =====
import { db, rtdb, collection, doc, getDoc, setDoc, addDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion,
  ref, set, onValue, off, rtServerTimestamp } from "./firebase.js";
import { currentUser } from "./auth.js";

// ==================== 旅行 ====================

// 旅行を作成する
export async function createTrip({ name, startDate, endDate, coverColor }) {
  const user = currentUser;
  const tripRef = await addDoc(collection(db, "trips"), {
    name,
    startDate,
    endDate,
    coverColor: coverColor || "pg5",
    createdBy: user.uid,
    members: [{
      uid:    user.uid,
      name:   user.displayName,
      avatar: user.photoURL || "",
      role:   "owner",
    }],
    createdAt: serverTimestamp(),
    isPublic:  false,
  });
  return tripRef.id;
}

// 自分の旅行一覧をリアルタイムで取得
export function watchMyTrips(callback) {
  const uid = currentUser.uid;
  const q = query(
    collection(db, "trips"),
    where("members", "array-contains", { uid, role: "owner" })
  );
  // ※ arrayContainsはオブジェクト完全一致が難しいため、
  //   memberUids フィールドを使う設計に変更
  const q2 = query(
    collection(db, "trips"),
    where("memberUids", "array-contains", uid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q2, (snap) => {
    const trips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(trips);
  });
}

// 旅行を1件取得
export async function getTrip(tripId) {
  const snap = await getDoc(doc(db, "trips", tripId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ==================== 写真 ====================

// 写真を保存（R2アップロード後のURLを保存）
export async function savePhoto(tripId, { r2Url, thumbUrl, location, caption }) {
  await addDoc(collection(db, "trips", tripId, "photos"), {
    r2Url,
    thumbUrl,
    location: location || null,   // { lat, lng }
    caption:  caption  || "",
    uploadedBy: currentUser.uid,
    uploaderName: currentUser.displayName,
    takenAt: serverTimestamp(),
  });
}

// 写真一覧をリアルタイムで取得
export function watchPhotos(tripId, callback) {
  const q = query(
    collection(db, "trips", tripId, "photos"),
    orderBy("takenAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const photos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(photos);
  });
}

// ==================== スケジュール ====================

// 予定を追加
export async function addSchedule(tripId, { title, date, time, icon, location }) {
  await addDoc(collection(db, "trips", tripId, "schedules"), {
    title,
    date,
    time,
    icon: icon || "📍",
    location: location || null,
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
  });
}

// 予定一覧を取得（日付でフィルタ）
export function watchSchedules(tripId, date, callback) {
  const q = query(
    collection(db, "trips", tripId, "schedules"),
    where("date", "==", date),
    orderBy("time", "asc")
  );
  return onSnapshot(q, (snap) => {
    const schedules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(schedules);
  });
}

// ==================== チャット ====================

// メッセージを送信
export async function sendMessage(tripId, { text, type, mediaUrl }) {
  await addDoc(collection(db, "trips", tripId, "messages"), {
    text:       text || "",
    type:       type || "text",  // "text" | "photo" | "location"
    mediaUrl:   mediaUrl || null,
    senderId:   currentUser.uid,
    senderName: currentUser.displayName,
    senderAvatar: currentUser.photoURL || "",
    sentAt:     serverTimestamp(),
  });
}

// チャットをリアルタイムで取得
export function watchMessages(tripId, callback) {
  const q = query(
    collection(db, "trips", tripId, "messages"),
    orderBy("sentAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(messages);
  });
}

// ==================== GPS (Realtime DB) ====================

// 位置情報を更新（30秒おき）
export function updateLocation(tripId, { lat, lng }) {
  const uid = currentUser.uid;
  const locRef = ref(rtdb, `locations/${tripId}/${uid}`);
  set(locRef, {
    lat,
    lng,
    name:      currentUser.displayName,
    updatedAt: rtServerTimestamp(),
  });
}

// メンバーの位置情報を監視
export function watchLocations(tripId, callback) {
  const locRef = ref(rtdb, `locations/${tripId}`);
  onValue(locRef, (snap) => {
    const data = snap.val() || {};
    callback(data);
  });
  // 監視解除関数を返す
  return () => off(locRef);
}

// ==================== GPS軌跡 ====================

// 軌跡ポイントを追加
export async function addRoutePoint(tripId, date, { lat, lng }) {
  const routeRef = doc(db, "trips", tripId, "routes", date);
  await setDoc(routeRef, {
    points: arrayUnion({
      lat,
      lng,
      timestamp: new Date().toISOString(),
      uid: currentUser.uid,
    }),
    date,
  }, { merge: true });
}
