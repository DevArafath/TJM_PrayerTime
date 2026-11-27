(() => {
  const KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const DEF = {
    mosqueName: 'Thaqwa Jummah Masjid', hijriAdjustment: 0, hijriDayChangesAtMaghrib: true, hour12: true,
    names: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Luhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha', jumuah: "Jumu'ah", tarawih: 'Tarawih Prayer' },
    iqamahGapMinutes: { fajr: 20, dhuhr: 15, asr: 15, maghrib: 5, isha: 15 }, jumuahIqamahGapMinutes: 30,
    // mode: "auto" (Islamic month 9), "on" (always Ramadan) or "off"
    install: { enabled: true, hideDaysAfterDismiss: 7 },   // "Install app" banner
    ramadan: { mode: 'auto', iqamahGapMinutes: {}, ishaIqamahTime: '8:00 PM', tarawihEnabled: true, tarawihTime: '8:15 PM' },
    // Eid prayer shown under Sunrise. mode: "auto" (1 Shawwal & 10 Dhul Hijjah), "on" or "off"
    eid: { mode: 'auto', time: '6:30 AM', name: 'Eid Prayer' },
    // [Arabic, Sinhala, Tamil] shown under each prayer name (can be overridden in settings.json -> "sub")
    sub: {
      fajr: ['الفجر', 'ෆජ්ර්', 'ஃபஜ்ர்'], sunrise: ['الشروق', 'හිරු උදාව', 'சூரிய உதயம்'],
      dhuhr: ['الظهر', 'ලුහර්', 'லுஹர்'], asr: ['العصر', 'අස්ර්', 'அஸர்'],
      maghrib: ['المغرب', 'මග්රිබ්', 'மஃரிப்'], isha: ['العشاء', 'ඉෂා', 'இஷா'], jumuah: ['الجمعة', 'ජුම්ආ', 'ஜும்ஆ']
    }
  };
  let S = DEF, T = {}, lastMin = -1;
  const $ = id => document.getElementById(id), p2 = n => String(n).padStart(2, '0');

  async function get(u) { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw 0; return r.json(); }
  async function load() {
    try {
      const s = await get('data/settings.json');
      S = { ...DEF, ...s, names: { ...DEF.names, ...s.names }, iqamahGapMinutes: { ...DEF.iqamahGapMinutes, ...s.iqamahGapMinutes }, sub: { ...DEF.sub, ...s.sub }, ramadan: { ...DEF.ramadan, ...s.ramadan }, eid: { ...DEF.eid, ...s.eid }, install: { ...DEF.install, ...s.install } };
    } catch (e) {}
    try { T = (await get('data/prayer-times.json')).times || {}; } catch (e) {}
    $('mosque').textContent = S.mosqueName;
    document.title = S.mosqueName;
  }

  // accepts "4:57 AM" or "16:57"
  function parse(str, d) {
    const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(str || ''); if (!m) return null;
    let h = +m[1]; const ap = m[3] && m[3].toUpperCase();
    if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, +m[2]);
  }
  const key = d => p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  function dayTimes(d) {
    let r = T[key(d)] || (key(d) === '02-29' ? T['02-28'] : null); if (!r) return null;
    const o = {}; for (const k of KEYS) { o[k] = parse(r[k], d); if (!o[k]) return null; } return o;
  }
  // Hijri month/day of civil day `d`. evening=true -> after Maghrib (the Islamic day has already rolled over)
  const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { month: 'numeric', day: 'numeric' });
  function hijri(d, evening) {
    const h = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (+S.hijriAdjustment || 0) + (evening && S.hijriDayChangesAtMaghrib ? 1 : 0));
    try {
      const p = hijriFmt.formatToParts(h);
      return { m: +p.find(x => x.type === 'month').value, d: +p.find(x => x.type === 'day').value };
    } catch (e) { return { m: 0, d: 0 }; }
  }
  const modeOf = v => v === true ? 'on' : v === false ? 'off' : String(v || 'auto').toLowerCase();
  function isRamadan(d, evening) {
    const m = modeOf(S.ramadan.mode);
    return m === 'on' ? true : m === 'off' ? false : hijri(d, evening).m === 9;
  }
  // Eid prayer times for the morning of civil day `d`: [{ label, at: Date }] or null
  function eidTimes(d) {
    const m = modeOf(S.eid.mode);
    if (m === 'off') return null;
    if (m === 'auto') { const h = hijri(d, false); if (!((h.m === 10 && h.d === 1) || (h.m === 12 && h.d === 10))) return null; }
    const list = Array.isArray(S.eid.times) && S.eid.times.length ? S.eid.times : (S.eid.time ? [{ label: '', time: S.eid.time }] : []);
    const out = list.map(x => ({ label: x.label || '', at: parse(x.time, d) })).filter(x => x.at);
    return out.length ? out : null;
  }
  function events(d) {
    const t = dayTimes(d); if (!t) return [];
    return ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map(k => {
      const jum = k === 'dhuhr' && d.getDay() === 5;
      let gap = jum ? S.jumuahIqamahGapMinutes : (S.iqamahGapMinutes[k] || 0);
      const rg = (S.ramadan.iqamahGapMinutes || {})[k];                       // Ramadan-only gap (e.g. fajr, maghrib)
      if (!jum && rg != null && isRamadan(d, k === 'maghrib' || k === 'isha')) gap = +rg;
      const e = { key: k, sub: jum ? 'jumuah' : k, name: jum ? S.names.jumuah : S.names[k], adhan: t[k], iqamah: new Date(t[k].getTime() + gap * 60000) };
      if (k === 'isha' && isRamadan(d, true)) {
        const R = S.ramadan, fixed = R.ishaIqamahTime && parse(R.ishaIqamahTime, d);
        if (fixed && fixed > t[k]) e.iqamah = fixed;                       // fixed Ramadan iqamah time
        if (R.tarawihEnabled && R.tarawihTime) e.tarawih = parse(R.tarawihTime, d);
      }
      return e;
    });
  }
  const fmt = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: S.hour12 });
  // big time with a small AM/PM (12-hour) or plain HH:MM (24-hour)
  const fmtHTML = d => {
    if (!S.hour12) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const [t, ap] = fmt(d).split(/\s+/); return `${t}<span class="ap">${ap || ''}</span>`;
  };

  function renderDates(now) {
    $('gdate').textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const h = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (+S.hijriAdjustment || 0));
    const t = dayTimes(now);
    if (S.hijriDayChangesAtMaghrib && t && now >= t.maghrib) h.setDate(h.getDate() + 1);
    try {
      $('hdate').textContent = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(h);
      $('hdateAr').textContent = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(h);
    } catch (e) {}
  }

  function tick() {
    const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tom = new Date(today); tom.setDate(tom.getDate() + 1);
    $('clock').textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: S.hour12 });
    if (now.getMinutes() !== lastMin) { lastMin = now.getMinutes(); renderDates(now); }

    const ev = events(today);
    if (!ev.length) { $('msg').textContent = 'No prayer times found for today. Check data/prayer-times.json.'; return; }
    $('msg').textContent = '';

    let st = null;
    for (const e of [...ev, ...events(tom)]) {
      if (now < e.adhan) { st = { mode: 'adhan', e, target: e.adhan }; break; }
      if (now < e.iqamah) { st = { mode: 'iqamah', e, target: e.iqamah }; break; }
    }
    if (st) {
      let s = Math.max(0, Math.ceil((st.target - now) / 1000));
      const total = s;
      const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); s %= 60;
      $('hero').className = st.mode === 'iqamah' ? 'iqamah' : '';
      // colour: gold in the last 5 min before adhan; green during iqamah wait; red in the last minute
      $('count').className = st.mode === 'iqamah' ? (total <= 60 ? 'red' : 'green') : (total <= 300 ? 'amber' : '');
      $('label').textContent = st.mode === 'iqamah' ? `Iqamah of ${st.e.name} in` : `Next prayer: ${st.e.name}`;
      $('count').innerHTML = `${h}<small>h</small>${p2(m)}<small>m</small>${p2(s)}<small>s</small>`;
      $('sub').textContent = st.mode === 'iqamah' ? `Adhan was at ${fmt(st.e.adhan)}` : `Adhan ${fmt(st.e.adhan)} · Iqamah ${fmt(st.e.iqamah)}`;
    }

    const t = dayTimes(today);
    const rows = [{ key: 'fajr' }, { key: 'sunrise' }, ...ev.slice(1)].map(r => {
      if (r.key === 'sunrise') {
        const eid = eidTimes(today);
        const last = eid ? new Date(Math.max(...eid.map(x => x.at))) : t.sunrise;   // stays un-ticked until the last Eid prayer
        return { key: 'sunrise', sub: 'sunrise', name: S.names.sunrise, adhan: t.sunrise, eid, done: now >= last };
      }
      const e = ev.find(x => x.key === r.key); return { ...e, done: now >= e.iqamah };
    });
    $('list').innerHTML = rows.map(r => {
      const cur = st && st.e.key === r.key && st.e.adhan.getDate() === today.getDate();
      const cls = ['card', r.key === 'sunrise' ? 'sun' : '', r.done ? 'done' : '', cur ? 'now' : '', cur && st.mode === 'iqamah' ? 'iq' : ''].join(' ');
      const words = (S.sub[r.sub] || []).map((w, i) => `<span lang="${['ar', 'si', 'ta'][i]}">${w}</span>`).join('<i>|</i>');
      return `<div class="${cls}"><b>${r.name}</b>` +
        `<div class="t t1"><small>${r.key === 'sunrise' ? 'Time' : 'Adhan / Athan'}</small><strong>${fmtHTML(r.adhan)}</strong></div>` +
        (r.iqamah ? `<div class="t tq"><small>Iqamah</small><strong>${fmtHTML(r.iqamah)}</strong></div>` : '') +
        `<div class="sub">${words}</div>` +
        (r.tarawih ? `<div class="tar">${S.names.tarawih} · ${fmt(r.tarawih)}</div>` : '') +
        (r.eid ? `<div class="tar">${S.eid.name} · ${r.eid.map(x => (x.label ? x.label + ' ' : '') + fmt(x.at)).join(' · ')}</div>` : '') + `</div>`;
    }).join('');
  }

  // ---- "Install app" banner ----
  // Android/desktop Chrome & Edge: uses the browser's install prompt. iPhone/iPad: shows "Add to Home Screen" steps.
  let deferred = null;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const DISMISS_KEY = 'installDismissedAt';
  function dismissedRecently() {
    try { const t = +localStorage.getItem(DISMISS_KEY); return !!t && Date.now() - t < S.install.hideDaysAfterDismiss * 864e5; } catch (e) { return false; }
  }
  function hideBanner() { const b = $('install'); if (b) b.remove(); }
  function showBanner() {
    if (!S.install.enabled || isStandalone() || dismissedRecently() || $('install')) return;
    if (!deferred && !isIOS) return;
    const b = document.createElement('div');
    b.id = 'install'; b.setAttribute('role', 'dialog');
    b.innerHTML = '<div class="i-txt"><strong>Install this app</strong><span>' +
      (deferred ? 'Add it to your home screen for quick access, even offline.' : 'Tap <b>Share</b>, then <b>Add to Home Screen</b>.') + '</span></div>' +
      (deferred ? '<button id="iBtn">Install App</button>' : '') + '<button id="iX" aria-label="Close">\u2715</button>';
    document.body.appendChild(b);
    $('iX').onclick = () => { try { localStorage.setItem(DISMISS_KEY, Date.now()); } catch (e) {} hideBanner(); };
    if (deferred) $('iBtn').onclick = async () => {
      deferred.prompt();
      try { await deferred.userChoice; } catch (e) {}
      deferred = null; hideBanner();
    };
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; showBanner(); });
  window.addEventListener('appinstalled', () => { deferred = null; hideBanner(); });

  load().then(() => { tick(); setInterval(tick, 1000); S.install.enabled ? showBanner() : hideBanner(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
})();
