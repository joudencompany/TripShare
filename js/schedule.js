// TripShare - Schedule (Add/Insert/Detail)

// スケジュールモーダル管理
let schedModalMode = null; // 'new' | 'detail' | 'insert'
let schedModalParentId = null;
let schedModalInsertAfterTime = null;

window.renderTripDetailSchedule = (allScheds, startDate, endDate) => {
  const tabsEl = document.getElementById("td-day-tabs");
  const timelineEl = document.getElementById("td-schedule-body");
  if (!tabsEl || !timelineEl) return;

  const dates = [];
  if (startDate) {
    const sd = new Date(startDate + "T12:00:00");
    const ed = endDate ? new Date(endDate + "T12:00:00") : new Date(sd);
    for (let d = new Date(sd); d <= ed; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
      dates.push(`${y}-${m}-${day}`);
    }
  }
  if (dates.length === 0) {
    const uniqueDates = [...new Set(allScheds.map(s => s.date))].sort();
    dates.push(...uniqueDates);
  }
  if (dates.length === 0) dates.push(new Date().toISOString().split('T')[0]);

  if (!window._tdActiveDate || !dates.includes(window._tdActiveDate)) {
    window._tdActiveDate = dates[0];
  }

  // 日付タブ + 追加ボタン
  tabsEl.innerHTML = dates.map((d, i) => {
    const dt = new Date(d + "T00:00:00");
    const label = `${i+1}日目 (${dt.getMonth()+1}/${dt.getDate()})`;
    const isOn = d === window._tdActiveDate;
    return `<div class="td-day-tab ${isOn ? 'on' : ''}" onclick="window._tdActiveDate='${d}';renderTripDetailSchedule(window._allSchedules||[],'${startDate}','${endDate}')">${label}</div>`;
  }).join('') + `<button class="td-day-add" onclick="openSchedModal('new')" title="予定を追加">+</button>`;

  // その日のスケジュール（親のみ）
  const dayScheds = allScheds.filter(s => s.date === window._tdActiveDate && !s.parentId);
  dayScheds.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  // サブアイテムのマップ
  const subItems = allScheds.filter(s => s.date === window._tdActiveDate && s.parentId);
  const subMap = {};
  subItems.forEach(s => {
    if (!subMap[s.parentId]) subMap[s.parentId] = [];
    subMap[s.parentId].push(s);
  });
  for (const key of Object.keys(subMap)) {
    subMap[key].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  if (dayScheds.length === 0) {
    timelineEl.innerHTML = `<div style="padding:30px;text-align:center;color:#999;font-size:14px">この日の予定はまだありません</div>
      <div style="padding:0 16px"><button class="btn btn-dashed" onclick="openSchedModal('new')">予定を追加</button></div>`;
    return;
  }

  let html = '';
  dayScheds.forEach((s, i) => {
    const iconSvg = window.I[s.icon] || window.I.pin;
    const isLast = i === dayScheds.length - 1;
    const subs = subMap[s.id] || [];

    // 予定間の挿入ボタン（最初の予定の前にも表示）
    if (i === 0) {
      html += `<div class="sched-insert-btn"><button onclick="openSchedModal('insert','','${s.time || ''}')">+</button></div>`;
    }

    // メインの予定
    html += `<div class="td-tl-item">
      <div class="td-tl-left">
        <div class="td-tl-time">${s.time || ''}</div>
        <div class="td-tl-dot-wrap"><div class="td-tl-dot"></div>${(isLast && subs.length === 0) ? '' : '<div class="td-tl-line"></div>'}</div>
      </div>
      <div class="td-tl-card">
        <div class="td-tl-ico">${iconSvg}</div>
        <div class="td-tl-info"><div class="td-tl-place">${esc(s.title)}</div><div class="td-tl-desc">${esc(s.description || '')}</div></div>
        <button class="td-tl-detail-btn" onclick="openSchedModal('detail','${s.id}')" title="詳細を追加">+</button>
      </div>
    </div>`;

    // サブアイテム
    if (subs.length > 0) {
      html += `<div class="td-tl-sub">`;
      subs.forEach(sub => {
        const subIcon = window.I[sub.icon] || window.I.pin;
        html += `<div class="td-tl-sub-item">
          <span class="ico">${subIcon}</span>
          <div><strong>${esc(sub.title)}</strong>${sub.time ? ' ' + sub.time : ''}</div>
        </div>`;
      });
      html += `</div>`;
    }

    // 予定間の挿入ボタン
    html += `<div class="sched-insert-btn"><button onclick="openSchedModal('insert','${s.time || ''}','${dayScheds[i+1]?.time || ''}')">+</button></div>`;
  });

  timelineEl.innerHTML = html;
};

// スケジュール個別画面のレンダリング（既存を維持）
window.renderSchedule = (scheds, date) => {
  const el = document.getElementById("schedule-timeline");
  const dateEl = document.getElementById("schedule-date-label");
  if (!el) return;
  if (dateEl) {
    const d = new Date(date + "T00:00:00");
    dateEl.innerHTML = `<div class="sched-d">${d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</div>
      <div class="sched-sub">${window._currentTrip?.name || ''}</div>`;
  }
  if (scheds.length === 0) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:#999">この日の予定はありません</div>';
    return;
  }
  el.innerHTML = scheds.map((s, i) => {
    const iconSvg = window.I[s.icon] || window.I.pin;
    const isLast = i === scheds.length - 1;
    return `<div class="tl-i">
      <div class="tl-l"><div class="tl-time">${s.time || ''}</div>
        <div class="tl-dl"><div class="tl-dot"></div>${isLast ? '' : '<div class="tl-line"></div>'}</div>
      </div>
      <div class="tl-c"><div class="tl-ico"><span class="ico">${iconSvg}</span></div>
        <div><div class="tl-place">${esc(s.title)}</div><div class="tl-desc">${esc(s.description || '')}</div></div>
      </div>
    </div>`;
  }).join('');
};

// モーダル表示
window.openSchedModal = (mode, parentId, insertTime) => {
  schedModalMode = mode;
  schedModalParentId = parentId || null;
  schedModalInsertAfterTime = insertTime || null;

  const ov = document.getElementById('sched-modal-overlay');
  if (!ov) return;

  let html = '<div class="modal-bar"></div>';

  if (mode === 'new' || mode === 'insert') {
    html += `<div class="sched-modal-t">${mode === 'insert' ? 'ここに予定を挿入' : '新しい予定を追加'}</div>`;
    html += renderSchedForm();
  } else if (mode === 'detail') {
    html += `<div class="sched-modal-t">追加する内容を選択</div>`;
    html += `<div class="sched-choice">
      <button class="sched-choice-btn" onclick="showSchedDetailForm()">
        <div class="choice-t">この予定の詳細を追加</div>
        <div class="choice-sub">集合場所・バスの時間・メモなど</div>
      </button>
      <button class="sched-choice-btn" onclick="schedModalMode='new';document.getElementById('sched-modal-content').innerHTML=renderSchedForm()">
        <div class="choice-t">新しい予定として追加</div>
        <div class="choice-sub">別の独立した予定を作成</div>
      </button>
    </div>`;
  }

  document.getElementById('sched-modal-content').innerHTML = html;
  ov.classList.add('show');
};

window.closeSchedModal = () => {
  const ov = document.getElementById('sched-modal-overlay');
  if (ov) ov.classList.remove('show');
};

window.showSchedDetailForm = () => {
  const el = document.getElementById('sched-modal-content');
  if (!el) return;
  el.innerHTML = `<div class="modal-bar"></div>
    <div class="sched-modal-t">詳細を追加</div>
    ${renderSchedForm(true)}`;
};

function renderSchedForm(isDetail) {
  const icons = ['pin', 'train', 'utensils', 'landmark', 'mountain', 'waves', 'camera'];
  const iconOptions = icons.map(ic =>
    `<div class="sched-icon-opt" data-icon="${ic}" onclick="selectSchedIcon(this)"><span class="ico">${window.I[ic] || ''}</span></div>`
  ).join('');

  return `<div class="sched-form">
    <label>${isDetail ? '内容' : 'タイトル'}</label>
    <input id="sched-inp-title" placeholder="${isDetail ? '例: 集合場所: 東京駅丸の内口' : '例: 東京タワー観光'}">
    <label>時間</label>
    <input id="sched-inp-time" type="time">
    ${!isDetail ? `<label>説明（任意）</label>
    <textarea id="sched-inp-desc" rows="2" placeholder="メモを入力..."></textarea>` : ''}
    <label>アイコン</label>
    <div class="sched-icon-row">${iconOptions}</div>
    <button class="btn btn-pri" onclick="submitSchedForm(${isDetail ? 'true' : 'false'})">${isDetail ? '詳細を追加' : '予定を追加'}</button>
  </div>`;
}
window.renderSchedForm = renderSchedForm;

let selectedSchedIcon = 'pin';
window.selectSchedIcon = (el) => {
  document.querySelectorAll('.sched-icon-opt').forEach(o => o.classList.remove('sel'));
  el.classList.add('sel');
  selectedSchedIcon = el.dataset.icon;
};

window.submitSchedForm = async (isDetail) => {
  const title = document.getElementById('sched-inp-title')?.value?.trim();
  const time = document.getElementById('sched-inp-time')?.value || '';
  const desc = document.getElementById('sched-inp-desc')?.value?.trim() || '';

  if (!title) { alert('タイトルを入力してください'); return; }
  if (!window._currentTripId || !window._tdActiveDate) return;

  const data = {
    title,
    time,
    description: isDetail ? '' : desc,
    date: window._tdActiveDate,
    icon: selectedSchedIcon,
    createdBy: window._fbUser?.uid || '',
    createdAt: window._serverTimestamp(),
  };

  if (isDetail && schedModalParentId) {
    data.parentId = schedModalParentId;
  }

  try {
    await window._addDoc(
      window._collection(window._db, "trips", window._currentTripId, "schedules"),
      data
    );
    closeSchedModal();
    selectedSchedIcon = 'pin';
  } catch(e) {
    alert('追加に失敗しました: ' + e.message);
  }
};

// スケジュール日付変更
window.schedPrev = () => {
  if (!window._currentSchedDate || !window._currentTripId) return;
  const d = new Date(window._currentSchedDate + "T00:00:00");
  d.setDate(d.getDate() - 1);
  const newDate = d.toISOString().split('T')[0];
  window.startWatchingSchedules(window._currentTripId, newDate);
};
window.schedNext = () => {
  if (!window._currentSchedDate || !window._currentTripId) return;
  const d = new Date(window._currentSchedDate + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const newDate = d.toISOString().split('T')[0];
  window.startWatchingSchedules(window._currentTripId, newDate);
};
