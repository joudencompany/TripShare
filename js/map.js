// TripShare - Map (Leaflet + GPS)

let leafletMap = null;
let memberMarkers = [];

window.initMap = () => {
  const container = document.getElementById('leaflet-map');
  if (!container) return;

  // 既存のマップがあれば破棄
  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }

  // Leafletマップ初期化（デフォルト: 東京）
  leafletMap = L.map('leaflet-map').setView([35.6812, 139.7671], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(leafletMap);

  // メンバーの位置をマーカーで表示（ダミーデータ）
  const members = window._currentTrip?.members || [];
  const dummyPositions = [
    { lat: 35.6812, lng: 139.7671, label: '東京駅周辺' },
    { lat: 35.6586, lng: 139.7454, label: '渋谷周辺' },
    { lat: 35.7101, lng: 139.8107, label: '浅草周辺' },
    { lat: 35.6762, lng: 139.6503, label: '新宿周辺' },
  ];

  memberMarkers = [];
  members.forEach((m, i) => {
    const pos = dummyPositions[i % dummyPositions.length];
    const marker = L.marker([pos.lat, pos.lng]).addTo(leafletMap);
    marker.bindPopup(`<b>${m.name || '不明'}</b><br>${pos.label}`);
    memberMarkers.push(marker);
  });

  // メンバーリスト表示
  const listEl = document.getElementById('map-member-list');
  if (listEl) {
    listEl.innerHTML = members.map((m, i) => {
      const pos = dummyPositions[i % dummyPositions.length];
      const color = m.color || 'c4';
      return `<div class="map-mem-item" onclick="leafletMap.setView([${pos.lat},${pos.lng}],15)">
        <div class="av ${color}" style="width:32px;height:32px;font-size:12px">${esc(m.initial || '?')}</div>
        <div><div style="font-size:14px;font-weight:600;color:var(--text)">${esc(m.name || '')}</div>
        <div class="map-mem-loc">${pos.label}</div></div>
      </div>`;
    }).join('');
  }

  // マップサイズ修正（表示後にリサイズ）
  setTimeout(() => leafletMap.invalidateSize(), 200);
};
