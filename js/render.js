// TripShare - Render Functions

// --- 旅行一覧 ---
window.renderTripList = (trips) => {
  const el = document.getElementById("trip-list");
  if (!el) return;
  if (trips.length === 0) {
    el.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#999">旅行がまだありません<br>下のボタンから作成しましょう</div>';
    return;
  }
  el.innerHTML = trips.map(t => {
    const members = t.members || [];
    const avHtml = members.slice(0, 4).map(m =>
      `<div class="av ${m.color || 'c4'}">${m.initial || m.name?.charAt(0) || '?'}</div>`
    ).join('');
    const memberNames = members.map(m => (m.name || '').split(' ')[0]).join(', ');
    const dateStr = formatDateRange(t.startDate, t.endDate);
    return `<div class="trip-card" onclick="openTrip('${t.id}')">
      <div class="trip-cover ${t.coverColor || 'cov-m'}"><div class="trip-cover-g"></div>
        <div class="trip-cover-info"><div class="trip-name">${esc(t.name)}</div></div>
      </div>
      <div class="trip-foot">
        <div class="trip-foot-top">
          <div class="av-stack">${avHtml}</div>
          <div class="trip-members-text">${esc(memberNames)}</div>
        </div>
        <div class="trip-foot-bottom">
          <div><div class="trip-date" style="color:var(--text3)">${dateStr}</div>
          <div class="trip-latest">${esc(t.latestAction ? '最新: ' + t.latestAction : '')}</div></div>
          <div class="trip-track-btn">軌跡</div>
        </div>
      </div>
    </div>`;
  }).join('');
};

// --- 世界タブ ---
window.renderWorldTab = (posts) => {
  const rankEl = document.getElementById("world-rank-list");
  const feedEl = document.getElementById("world-feed");
  if (!rankEl || !feedEl) return;
  posts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  const rankColors = ["g", "s", "br"];
  rankEl.innerHTML = posts.slice(0, 3).map((p, i) => `
    <div class="rank-item">
      <div class="rank-num ${rankColors[i]}">${i+1}</div>
      <div class="rank-thumb ${p.coverColor || 'p9'}"></div>
      <div class="rank-info"><div class="rank-nm">${esc(p.title)}</div><div class="rank-sub">${esc(p.location || '')}</div></div>
      <div class="rank-likes">${I.heart}${(p.likes||0).toLocaleString()}</div>
    </div>
  `).join('');
  feedEl.innerHTML = posts.map(p => `
    <div class="world-card">
      <div class="world-cover ${p.coverColor || 'cov-m'}"></div>
      <div class="world-body">
        <div class="world-t">${esc(p.title)}</div>
        <div class="world-loc">${I.pin}${esc(p.location || '')}</div>
        <div class="world-stats">
          <div class="ws">${I.eye}${(p.views||0).toLocaleString()}</div>
          <div class="ws">${I.heart}${(p.likes||0).toLocaleString()}</div>
          <div class="ws">${I.image}${p.photoCount||0}枚</div>
        </div>
      </div>
    </div>
  `).join('');
};

// --- トリップ詳細: メンバー横並び ---
window.renderTripDetailMembers = (members) => {
  const el = document.getElementById("td-members-row");
  if (!el) return;
  el.innerHTML = members.map(m => `
    <div class="td-mem">
      <div class="av td-mem-av ${m.color || 'c4'}">${m.avatar ? `<img src="${m.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : (m.initial || '?')}</div>
      <div class="td-mem-nm">${esc((m.name || '').split(' ')[0])}</div>
    </div>
  `).join('');
};

// --- 写真グリッド（カメラロール） ---
window.renderPhotoGrid = (photos) => {
  const el = document.getElementById("photo-grid");
  if (!el) return;
  el.innerHTML = photos.map(p => {
    const timeStr = p.takenAt?.toDate ? p.takenAt.toDate().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "";
    const color = p.uploaderColor || "c4";
    const initial = p.uploaderInitial || "?";
    const bgClass = p.placeholderColor || "p1";
    const fill = p.r2Url
      ? `<img class="fill" src="${p.r2Url}" alt="" style="width:100%;height:100%;object-fit:cover">`
      : `<div class="fill ${bgClass}"></div>`;
    return `<div class="pgrid-i">${fill}<div class="av pg-av ${color}">${initial}</div><div class="pg-t">${timeStr}</div></div>`;
  }).join('') || '<div style="grid-column:1/-1;padding:40px;text-align:center;color:#999">写真はまだありません</div>';
};

// --- アルバム ---
window._albumTab = 'member';
window.switchAlbumTab = (tab, el) => {
  document.querySelectorAll('.alb-tab').forEach(t => t.classList.remove('on'));
  if (el) el.classList.add('on');
  window._albumTab = tab;
  if (window._currentPhotos) renderAlbum(window._currentPhotos);
};

window.renderAlbum = (photos) => {
  const el = document.getElementById("album-body");
  const statsEl = document.getElementById("album-stats");
  const nameEl = document.getElementById("album-name");
  const membersEl = document.getElementById("album-members");
  if (!el) return;
  const trip = window._currentTrip;
  if (nameEl && trip) nameEl.textContent = trip.name;
  if (membersEl && trip) {
    const members = trip.members || [];
    membersEl.innerHTML = members.map(m =>
      `<div class="av ${m.color || 'c4'}" style="width:26px;height:26px;margin-left:-6px">${m.initial || '?'}</div>`
    ).join('') + `<span style="font-size:13px;color:var(--text3);margin-left:8px">${members.length}名</span>`;
  }
  if (statsEl) {
    const myCount = photos.filter(p => p.uploaderUid === window._fbUser?.uid).length;
    statsEl.innerHTML = `<div class="alb-s">全 <span>${photos.length}</span> 枚</div><div class="alb-s">あなた <span>${myCount}</span> 枚</div>`;
  }

  const tab = window._albumTab || 'member';
  let html = "";

  function photoTile(p) {
    const fill = p.r2Url
      ? `<img class="fill" src="${p.r2Url}" style="width:100%;height:100%;object-fit:cover">`
      : `<div class="fill ${p.placeholderColor || 'p1'}"></div>`;
    return `<div class="day-p">${fill}<div class="av day-av ${p.uploaderColor || 'c4'}">${p.uploaderInitial || '?'}</div></div>`;
  }

  if (tab === 'member') {
    // メンバー別にグループ化
    const byMember = {};
    photos.forEach(p => {
      const name = p.uploaderName || "不明";
      if (!byMember[name]) byMember[name] = [];
      byMember[name].push(p);
    });
    for (const [name, memberPhotos] of Object.entries(byMember)) {
      html += `<div class="day-sec"><div class="day-label">${esc(name)} (${memberPhotos.length}枚)</div><div class="day-grid">`;
      html += memberPhotos.map(photoTile).join('');
      html += `</div></div>`;
    }
  } else if (tab === 'place') {
    // 場所別（locationがなければ時間帯で仮グループ化）
    const byPlace = {};
    photos.forEach(p => {
      const loc = p.location || "場所未設定";
      const key = typeof loc === 'string' ? loc : (loc.name || "場所未設定");
      if (!byPlace[key]) byPlace[key] = [];
      byPlace[key].push(p);
    });
    for (const [place, placePhotos] of Object.entries(byPlace)) {
      html += `<div class="day-sec"><div class="day-label">${esc(place)} (${placePhotos.length}枚)</div><div class="day-grid">`;
      html += placePhotos.map(photoTile).join('');
      html += `</div></div>`;
    }
  } else {
    // 日付別
    const byDate = {};
    photos.forEach(p => {
      const d = p.takenAt?.toDate ? p.takenAt.toDate().toLocaleDateString("ja-JP") : "不明";
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(p);
    });
    let dayNum = 1;
    for (const [date, dayPhotos] of Object.entries(byDate)) {
      html += `<div class="day-sec"><div class="day-label">Day ${dayNum} (${date})</div><div class="day-grid">`;
      html += dayPhotos.map(photoTile).join('');
      html += `</div></div>`;
      dayNum++;
    }
  }

  el.innerHTML = html || '<div style="padding:40px;text-align:center;color:#999">写真はまだありません</div>';
};

// --- メンバー一覧 ---
window.renderMembers = () => {
  const el = document.getElementById("members-list");
  if (!el || !window._currentTrip) return;
  const members = window._currentTrip.members || [];
  el.innerHTML = `<div class="mem-card-h">メンバー ${members.length}名</div>` +
    members.map(m => {
      const badge = m.role === "owner"
        ? '<div class="mem-badge badge-o">オーナー</div>'
        : '<div class="mem-badge badge-m">メンバー</div>';
      const sub = m.role === "owner" ? "グループ作成者" : "参加中";
      return `<div class="mem-row">
        <div class="av mem-av ${m.color || 'c4'}">${m.initial || m.name?.charAt(0) || '?'}</div>
        <div class="mem-info"><div class="mem-nm">${esc(m.name)}</div><div class="mem-sub">${sub}</div></div>
        ${badge}
      </div>`;
    }).join('');
};

// --- プロフィール ---
window.renderProfile = () => {
  const user = window._fbUser;
  if (!user) return;
  const av = document.getElementById('prof-avatar');
  const nm = document.getElementById('prof-name');
  const em = document.getElementById('prof-email');
  if (nm) nm.textContent = user.displayName || 'User';
  if (em) em.textContent = user.email || '';
  if (av) {
    if (user.photoURL) {
      av.innerHTML = `<img src="${user.photoURL}" alt="">`;
    } else {
      av.textContent = (user.displayName || 'U').charAt(0);
    }
  }
  document.querySelectorAll('#screen-profile [data-icon]').forEach(el => {
    el.innerHTML = I[el.dataset.icon] || '';
  });
};

// --- 設定 ---
window.renderSettings = () => {
  const el = document.getElementById('settings-body');
  if (!el) return;
  const trip = window._currentTrip;
  el.innerHTML = `
    <div class="settings-section">
      <div class="settings-item">
        <div class="settings-item-left">
          <span class="ico">${I.bell}</span>
          <div><div class="settings-item-label">通知</div><div class="settings-item-sub">メッセージ・予定の通知</div></div>
        </div>
        <div class="toggle-sw on" onclick="this.classList.toggle('on')"></div>
      </div>
      <div class="settings-item">
        <div class="settings-item-left">
          <span class="ico">${I.gps}</span>
          <div><div class="settings-item-label">GPS位置共有</div><div class="settings-item-sub">メンバーに現在地を共有</div></div>
        </div>
        <div class="toggle-sw" onclick="this.classList.toggle('on')"></div>
      </div>
      <div class="settings-item">
        <div class="settings-item-left">
          <span class="ico">${I.camera}</span>
          <div><div class="settings-item-label">写真の自動保存</div><div class="settings-item-sub">撮影した写真を自動でアルバムに追加</div></div>
        </div>
        <div class="toggle-sw on" onclick="this.classList.toggle('on')"></div>
      </div>
      <div class="settings-item">
        <div class="settings-item-left">
          <span class="ico">${I.eye}</span>
          <div><div class="settings-item-label">公開設定</div><div class="settings-item-sub">この旅行を「世界のみんな」に公開</div></div>
        </div>
        <div class="toggle-sw" onclick="this.classList.toggle('on')"></div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-item" style="cursor:pointer">
        <div class="settings-item-left">
          <span class="ico">${I.users}</span>
          <div><div class="settings-item-label">メンバー管理</div><div class="settings-item-sub">${(trip?.members||[]).length}名が参加中</div></div>
        </div>
        <span class="ico" style="width:16px;height:16px;color:var(--text3)">${I.right}</span>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-item" style="cursor:pointer">
        <div class="settings-item-left">
          <span class="ico" style="color:#FF453A">${I.back}</span>
          <div><div class="settings-item-label settings-danger">このグループを退出</div></div>
        </div>
      </div>
    </div>
  `;
};
