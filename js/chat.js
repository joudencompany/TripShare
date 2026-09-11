// TripShare - Chat (LINE-style)

window.renderMessages = (msgs) => {
  const el = document.getElementById("chat-messages");
  if (!el) return;
  const uid = window._fbUser?.uid;
  let lastDate = "";
  let html = "";
  for (const m of msgs) {
    const sentAt = m.sentAt?.toDate ? m.sentAt.toDate() : new Date();
    const dateStr = sentAt.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
    if (dateStr !== lastDate) {
      html += `<div class="chat-dt"><span>${dateStr}</span></div>`;
      lastDate = dateStr;
    }
    const isMe = m.senderId === uid;
    const timeStr = sentAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    const initial = m.senderName?.charAt(0) || "?";
    const member = (window._currentTrip?.members || []).find(mm => mm.uid === m.senderId);
    const color = member?.color || "c4";
    const avatarHtml = member?.avatar
      ? `<img src="${member.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
      : initial;

    if (isMe) {
      html += `<div class="msg me">
        <div class="msg-time">${timeStr}</div>
        <div class="msg-bubble">${esc(m.text)}</div>
      </div>`;
    } else {
      html += `<div class="msg">
        <div class="av msg-av ${color}">${avatarHtml}</div>
        <div class="msg-w">
          <div class="msg-sender">${esc(m.senderName || '')}</div>
          <div style="display:flex;align-items:flex-end;gap:4px">
            <div class="msg-bubble">${esc(m.text)}</div>
            <div class="msg-time">${timeStr}</div>
          </div>
        </div>
      </div>`;
    }
  }
  el.innerHTML = html || '<div style="padding:40px;text-align:center;color:rgba(255,255,255,.5)">メッセージはまだありません</div>';
  el.scrollTop = el.scrollHeight;
};

window.sendChat = () => {
  const inp = document.getElementById('chat-input-box');
  const text = inp?.value?.trim();
  if (!text) return;
  const tripId = window._currentTripId;
  if (tripId && window.sendMsgFB) {
    window.sendMsgFB(tripId, text);
  }
  inp.value = '';
};
