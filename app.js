(() => {
  const KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const DEF = {
    mosqueName: 'Prayer Times', hijriAdjustment: 0, hijriDayChangesAtMaghrib: true, hour12: true,
    names: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Luhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha', jumuah: "Jumu'ah" },
    iqamahGapMinutes: { fajr: 20, dhuhr: 15, asr: 15, maghrib: 5, isha: 15 }, jumuahIqamahGapMinutes: 30,
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
      S = { ...DEF, ...s, names: { ...DEF.names, ...s.names }, iqamahGapMinutes: { ...DEF.iqamahGapMinutes, ...s.iqamahGapMinutes }, sub: { ...DEF.sub, ...s.sub } };
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
  function events(d) {
    const t = dayTimes(d); if (!t) return [];
    return ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map(k => {
      const jum = k === 'dhuhr' && d.getDay() === 5;
      const gap = jum ? S.jumuahIqamahGapMinutes : (S.iqamahGapMinutes[k] || 0);
      return { key: k, sub: jum ? 'jumuah' : k, name: jum ? S.names.jumuah : S.names[k], adhan: t[k], iqamah: new Date(t[k].getTime() + gap * 60000) };
    });
  }
  const fmt = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: S.hour12 });

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
      const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); s %= 60;
      $('hero').className = st.mode === 'iqamah' ? 'iqamah' : '';
      $('label').textContent = st.mode === 'iqamah' ? `Iqamah of ${st.e.name} in` : `Next prayer: ${st.e.name}`;
      $('count').innerHTML = `${h}<small>h</small>${p2(m)}<small>m</small>${p2(s)}<small>s</small>`;
      $('sub').textContent = st.mode === 'iqamah' ? `Adhan was at ${fmt(st.e.adhan)}` : `Adhan ${fmt(st.e.adhan)} · Iqamah ${fmt(st.e.iqamah)}`;
    }

    const t = dayTimes(today);
    const rows = [{ key: 'fajr' }, { key: 'sunrise' }, ...ev.slice(1)].map(r => {
      if (r.key === 'sunrise') return { key: 'sunrise', sub: 'sunrise', name: S.names.sunrise, adhan: t.sunrise, done: now >= t.sunrise };
      const e = ev.find(x => x.key === r.key); return { ...e, done: now >= e.iqamah };
    });
    $('list').innerHTML = rows.map(r => {
      const cur = st && st.e.key === r.key && st.e.adhan.getDate() === today.getDate();
      const cls = ['row', r.key === 'sunrise' ? 'sun' : '', r.done ? 'done' : '', cur ? 'now' : '', cur && st.mode === 'iqamah' ? 'iq' : ''].join(' ');
      const words = (S.sub[r.sub] || []).map((w, i) => `<span lang="${['ar', 'si', 'ta'][i]}">${w}</span>`).join('<i>|</i>');
      return `<div class="${cls} main"><b>${r.name}</b><span>${fmt(r.adhan)}</span><span>${r.iqamah ? fmt(r.iqamah) : ''}</span></div>` +
        `<div class="${cls} subrow"><div class="sub">${words}</div></div>`;
    }).join('');
  }

  load().then(() => { tick(); setInterval(tick, 1000); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
})();
