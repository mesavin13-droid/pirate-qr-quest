/* Finale photo support for Robot, Halloween and Winter quests.
   Photos chosen from a phone stay in that browser. A public HTTPS photo URL
   is embedded in the printed final QR so a second device can see it. */
(function () {
  "use strict";
  if (!window.QD || !window.V || typeof window.render !== "function") return;

  var prizePhotoUrl = "";
  var scannedPrizePhotoUrl = "";

  function validPhotoUrl(value) {
    value = String(value || "").trim();
    if (!value || value.length > 250) return "";
    try {
      var parsed = new URL(value);
      if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return "";
      return parsed.href.length <= 250 ? parsed.href : "";
    } catch (e) { return ""; }
  }

  function storedUrl() {
    try { return localStorage.getItem(PX + "prize_photo_url") || ""; }
    catch (e) { return ""; }
  }
  prizePhotoUrl = validPhotoUrl(storedUrl());

  var originalLoadQuest = window.loadQ;
  window.loadQ = function (id) {
    originalLoadQuest(id);
    prizePhotoUrl = validPhotoUrl(storedUrl());
    scannedPrizePhotoUrl = "";
  };

  function decodeFinalPayload(token) {
    if (!/^[A-Za-z0-9_-]{1,800}$/.test(token)) return null;
    try {
      var raw = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      var decoded = new TextDecoder("utf-8", {fatal:true}).decode(bytes);
      var data;
      if (decoded.indexOf('["p1",') === 0) {
        data = JSON.parse(decoded);
        if (!Array.isArray(data) || data.length !== 3 || data[0] !== "p1") return null;
        if (typeof data[1] !== "string" || data[1].length > 90 ||
            typeof data[2] !== "string" || data[2].length > 250) return null;
        var url = data[2] ? validPhotoUrl(data[2]) : "";
        if (data[2] && !url) return null;
        return {place:data[1].trim(), photo:url};
      }
      // Previously printed final QR codes contain just the clue text.
      return decoded.length <= 140 && decoded.trim() ?
        {place:decoded.trim(), photo:""} : null;
    } catch (e) { return null; }
  }

  window.prizeQrUrl = function () {
    var place = String(prize || "").trim();
    if (!place || place.length > 90) return "";
    var photoUrl = validPhotoUrl(prizePhotoUrl);
    var payload = photoUrl ? JSON.stringify(["p1", place, photoUrl]) : place;
    var encoded = encodePrizeLocation(payload);
    if (encoded.length > 800) return "";
    return location.origin + location.pathname + "#quest-reward=" + Q + "." + encoded;
  };

  window.openPrizeFromHash = function () {
    var fragment = String(location.hash || "");
    var match = /^#quest-reward=(robot|hallo|winter)\.([A-Za-z0-9_-]{1,800})$/.exec(fragment);
    var theme, token;
    if (match) { theme = match[1]; token = match[2]; }
    else if (fragment.indexOf("#robot-reward=") === 0) {
      theme = "robot";
      token = fragment.slice("#robot-reward=".length);
    } else return false;
    var payload = decodeFinalPayload(token);
    if (!payload) return false;
    if (Q !== theme) loadQ(theme);
    scannedPrizeLocation = payload.place;
    scannedPrizePhotoUrl = payload.photo;
    view = "reward";
    return true;
  };

  var baseParent = V.parent;
  V.parent = function () {
    var h = baseParent();
    var localPhoto = typeof PH[N] === "string" && PH[N].indexOf("data:image/") === 0;
    var url = validPhotoUrl(prizePhotoUrl);
    var field = '<div class="card finale-photo-setup noprint">' +
      '<h2>📷 Фотография финального тайника</h2>' +
      '<p>Снимок, добавленный выше кнопкой «Добавить фото», уже будет виден на этом телефоне после финального QR.</p>' +
      '<p><b>Чтобы снимок открылся на другом телефоне,</b> добавьте прямую HTTPS-ссылку на фото. Она будет записана в отдельный финальный QR.</p>' +
      '<input id="prizePhotoUrl" type="url" inputmode="url" maxlength="250" value="' +
      esc(url) + '" placeholder="https://example.com/photo.jpg" autocomplete="off">' +
      '<small>Нужна ссылка на саму картинку (JPG, PNG, WebP), а не на страницу просмотра. Ссылка должна открываться без входа в аккаунт.</small>' +
      (url ? '<img class="finale-setup-preview" src="' + esc(url) + '" alt="Проверка фото по ссылке" referrerpolicy="no-referrer">' : '') +
      (localPhoto && !url ? '<p class="finale-local-warning">📱 Сейчас фото доступно только на устройстве, где оно было добавлено. Для второго телефона добавьте ссылку выше.</p>' : '') +
      '</div>';
    return h.replace(
      '<button class="btn go noprint" onclick="savePrizeLocation(false)">',
      field + '<button class="btn go noprint" onclick="savePrizeLocation(false)">'
    );
  };

  window.savePrizeLocation = function (openQr) {
    var placeEl = document.getElementById("pz");
    if (placeEl) prize = String(placeEl.value || "").trim().slice(0, 90);
    var urlEl = document.getElementById("prizePhotoUrl");
    var rawUrl = urlEl ? String(urlEl.value || "").trim() : prizePhotoUrl;
    var newUrl = rawUrl ? validPhotoUrl(rawUrl) : "";
    if (rawUrl && !newUrl) {
      alert("Укажите корректную HTTPS-ссылку на фотографию длиной до 250 символов.");
      if (urlEl) urlEl.focus();
      return;
    }
    prizePhotoUrl = newUrl;
    try { localStorage.setItem(PX + "prize_photo_url", prizePhotoUrl); }
    catch (e) { alert("Не удалось сохранить ссылку на фотографию."); return; }
    save();
    if (openQr && !prize) {
      alert("Добавьте текстовую подсказку к подарку в поле выше.");
      go("parent");
      return;
    }
    go(openQr ? "finalqr" : "home");
  };

  var baseReward = V.reward;
  V.reward = function () {
    var h = baseReward();
    var photo = validPhotoUrl(scannedPrizePhotoUrl);
    // The local photo remains available on the same device, including old QR codes.
    if (!photo && typeof PH[N] === "string" && /^data:image\/(?:png|jpeg|webp);base64,/.test(PH[N])) {
      photo = PH[N];
    }
    if (!photo) return h;
    var card = '<div class="card finale-reward-photo">' +
      '<h2>📸 Смотри, вот место подарка!</h2>' +
      '<img src="' + esc(photo) + '" alt="Фотография места, где спрятан подарок" ' +
      'referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.nextElementSibling.textContent=\'Не удалось загрузить фото. Используй текстовую подсказку выше.\'">' +
      '<p>🔎 Найди это место дома!</p></div>';
    return h.replace(
      '<button class="btn go" onclick="sayPrizeClue()">',
      card + '<button class="btn go" onclick="sayPrizeClue()">'
    );
  };

  var baseFinalSheet = window.finalQrSheet;
  window.finalQrSheet = function () {
    var h = baseFinalSheet();
    var text = validPhotoUrl(prizePhotoUrl)
      ? '📷 После сканирования этого QR откроются подсказка и фотография.'
      : (PH[N] ? '📱 Локальное фото откроется на этом устройстве. Для другого телефона укажите ссылку на фото в настройках.' :
        'Если хотите показать фото тайника, добавьте его в настройках.');
    return h.replace('<div class="finalqr-seal">', '<p class="noprint finale-qr-photo-info">' + text + '</p><div class="finalqr-seal">');
  };

  var style = document.createElement("style");
  style.textContent =
    '.finale-reward-photo{margin:16px auto;padding:17px;text-align:center;border:3px solid #a9d5ab;border-radius:24px;background:linear-gradient(160deg,#f4fff0,#fff4dc);color:#243a2f}' +
    '.finale-reward-photo h2{margin:3px 0 12px;font-size:clamp(21px,5vw,28px);color:#1a4737}' +
    '.finale-reward-photo img{display:block;width:100%;max-width:560px;max-height:480px;object-fit:contain;margin:0 auto;border-radius:18px;border:5px solid white;box-shadow:0 8px 24px #17341a24;animation:finalePhotoPop .5s ease both}' +
    '.finale-reward-photo p{font-weight:800;font-size:19px;color:#285239}' +
    '.finale-photo-setup{margin:14px 0;padding:17px}' +
    '.finale-photo-setup input{width:100%;box-sizing:border-box;font-size:16px;padding:12px;min-height:48px}' +
    '.finale-photo-setup small{display:block;line-height:1.5;margin:9px 0}' +
    '.finale-setup-preview{display:block;max-width:100%;max-height:240px;object-fit:contain;margin:12px auto;border-radius:14px}' +
    '.finale-local-warning{padding:11px;border-radius:13px;background:#fff4d8;color:#563c12}' +
    '.finale-qr-photo-info{font-size:14px;color:#40576a}' +
    '@keyframes finalePhotoPop{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}' +
    '@media(prefers-reduced-motion:reduce){.finale-reward-photo img{animation:none}}';
  document.head.appendChild(style);

  // The legacy app has already executed its initial render before this file loads.
  if (openPrizeFromHash()) render();
  else render();
})();
