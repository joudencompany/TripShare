// TripShare - Camera (Dual BeReal + 3sec Video)

// ===== State =====
let camStream = null;
let camStreamFront = null;
let camFacingMode = 'user';

// カメラモード: 'photo' | 'dual' | 'video'
let camMode = 'photo';
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let longPressTimer = null;
let videoTimer = null;
const VIDEO_MAX_MS = 3000;

// ===== startCamera =====
async function startCamera() {
  const video = document.getElementById('cam-video');
  const ph = document.getElementById('cam-placeholder');
  if (!video) return;

  // セキュアコンテキストチェック
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (ph) {
      ph.style.display = '';
      const pht = ph.querySelector('.cam-ph-t');
      if (pht) pht.textContent = 'カメラ非対応: HTTPS接続が必要です';
    }
    return;
  }

  try {
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
    video.srcObject = null;

    // getUserMediaにタイムアウト付きで試行
    function gumWithTimeout(constraints, ms) {
      return Promise.race([
        navigator.mediaDevices.getUserMedia(constraints),
        new Promise((_, reject) => setTimeout(() => reject(new Error('タイムアウト')), ms))
      ]);
    }

    let stream = null;
    try {
      stream = await gumWithTimeout({
        video: { facingMode: camFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      }, 5000);
    } catch(e1) {
      console.warn('facingMode指定で失敗、フォールバック:', e1.message);
      try {
        stream = await gumWithTimeout({ video: true, audio: false }, 5000);
      } catch(e2) {
        throw new Error('カメラにアクセスできません: ' + e2.message);
      }
    }

    camStream = stream;
    video.srcObject = stream;
    video.muted = true;

    // メタデータ読み込みを待つ
    await new Promise((resolve) => {
      if (video.readyState >= 1) { resolve(); return; }
      video.onloadedmetadata = () => resolve();
      setTimeout(resolve, 3000);
    });

    await video.play();

    // プレースホルダーを非表示、ビデオを表示
    if (ph) ph.style.display = 'none';
    video.style.display = 'block';

    // ミラー表示の制御
    video.classList.toggle('front', camFacingMode === 'user');

    const tn = document.getElementById('cam-trip-name');
    if (tn && window._currentTrip) tn.textContent = window._currentTrip.name;
  } catch(e) {
    console.error('カメラ起動エラー:', e);
    if (ph) {
      ph.style.display = '';
      const pht = ph.querySelector('.cam-ph-t');
      if (pht) pht.textContent = 'カメラを使用できません: ' + e.message;
    }
  }
}

// ===== stopCamera =====
function stopCamera() {
  // デュアルモードのフロントストリームも停止
  stopDualCamera();

  if (camStream) {
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
  }
  const video = document.getElementById('cam-video');
  if (video) { video.srcObject = null; video.style.display = ''; }
  const ph = document.getElementById('cam-placeholder');
  if (ph) { ph.style.display = ''; const pht = ph.querySelector('.cam-ph-t'); if (pht) pht.textContent = 'カメラを起動中...'; }
}

// ===== flipCamera =====
function flipCamera() {
  camFacingMode = camFacingMode === 'environment' ? 'user' : 'environment';
  startCamera();
}

// ===== setCamMode (改修: デュアルモード切替対応) =====
function setCamMode(mode) {
  const prevMode = camMode;
  camMode = mode;
  document.querySelectorAll('.cam-mode-btn').forEach(b => b.classList.remove('on'));
  const btn = document.querySelector(`.cam-mode-btn[data-mode="${mode}"]`);
  if (btn) btn.classList.add('on');

  const shut = document.querySelector('.cam-shut');
  if (shut) shut.style.borderColor = mode === 'video' ? '#FF453A' : 'rgba(255,255,255,.35)';

  // デュアルモード切替
  if (mode === 'dual') {
    stopCamera();
    startDualCamera();
  } else if (prevMode === 'dual') {
    stopDualCamera();
    startCamera();
  }
}

// ===== startDualCamera (BeReal風: 外カメ + 内カメ同時) =====
async function startDualCamera() {
  const videoBack = document.getElementById('cam-video');
  const videoFront = document.getElementById('cam-video-front');
  const ph = document.getElementById('cam-placeholder');
  const dualContainer = document.getElementById('cam-dual-container');

  if (!videoBack || !videoFront) return;

  try {
    // 外カメ
    const backStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
    });
    // 内カメ
    const frontStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
    });

    camStream = backStream;
    camStreamFront = frontStream;
    videoBack.srcObject = backStream;
    videoFront.srcObject = frontStream;

    await Promise.all([
      videoBack.play(),
      videoFront.play()
    ]);

    if (ph) ph.style.display = 'none';
    if (dualContainer) dualContainer.style.display = 'flex';
    videoBack.style.display = 'none'; // dualContainerが代わりに表示

  } catch(e) {
    console.error('デュアルカメラ起動エラー:', e);
    // フォールバック: 通常カメラ
    setCamMode('photo');
    startCamera();
  }
}

// ===== stopDualCamera =====
function stopDualCamera() {
  if (camStreamFront) {
    camStreamFront.getTracks().forEach(t => t.stop());
    camStreamFront = null;
  }
  const dualContainer = document.getElementById('cam-dual-container');
  if (dualContainer) dualContainer.style.display = 'none';
  const videoFront = document.getElementById('cam-video-front');
  if (videoFront) videoFront.srcObject = null;
}

// ===== takePhoto =====
function takePhoto() {
  if (camMode === 'dual') { takeDualPhoto(); return; }
  const video = document.getElementById('cam-video');
  const canvas = document.getElementById('cam-canvas');
  const flash = document.getElementById('cam-flash');
  if (!video || !canvas || !video.videoWidth) return;
  if (flash) { flash.style.opacity = '1'; setTimeout(() => { flash.style.opacity = '0'; }, 150); }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (camFacingMode === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  updateLastPhoto(dataUrl);
  console.log('写真を撮影しました（サイズ:', Math.round(dataUrl.length/1024), 'KB）');
}

// ===== takeDualPhoto (BeReal風: 両ストリームから上下合成) =====
async function takeDualPhoto() {
  const videoBack = document.getElementById('cam-video');
  const videoFront = document.getElementById('cam-video-front');
  const canvas = document.getElementById('cam-canvas');
  const flash = document.getElementById('cam-flash');

  if (!videoBack || !videoFront || !canvas) return;
  if (!videoBack.videoWidth || !videoFront.videoWidth) return;

  if (flash) { flash.style.opacity = '1'; setTimeout(() => flash.style.opacity = '0', 150); }

  const w = Math.max(videoBack.videoWidth, videoFront.videoWidth);
  const halfH = Math.max(videoBack.videoHeight, videoFront.videoHeight) / 2;

  canvas.width = w;
  canvas.height = halfH * 2;
  const ctx = canvas.getContext('2d');

  // 上半分: 外カメ
  const bw = videoBack.videoWidth, bh = videoBack.videoHeight;
  const bCropH = bh / 2;
  const bCropY = (bh - bCropH) / 2;
  ctx.drawImage(videoBack, 0, bCropY, bw, bCropH, 0, 0, w, halfH);

  // 下半分: 内カメ（ミラー）
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  const fw = videoFront.videoWidth, fh = videoFront.videoHeight;
  const fCropH = fh / 2;
  const fCropY = (fh - fCropH) / 2;
  ctx.drawImage(videoFront, 0, fCropY, fw, fCropH, 0, halfH, w, halfH);
  ctx.restore();

  // 中央の区切りライン
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, halfH - 1, w, 3);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  updateLastPhoto(dataUrl);
  console.log('デュアル写真を撮影しました（BeReal風上下合成）');
}

// ===== switchCamStream (ヘルパー: 旧デュアル互換用) =====
async function switchCamStream(video) {
  if (camStream) camStream.getTracks().forEach(t => t.stop());
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: camFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
    });
  } catch(e) {
    camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
  video.srcObject = camStream;
  await new Promise(r => { video.onloadedmetadata = () => r(); setTimeout(r, 2000); });
  await video.play();
  await new Promise(r => setTimeout(r, 300));
}

// ===== startVideoRecording (3秒自動停止) =====
function startVideoRecording() {
  if (camMode !== 'video' || !camStream || isRecording) return;
  isRecording = true;
  recordedChunks = [];

  const shut = document.querySelector('.cam-shut');
  if (shut) { shut.style.background = '#FF453A'; shut.style.transform = 'scale(0.85)'; }

  // 録画インジケーター
  const indicator = document.getElementById('cam-rec-indicator');
  if (indicator) indicator.style.display = 'flex';

  // プログレスリング開始
  const ring = document.querySelector('.cam-progress-ring');
  if (ring) ring.classList.add('recording');

  try {
    mediaRecorder = new MediaRecorder(camStream, { mimeType: 'video/webm;codecs=vp9' });
  } catch(e) {
    try { mediaRecorder = new MediaRecorder(camStream); } catch(e2) { console.error('録画不可:', e2); isRecording = false; return; }
  }

  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    console.log('動画を撮影しました（サイズ:', Math.round(blob.size/1024), 'KB）');
    updateLastPhoto(null, url);
  };
  mediaRecorder.start();

  // 3秒で自動停止
  videoTimer = setTimeout(() => {
    stopVideoRecording();
  }, VIDEO_MAX_MS);
}

// ===== stopVideoRecording =====
function stopVideoRecording() {
  if (!isRecording || !mediaRecorder) return;
  isRecording = false;
  clearTimeout(videoTimer);
  videoTimer = null;
  mediaRecorder.stop();

  const shut = document.querySelector('.cam-shut');
  if (shut) { shut.style.background = '#fff'; shut.style.transform = ''; }
  const indicator = document.getElementById('cam-rec-indicator');
  if (indicator) indicator.style.display = 'none';
  const ring = document.querySelector('.cam-progress-ring');
  if (ring) ring.classList.remove('recording');
}

// ===== onShutterDown / onShutterUp =====
function onShutterDown() {
  if (camMode === 'video') {
    longPressTimer = setTimeout(() => startVideoRecording(), 200);
  }
}

function onShutterUp() {
  if (camMode === 'video') {
    clearTimeout(longPressTimer);
    if (isRecording) { stopVideoRecording(); }
    else { takePhoto(); } // 短押しは通常写真
  } else {
    takePhoto();
  }
}

// ===== updateLastPhoto =====
function updateLastPhoto(dataUrl, videoUrl) {
  const lastPhoto = document.getElementById('cam-last-photo');
  if (lastPhoto && dataUrl) {
    lastPhoto.style.backgroundImage = `url(${dataUrl})`;
    lastPhoto.style.backgroundSize = 'cover';
    lastPhoto.style.backgroundPosition = 'center';
  } else if (lastPhoto && videoUrl) {
    lastPhoto.style.backgroundImage = '';
    lastPhoto.style.background = 'linear-gradient(135deg,#FF453A,#FF6B6B)';
  }
}

// ===== グローバル公開 =====
window.startCamera = startCamera;
window.stopCamera = stopCamera;
window.flipCamera = flipCamera;
window.setCamMode = setCamMode;
window.startDualCamera = startDualCamera;
window.stopDualCamera = stopDualCamera;
window.takePhoto = takePhoto;
window.takeDualPhoto = takeDualPhoto;
window.switchCamStream = switchCamStream;
window.startVideoRecording = startVideoRecording;
window.stopVideoRecording = stopVideoRecording;
window.onShutterDown = onShutterDown;
window.onShutterUp = onShutterUp;
window.updateLastPhoto = updateLastPhoto;
