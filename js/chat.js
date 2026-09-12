// TripShare - Chat (LINE-style enhanced)

window.renderMessages = (msgs) => {
  const el = document.getElementById("chat-messages");
  if (!el) return;
  const uid = window._fbUser?.uid;
  let lastDate = "";
  let html = "";

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const next = msgs[i + 1];
    const sentAt = m.sentAt?.toDate ? m.sentAt.toDate() : new Date();
    const dateStr = sentAt.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

    if (dateStr !== lastDate) {
      html += '<div class="chat-dt"><span>' + dateStr + '</span></div>';
      lastDate = dateStr;
    }

    const isMe = m.senderId === uid;
    const timeStr = sentAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    const member = (window._currentTrip?.members || []).find(mm => mm.uid === m.senderId);
    const color = member?.color || "c4";
    const initial = m.senderName?.charAt(0) || "?";
    const avatarImg = member?.avatar
      ? '<img src="' + member.avatar + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">'
      : initial;

    // Check if next message is from same sender (hide avatar for current if so)
    const nextSameSender = next && next.senderId === m.senderId;
    const prevSameSender = i > 0 && msgs[i-1].senderId === m.senderId;

    if (isMe) {
      html += '<div class="msg me">';
      html += '<div class="msg-meta-me">';
      html += '<div class="msg-read">既読</div>';
      html += '<div class="msg-time">' + timeStr + '</div>';
      html += '</div>';
      if (m.type === 'image' && m.imageUrl) {
        html += '<div class="msg-img"><img src="' + m.imageUrl + '" alt=""></div>';
      } else {
        html += '<div class="msg-bubble">' + esc(m.text) + '</div>';
      }
      html += '</div>';
    } else {
      html += '<div class="msg' + (prevSameSender ? ' msg-cont' : '') + '">';
      if (!prevSameSender) {
        html += '<div class="av msg-av ' + color + '">' + avatarImg + '</div>';
      } else {
        html += '<div class="msg-av-spacer"></div>';
      }
      html += '<div class="msg-w">';
      if (!prevSameSender) {
        html += '<div class="msg-sender">' + esc(m.senderName || '') + '</div>';
      }
      html += '<div class="msg-row">';
      if (m.type === 'image' && m.imageUrl) {
        html += '<div class="msg-img"><img src="' + m.imageUrl + '" alt=""></div>';
      } else {
        html += '<div class="msg-bubble">' + esc(m.text) + '</div>';
      }
      if (!nextSameSender) {
        html += '<div class="msg-time">' + timeStr + '</div>';
      }
      html += '</div></div></div>';
    }
  }

  el.innerHTML = html || '<div class="chat-empty">メッセージはまだありません<br>最初のメッセージを送ってみましょう</div>';
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
  inp.focus();
};

// Handle Enter to send, Shift+Enter for newline
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('chat-input-box');
  if (inp) {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window.sendChat();
      }
    });
  }
});
