/* Greenwich Works — the portal.  Views and routing. */
(function () {
  'use strict';
  const CFG = window.GW_CONFIG, L = window.GW_LOGOS;
  let D = null;                       // whatever bootstrap() last returned

  /* ---------------------------------------------------------- helpers */
  function el(tag, attrs, ...kids) {
    const parts = tag.split(/([#.])/); const n = document.createElement(parts[0] || 'div');
    for (let i = 1; i < parts.length; i += 2) {
      if (!parts[i + 1]) continue;
      parts[i] === '#' ? (n.id = parts[i + 1]) : n.classList.add(parts[i + 1]);
    }
    if (attrs && attrs.nodeType) { kids.unshift(attrs); attrs = null; }
    if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') { String(v).split(/\s+/).filter(Boolean).forEach(c => n.classList.add(c)); }
        else if (k === 'html') n.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : v);
      }
    } else if (attrs != null) kids.unshift(attrs);
    for (const k of kids.flat(9)) {
      if (k == null || k === false) continue;
      n.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return n;
  }
  const $ = s => document.querySelector(s);
  const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
  const slug = s => String(s).toLowerCase().replace(/·/g, ' ').replace(/&/g, ' ')
      .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  /* A date in this programme is a Karachi calendar day, 'YYYY-MM-DD'.  All the
     arithmetic on it is done in UTC so the reader's own timezone can never move
     a day; nothing here builds a local midnight and prints it as ISO, which in
     Karachi (UTC+5) is the evening before. */
  const dayDate = s => new Date(s + 'T00:00:00Z');
  const addDays = (s, n) => new Date(dayDate(s).getTime() + n * 864e5).toISOString().slice(0, 10);
  const pretty = s => { const d = dayDate(s); return DAY[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
  const shortDay = s => { const d = dayDate(s); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
  /* Deadlines are Karachi dates and mean the end of that day in Karachi. The
     old version measured from the reader's own clock, so a student on a phone
     set to another timezone — or simply travelling — saw a different number of
     days left from the one the convener saw. */
  const KHI = 'Asia/Karachi';
  const today = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: KHI }).format(new Date());
    } catch (e) { return new Date().toISOString().slice(0, 10); }
  };
  const daysTo = s => Math.round(
    (new Date(s + 'T00:00:00Z') - new Date(today() + 'T00:00:00Z')) / 864e5);
  const esc = s => String(s == null ? '' : s);
  /* A moment, shown as the clock in Karachi says it — whatever the phone thinks. */
  const stamp = (ts, opts) => {
    try {
      return new Date(ts).toLocaleString('en-GB',
        Object.assign({ timeZone: KHI }, opts || { dateStyle: 'medium', timeStyle: 'short' }));
    } catch (e) { return String(ts || ''); }
  };
  /* Some students have no name on the Registrar's file yet; the register then
     holds their roll number in the name column.  Say so once, never print the
     roll number twice, and never print "undefined". */
  const NO_NAME = 'Name not on file yet';
  const hasName = (name, roll) => !!name && String(name).trim() !== '' &&
    String(name).replace(/\s+/g, '') !== String(roll || '').replace(/\s+/g, '');
  const shown = (name, roll) => hasName(name, roll) ? String(name) : NO_NAME;
  let pendingToast = null;
  const paintToast = () => {
    if (!pendingToast) return;
    const box = $('#flash'); if (!box) return;
    const { msg, kind } = pendingToast;
    clear(box).append(el('div.msg.' + (kind || 'ok'), msg));
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (kind !== 'err') setTimeout(() => { if (pendingToast && pendingToast.msg === msg) { pendingToast = null; clear(box); } }, 6000);
  };
  const toast = (msg, kind) => { pendingToast = { msg, kind }; paintToast(); };
  async function guard(fn) {
    try { await fn(); } catch (e) { console.error('[gw]', e); toast(e.friendly ? e.message : (e.message || 'Something went wrong.'), 'err'); }
  }
  function modal(title, body, actions, cls) {
    const bg = el('div.modal-bg');
    /* a dialog you cannot leave with the keyboard is a trap, and the focus has
       to go back where it came from or the reader loses their place */
    const cameFrom = document.activeElement;
    let onKey = null;
    const close = () => {
      bg.remove();
      if (onKey) document.removeEventListener('keydown', onKey);
      if (cameFrom && cameFrom.focus) cameFrom.focus();
    };
    bg.append(el('div.modal' + (cls ? '.' + cls : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('div.h', el('h3', title), el('button', { onclick: close, 'aria-label': 'Close' }, '\u00d7')),
      el('div.b', body),
      actions ? el('div.f', ...actions(close)) : null));
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    onKey = e => {
      if (!bg.isConnected) { document.removeEventListener('keydown', onKey); return; }
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = bg.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),'
        + 'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.append(bg);
    const firstField = bg.querySelector('input,select,textarea,button');
    if (firstField) firstField.focus();
    return close;
  }

  /* ------------------------------------------------------- the explainer */
  /* Register AV.5: the first time anybody meets a term or a step they will not
     know, the explanation is one hover, one focus or one tap away.  ONE small
     component, used everywhere it is needed and nowhere else.  On a laptop the
     bubble opens on hover or keyboard focus (after 300 ms, stays while the
     pointer is over the trigger or the bubble, Esc closes).  Most students are
     on phones, where there is no hover: every explained thing also carries a
     small "?" (a 44 px tap target) that opens the same text as a popover; a tap
     outside closes it.  Content is app/explain.js; nothing here invents a fact. */
  const EXPLAIN = () => window.GW_EXPLAIN || {};
  let xpOpen = null;                 // { bubble, trigger, tap }
  let xpTimer = null, xpId = 0;
  function xpClose() {
    if (!xpOpen) return;
    const o = xpOpen; xpOpen = null;
    if (o.bubble.isConnected) o.bubble.remove();
    if (o.btn) o.btn.setAttribute('aria-expanded', 'false');
    if (o.tap && o.btn && o.btn.isConnected && o.restore) o.btn.focus();
  }
  function xpPlace(bubble, at) {
    const r = at.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    bubble.style.left = '0px'; bubble.style.top = '0px';
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    let x = Math.max(8, Math.min(vw - bw - 8, r.left));
    let y = r.bottom + 6;
    if (y + bh > vh - 8 && r.top - bh - 6 > 8) y = r.top - bh - 6;
    y = Math.max(8, Math.min(vh - bh - 8, y));
    bubble.style.left = x + 'px'; bubble.style.top = y + 'px';
  }
  function xpShow(key, trigger, btn, tap) {
    const e = EXPLAIN()[key]; if (!e) return;
    if (xpOpen && xpOpen.trigger === trigger && xpOpen.tap === tap) return;
    xpClose();
    const id = 'xp-' + (++xpId);
    const bubble = el('div.xp-b' + (tap ? '.tap' : ''), { id, role: tap ? 'dialog' : 'tooltip', 'aria-label': e.t },
      el('b', e.t), e.b,
      tap ? el('button.xp-x', { type: 'button', 'aria-label': 'Close', onclick: xpClose }, '\u00d7') : null);
    document.body.append(bubble);
    xpPlace(bubble, btn && tap ? btn : trigger);
    if (!tap && trigger) trigger.setAttribute('aria-describedby', id);
    if (btn) btn.setAttribute('aria-expanded', tap ? 'true' : 'false');
    xpOpen = { bubble, trigger, btn, tap, restore: false };
    if (!tap) {
      bubble.addEventListener('mouseleave', () => { if (xpOpen && !xpOpen.tap && !trigger.matches(':hover')) xpClose(); });
    }
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && xpOpen) { xpOpen.restore = true; xpClose(); } });
  document.addEventListener('pointerdown', e => {
    if (xpOpen && !xpOpen.bubble.contains(e.target) && !(xpOpen.btn && xpOpen.btn.contains(e.target))) xpClose();
  }, true);
  window.addEventListener('scroll', () => { if (xpOpen && xpOpen.tap) xpPlace(xpOpen.bubble, xpOpen.btn || xpOpen.trigger); }, true);
  window.addEventListener('hashchange', xpClose);
  /* X('ethics', 'Ethics') → the label, dotted, with its "?" */
  function X(key, label, opts) {
    const e = EXPLAIN()[key];
    if (!e) return el('span', label == null ? key : label);
    const o = opts || {};
    const t = el('span.xp-t', { tabindex: '0' }, label == null ? e.t : label);
    const btn = el('button.xp-q', { type: 'button', 'aria-expanded': 'false', 'aria-label': 'What is ' + e.t + '?' }, '?');
    const canHover = window.matchMedia && window.matchMedia('(hover:hover)').matches;
    let over = false;
    const arm = () => { clearTimeout(xpTimer); xpTimer = setTimeout(() => { if (over) xpShow(key, t, btn, false); }, 300); };
    const disarm = () => { over = false; clearTimeout(xpTimer);
      setTimeout(() => { if (xpOpen && xpOpen.trigger === t && !xpOpen.tap && !xpOpen.bubble.matches(':hover') && !t.matches(':hover')) xpClose(); }, 120); };
    if (canHover) { t.addEventListener('mouseenter', () => { over = true; arm(); }); t.addEventListener('mouseleave', disarm); }
    t.addEventListener('focus', () => { over = true; arm(); });
    t.addEventListener('blur', disarm);
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation();
      if (xpOpen && xpOpen.btn === btn && xpOpen.tap) { xpOpen.restore = true; xpClose(); } else xpShow(key, t, btn, true); });
    return el('span.xp' + (o.cls ? '.' + o.cls : ''), t, btn);
  }
  const FIRST = 'gw.explain.seen';
  function firstTimeLine() {
    let seen = false; try { seen = !!localStorage.getItem(FIRST); } catch (e) { seen = false; }
    if (seen) return null;
    const box = el('div.xp-first', { role: 'note' },
      el('span', el('b', 'First time here? '), 'Hover over, or tap the ', el('b', '?'), ' beside, anything you do not know.'),
      el('button.btn.ghost.sm', { type: 'button', onclick: () => { try { localStorage.setItem(FIRST, '1'); } catch (e) {} box.remove(); } }, 'Got it'));
    return box;
  }

  /* ====================================================== the helper (AX) */
  /* "A bot on the portal for everyone, but it replies to them accordingly —
     a helper, it tells the people what to do." (the Chair, 21 September.)

     It is not a chat toy.  It opens ALREADY SHOWING the answer to "what do I
     do now?", personal to this reader, before they type anything.  Three
     parts, in this order: Next for you · Ask · Still stuck?

     ONE call.  helper_state() in db/19_helper.sql does all the reading and
     all the ordering in the database; nothing below computes a rule.  The
     answer set is app/helper_answers.js, and a question about a single term
     is answered out of app/explain.js rather than written twice.

     It never files, books or submits anything.  Every button navigates.
     Named RASHID BHAI by the Chair on 22 September 2026 (register BB.2); the code keeps the word helper. */

  const HANSWERS = () => window.GW_HELPER_ANSWERS || [];
  const HTERMS = () => window.GW_HELPER_TERMS || [];
  let helperCache = null;              /* one state per bootstrap, like dash() */
  let helperOpenNow = false;

  /* normalise, strip punctuation — "When's my Folio due??" → "when is my folio due" */
  const H_STOP = new Set(('a an the is are was were be been am do does did i me my mine we us our ours you your '
    + 'yours it its they them their he she his her of to in into on at for from by with about as and or but if '
    + 'then than that this these those there here what when where who whom whose how why which can could should '
    + 'would will shall may might must not no yes please help need want get got have has had s t').split(' '));
  function hnorm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[‘’ʼ']/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\bcant\b/g, 'cannot').replace(/\bwhens\b/g, 'when is').replace(/\bwhats\b/g, 'what is')
      .replace(/\s+/g, ' ').trim();
  }
  const hwords = s => hnorm(s).split(' ').filter(w => w.length > 1 && !H_STOP.has(w));

  /* the index this reader may see: their role's answers, plus the terms of
     explain.js.  Built once per open, so a long answer set costs nothing. */
  function helperIndex(roleArg) {
    const role = roleArg || (D && D.profile && D.profile.role) || 'student';
    const rows = [];
    const bagOf = (askList, body) => {
      const bag = Object.create(null);
      askList.forEach(a => hwords(a).forEach(w => { bag[w] = Math.max(bag[w] || 0, 3); }));
      hwords(body || '').forEach(w => { if (!bag[w]) bag[w] = 1; });
      return bag;
    };
    HANSWERS().forEach(a => {
      if (a.role && a.role.indexOf(role) < 0) return;
      rows.push({ kind: 'answer', id: a.id, title: a.ask[0], row: a,
                  phrases: a.ask.map(hnorm).filter(p => p.split(' ').length > 1),
                  bag: bagOf(a.ask, a.answer) });
    });
    HTERMS().forEach(t => {
      const e = EXPLAIN()[t.key];
      if (!e) return;
      if (t.role && t.role.indexOf(role) < 0) return;
      rows.push({ kind: 'term', id: 'term:' + t.key, title: e.t, row: { key: t.key, e: e },
                  phrases: t.ask.concat([e.t]).map(hnorm).filter(p => p.split(' ').length > 1),
                  bag: bagOf(t.ask.concat([e.t]), e.b) });
    });
    return rows;
  }
  /* score on the phrasings plus keyword overlap.  A whole phrasing found
     inside the question is worth far more than a word that happens to match. */
  function helperMatch(q, index) {
    const nq = ' ' + hnorm(q) + ' ', qw = hwords(q);
    if (!qw.length) return [];
    const seen = Object.create(null);
    qw.forEach(w => { seen[w] = true; });
    const out = index.map(c => {
      let s = 0;
      c.phrases.forEach(p => { if (p && nq.indexOf(' ' + p + ' ') >= 0) s += 6 + p.split(' ').length; });
      Object.keys(seen).forEach(w => { s += (c.bag[w] || 0); });
      /* a question of three words that matches three of three beats one that
         matches three of nine, so weigh by how much of the question landed */
      const hit = Object.keys(seen).filter(w => c.bag[w]).length;
      s += 2 * Math.round((10 * hit) / qw.length) / 10;
      return { c: c, s: s };
    }).filter(x => x.s >= 4).sort((a, b) => b.s - a.s);
    return out;
  }

  /* one answer, drawn the same way whether it came from helper_answers.js or
     from explain.js — the definitions are never written out a second time */
  function helperAnswerCard(c, onGo) {
    if (c.kind === 'term') {
      return el('div.hlp-a',
        el('h4', c.row.e.t),
        el('p', c.row.e.b),
        el('div.src', 'Explained in full wherever this term appears — hover it, or tap its ?'));
    }
    const a = c.row, tabs = helperTabs();
    return el('div.hlp-a',
      el('h4', a.ask[0].charAt(0).toUpperCase() + a.ask[0].slice(1)),
      el('p', a.answer),
      el('div.hlp-go',
        a.goes_to && tabs.indexOf(a.goes_to.replace('#', '')) >= 0
          ? el('button.btn.sm', { type: 'button', onclick: () => { onGo(); location.hash = a.goes_to; render(); } },
              'Go to ' + (TABNAME[a.goes_to.replace('#', '')] || a.goes_to))
          : null,
        el('span.src', 'Register ' + a.source)));
  }
  function helperTabs() {
    const p = (D && D.profile) || {};
    const list = p.role === 'student' ? STUDENT : p.role === 'teacher' ? TEACHER
               : p.role === 'office' ? OFFICE : STAFF;
    return list.map(t => t.id);
  }

  /* "Next for you" — one to three things, from what the reader has actually
     filed.  The database ordered them; this only draws them. */
  function helperNext(S, onGo) {
    const rows = (S && S.next) || [];
    if (!rows.length) {
      return el('div.hlp-empty',
        el('b', 'Nothing is due.'),
        el('span', S && S.outside
          ? 'Your courses are assessed on the University’s ordinary scheme. There is nothing for you to hand in here.'
          : 'Nothing you owe is outstanding today. Rashid Bhai does not invent a task to fill the space — check back after the next session.'));
    }
    const tabs = helperTabs();
    return el('div.hlp-next', ...rows.map((r, i) => {
      const d = r.days == null ? null : +r.days;
      const cls = d == null ? '' : d < 0 ? '.over' : d <= 14 ? '.now' : '';
      return el('div.hlp-row' + cls,
        el('div.n', String(i + 1)),
        el('div.t',
          /* the sentence is plain; the term it turns on carries the explainer,
             so the "?" sits at the end of a line of prose rather than dangling
             under a wrapped heading */
          el('b', r.what),
          el('span', r.why),
          r.key && EXPLAIN()[r.key] ? el('div.xpline', X(r.key)) : null,
          r.on ? el('i', d < 0 ? Math.abs(d) + ' days past · ' + pretty(r.on)
                               : d === 0 ? 'today · ' + pretty(r.on)
                               : d + ' days · ' + pretty(r.on)) : null),
        r.go && tabs.indexOf(String(r.go).replace('#', '')) >= 0
          ? el('button.btn.ghost.sm', { type: 'button',
              onclick: () => { onGo(); location.hash = r.go; render(); } },
              TABNAME[String(r.go).replace('#', '')] || 'Open')
          : null);
    }));
  }

  function helperPerson(S) {
    const p = (S && S.person) || {};
    /* A Build Block is held by one to five conveners and the portal records
       them by BLOCK, not by team, so where there are several it says so rather
       than naming the wrong one.  A student's own convener is on their card. */
    const names = String(p.name || '').split(/\s*·\s*/).filter(Boolean);
    const line = names.length > 1
      ? 'Your Build Block, ' + (p.where || '') + ', is held by ' + names.slice(0, -1).join(', ')
          + ' and ' + names[names.length - 1] + '. Your own convener is the one named on your card and on the block brief.'
      : names.length === 1
        ? 'Ask ' + names[0] + (p.where ? ' — ' + p.where : '') + '.'
        : 'Ask ' + (p.who || 'your convener') + (p.where ? ' — ' + p.where : '') + '.';
    return el('div.hlp-person',
      el('b', 'Still stuck?'),
      el('p', line),
      p.say ? el('div.say', el('i', 'Say this:'), el('span', '“' + p.say + '”')) : null,
      el('p.foot', 'Or the front desk: ' + CFG.SUPPORT + '. Rashid Bhai never files, books or submits anything for you — its buttons only take you to the screen.'));
  }

  function helperPanel() {
    if (helperOpenNow) return;
    helperOpenNow = true;
    const body = el('div.hlp', el('div.hlp-load', 'Reading your own state…'));
    let close = null;
    close = modal('Rashid Bhai', body, null, 'wide');
    const shut = () => { helperOpenNow = false; if (close) close(); };
    /* the close button and Esc come from modal(); this only clears the flag */
    const bg = body.closest('.modal-bg');
    if (bg) {
      const obs = new MutationObserver(() => { if (!bg.isConnected) { helperOpenNow = false; obs.disconnect(); } });
      obs.observe(document.body, { childList: true });
    }

    const draw = S => {
      const index = helperIndex();
      const results = el('div.hlp-res');
      const EG = { student: 'when is my Folio due', teacher: 'what do I enter',
                   convener: 'how do I approve a choice', office: 'open the fieldwork gate' };
      const box = el('input', { type: 'text', 'aria-label': 'Ask Rashid Bhai a question',
        placeholder: 'Ask a question — "' + (EG[(D.profile || {}).role] || EG.student) + '"',
        maxlength: '200' });
      const ask = () => {
        const q = box.value.trim();
        clear(results);
        if (!q) return;
        const hits = helperMatch(q, index);
        if (!hits.length) {
          const none = el('div.hlp-none',
            el('b', 'It does not know that one.'),
            el('p', 'Rashid Bhai answers from the rules of the programme and from what you have filed. '
              + 'That question is outside them, so rather than guess it hands you to a person — see “Still stuck?” below.'),
            el('p.foot', 'Try fewer words, or the name of the thing: “lens note”, “field plan”, “late”.'));
          results.append(none);
          /* the AI half (register AX.1, AX.4).  Off is how it ships: the
             button only appears once the Chair turns the setting on, and even
             then the question goes to the Edge Function, never to the model
             from here, and the answer is shown under a clear line. */
          if (S && S.ai) {
            const go2 = el('button.btn.ghost.sm', { type: 'button' }, 'Ask the language model anyway');
            const out = el('div');
            go2.addEventListener('click', () => guard(async () => {
              go2.disabled = true; go2.textContent = 'Asking…';
              try {
                const r = await API.helperAsk(q);
                clear(out).append(el('div.hlp-ai',
                  el('b', 'Not an official answer — check with your convener.'),
                  el('p', r.answer),
                  el('div.src', typeof r.left === 'number' ? r.left + ' more today' : '')));
                go2.remove();
              } catch (e) {
                clear(out).append(el('div.msg.err', e.message || 'It could not answer that one.'));
                go2.disabled = false; go2.textContent = 'Try again';
              }
            }));
            none.append(el('div', { style: 'margin-top:10px' }, go2), out);
          }
          return;
        }
        results.append(helperAnswerCard(hits[0].c, shut));
        const more = hits.slice(1, 4);
        if (more.length) results.append(el('div.hlp-more',
          el('i', 'Or did you mean'),
          ...more.map(h => el('button.lnk', { type: 'button',
            onclick: () => { box.value = h.c.title; ask(); box.focus(); } }, h.c.title))));
        try { results.scrollIntoView({ block: 'nearest' }); } catch (e) {}
      };
      box.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });

      clear(body).append(
        el('div.hlp-s',
          el('div.hlp-h', el('b', 'Next for you'),
            el('span', S && S.today ? pretty(S.today) : '')),
          helperNext(S, shut)),
        el('div.hlp-s',
          el('div.hlp-h', el('b', 'Ask')),
          el('div.hlp-ask', box, el('button.btn.sm', { type: 'button', onclick: ask }, 'Ask')),
          el('div.hint', S && S.ai
            ? 'Answered from the rules. Where the rules do not know, the question may go to a language model, and that answer is marked as not official.'
            : 'Answered from the rules of the programme and from what you have filed — nothing you type here leaves the University.'),
          results),
        el('div.hlp-s', helperPerson(S)));
      /* Focus stays on the dialog's own close button, where modal() put it.
         Focusing the question box instead scrolled "Next for you" off the top
         of a phone screen, which is the one thing the panel exists to show. */
      const sc = body.parentNode; if (sc && sc.scrollTop) sc.scrollTop = 0;
    };

    const go = helperCache ? Promise.resolve(helperCache)
      : Promise.resolve(API.helperState()).then(s => { helperCache = s; return s; });
    go.then(draw).catch(e => {
      console.error('[gw]', e);
      clear(body).append(el('div.msg.err', 'Rashid Bhai could not read your page. Reload and try again — nothing you have filed is affected.'),
        helperPerson(null));
    });
  }

  /* ---------------------------------------------------------- login */
  function loginView() {
    let tab = 'in', step = 1, pending = {};
    /* The Karachi skyline at dawn (made in Bloom on the University's brand) sits
       behind the card, and the card rises onto it.  The whole animation is CSS in
       signin.css, runs once, and is switched off entirely under
       prefers-reduced-motion.  It replaces the drawn background that used to be
       attached here: a photograph and a generated pattern fight each other. */
    const wrap = el('div.login-wrap',
      el('div.gws-stage', el('div.gws-sky'), el('div.gws-glow'), el('div.gws-veil')));
    /* The panel beside the card. Somebody who has been handed a slip and a
       URL and told nothing else can read this and know what they are about
       to sign in to, before they sign in to it. */
    function tell() {
      const g = GUIDE();
      const beats = g ? [
        ['1', 'You are in a team with one real problem in Karachi.'],
        ['2', 'The team builds something real and writes it up — the Folio.'],
        ['3', 'The courses your team shares mark that same Folio, each from its own angle.'],
        ['4', 'Everything is handed in here, and the timestamp is the deadline.']
      ] : [];
      return el('div.login-tell',
        el('div.eyebrow', g ? g.programme.term : CFG.TERM),
        el('h2', 'One piece of work, marked by every course that shares it.'),
        el('p', g ? g.programme.oneLine
                  : 'The submission portal for Greenwich Works.'),
        beats.length ? el('ul.beats', ...beats.map(b => el('li', el('b', b[0]), el('span', b[1])))) : null,
        el('div.who-for',
          'Students sign in with the roll number printed on their card. Teachers, conveners and the '
          + 'office sign in with their handle — their name in lower case with full stops, like '
          + 'ali.saeed — and the password on their sign-in sheet, and choose their own the first time. '
          + 'Once you are in, How this works explains the whole programme for your role.'),
        askBox('student'));
    }
    function draw() {
      [...wrap.children].forEach(c => { if (!c.classList.contains('gws-stage')) c.remove(); });
      wrap.append(el('div.login-split.gws-card-in', tell(), el('div.login',
        el('div.top',
          el('img.gwmark', { src: 'assets/gw-mark-256.png', alt: 'Greenwich Works' }),
          el('h1', 'Greenwich Works'),
          el('p', CFG.TERM + ' · the submission portal'),
          el('div.lock',
            el('img.crest', { src: L.crest, alt: 'Greenwich University' }),
            el('div.r'),
            el('img.word', { src: L.word, alt: '' }))),
        el('div.tabs',
          el('button', { class: tab === 'in' ? 'on' : '', onclick: () => { tab = 'in'; step = 1; draw(); } }, 'Sign in'),
          el('button', { class: tab === 'new' ? 'on' : '', onclick: () => { tab = 'new'; step = 1; draw(); } }, 'First time here')),
        el('div.body', el('div#flash'), tab === 'in' ? signInForm() : claimForm()),
        el('div.foot', CFG.SUPPORT,
           API.isDemo ? el('div', { style: 'margin-top:10px' },
             el('button.btn.ghost.sm', { onclick: () => guard(async () => { await API.signInAs('convener'); start(); }) }, 'Look at the convener view'),
             ' ',
             el('button.btn.ghost.sm', { onclick: () => guard(async () => { await API.signInAs('office'); start(); }) }, 'Office view'),
             ' ',
             el('button.btn.ghost.sm', { onclick: () => guard(async () => { await API.signInAs('teacher'); start(); }) }, 'Teacher view'),
             ' ',
             /* the commonest role was the only one with no button: a student
                had to work out the claim flow before they could be shown one */
             el('button.btn.ghost.sm', { onclick: () => guard(async () => {
               const r = API.demoRoster()[0];
               try { await API.signIn(r.roll, 'demo1234'); }
               catch (e) { await API.claim(r.roll, 'DEMO', 'demo1234'); }
               start();
             }) }, 'Student view')) : null))));
    }
    function signInForm() {
      const roll = el('input', { type: 'text', placeholder: 'BS00 12345  or  ali.saeed' });
      const pw = el('input', { type: 'password', placeholder: '••••••••' });
      const go = () => guard(async () => {
        const who = await API.signIn(roll.value, pw.value);
        /* signed in, but no profile: a claim that stopped half way */
        if (!who) throw Object.assign(new Error('This account was started but never finished. Go to '
          + '“First time here” and enter your roll number, your claim code and the same password.'),
          { friendly: true });
        start();
      });
      roll.addEventListener('keydown', e => { if (e.key === 'Enter') pw.focus(); });
      pw.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      return el('div',
        el('label.f', el('span', 'Roll number, or your staff handle'), roll),
        el('label.f', el('span', 'Password'), pw),
        el('button.btn.wide', { onclick: go }, 'Sign in'),
        /* a short notice the office sets in config.js (e.g. before student accounts open); empty = nothing shown */
        CFG.NOTICE ? el('div.hint', { style: 'margin-top:12px;padding:9px 11px;border-radius:8px;background:var(--amber-soft,#fdf1dc);color:var(--text)' },
          el('b', 'Please note. '), CFG.NOTICE) : null,
        el('div.hint', { style: 'margin-top:12px' },
          'Students: your roll number, exactly as it is printed on your card. ',
          'Staff: your handle — your name in lower case with full stops, like ',
          el('b', 'ali.saeed'), '.'),
        /* the screen used to say the front desk resets a password and then
           give the reader no way of reaching them */
        el('div.hint', { style: 'margin-top:8px' },
          el('b', 'Forgotten it? '),
          'Nobody at the University can read your password, so it is reset rather than looked up. '
          + 'Go to ' + CFG.SUPPORT + ' with your roll number, or ask your convener to send word.'),
        API.isDemo ? el('div.hint', { style: 'margin-top:8px' },
          'Demo mode. Try roll ', el('b', API.demoRoster()[0].roll),
          ' — set it up first under “First time here”, where the code is the word DEMO.') : null);
    }
    function claimForm() {
      const roll = el('input', { type: 'text', placeholder: 'BS00 12345', autocapitalize: 'characters' });
      const code = el('input', { type: 'text', placeholder: 'ABC-123', autocapitalize: 'characters' });
      const pw = el('input', { type: 'password', placeholder: 'at least 8 characters' });
      const pw2 = el('input', { type: 'password', placeholder: 'again' });
      pending.roll = pending.roll || '';
      const next = () => {
        if (!roll.value.trim() || !code.value.trim()) return toast('Both the roll number and the code, please.', 'err');
        pending = { roll: roll.value, code: code.value }; step = 2; draw();
      };
      const finish = () => guard(async () => {
        if (pw.value.length < 8) throw Object.assign(new Error('Make the password at least eight characters.'), { friendly: true });
        if (pw.value !== pw2.value) throw Object.assign(new Error('The two passwords do not match.'), { friendly: true });
        await API.claim(pending.roll, pending.code, pw.value); start();
      });
      return el('div',
        el('div.step', el('i', { class: 'on' }), el('i', { class: step === 2 ? 'on' : '' })),
        step === 1 ? el('div',
          el('div.msg.note', 'Your claim code is on the slip you were given with your student card. It is used once.'),
          el('label.f', el('span', 'Roll number'), roll),
          el('label.f', el('span', 'Claim code'), code),
          el('button.btn.wide', { onclick: next }, 'Continue'))
        : el('div',
          el('div.msg.note', el('b', pending.roll), ' — now choose a password. You will use your roll number and this password from now on.'),
          el('label.f', el('span', 'Password'), pw),
          el('label.f', el('span', 'Password again'), pw2),
          el('button.btn.wide', { onclick: finish }, 'Set it up and sign in'),
          el('button.btn.ghost.wide', { style: 'margin-top:8px', onclick: () => { step = 1; draw(); } }, 'Back')));
    }
    draw(); return wrap;
  }

  /* ------------------------------------------------- change password */
  function passwordView(forced) {
    const a = el('input', { type: 'password', placeholder: '••••••••', autocomplete: 'new-password' });
    const b = el('input', { type: 'password', placeholder: '••••••••', autocomplete: 'new-password' });
    const go = () => guard(async () => {
      const v = a.value || '';
      if (v.length < 8) throw Object.assign(new Error('Pick something at least eight characters long.'), { friendly: true });
      if (v !== b.value) throw Object.assign(new Error('The two boxes do not match.'), { friendly: true });
      /* Whether this is still the first password is checked by the database
         (password_changed(), db/12), which is the only place that knows it.
         This file is public, so the first password is never written in it. */
      await API.changePassword(v);
      toast('Password changed. That is the only one that works now.');
      location.hash = '';
      await refresh();
    });
    a.addEventListener('keydown', e => { if (e.key === 'Enter') b.focus(); });
    b.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    return el('div.wrap',
      el('div.card', { style: 'max-width:520px;margin:0 auto' },
        el('h2', forced ? 'Choose your password' : 'Change your password'),
        el('p.sub', forced
          ? 'You signed in with the password on your sign-in sheet. It was printed, so it is not yours. '
            + 'Choose your own now — nothing else in the portal opens until you do.'
          : 'Pick a new one. You will be asked for it the next time you sign in.'),
        el('div#flash'),
        el('label.f', el('span', 'New password'), a),
        el('label.f', el('span', 'Type it again'), b),
        el('button.btn.wide', { onclick: go }, forced ? 'Set my password' : 'Change it'),
        el('div.hint', { style: 'margin-top:12px' },
          'Eight characters or more. Nobody at the University can read it, so if you lose it the front desk resets it rather than looks it up.')));
  }

  /* ---------------------------------------------------------- chrome */
  /* ---------------------------------------------------- the shell (22 Sep 2026, register BD) */
  /* On a phone the sections live in a bar at the bottom of the screen, at thumb height: the
     first four, then More, which holds the rest, Password and Sign out.  On a laptop the
     top tabs stay.  The postgraduate screen has no tabs and so no bar. */
  const TABSHORT = { home: 'Home', handins: 'Hand-ins', diary: 'Book', team: 'Team', guide: 'How', teams: 'Teams', gates: 'Gates',
                     marks: 'Marking', moderation: 'Moderate', office: 'Everyone', admin: 'Settings', viva: 'Viva day', trackers: 'Trackers', desk: 'Desk', review: 'Review' };
  const TABICON = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M10 20v-5.5h4V20"/>',
    handins: '<path d="M4 4h16v16H4z"/><path d="M4 14h4l2 2.5h4L16 14h4"/><path d="M12 7v5"/><path d="m9.5 9.5 2.5 2.5 2.5-2.5"/>',
    diary: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/>',
    team: '<circle cx="9" cy="8.5" r="3"/><circle cx="16.5" cy="10" r="2.4"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M15 19c0-2.2 1.6-3.8 3.8-3.8s2.7 1.6 2.7 3.8"/>',
    guide: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1 .9-1 1.7"/><path d="M12 16.6h.01"/>',
    teams: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9 9.5v10"/>',
    gates: '<path d="M4 20V6l8-3 8 3v14"/><path d="M4 12h16"/><path d="M12 12v8"/>',
    marks: '<path d="m4 14 4 4L20 6"/>',
    moderation: '<path d="M12 3v18"/><path d="M5 8h14"/><path d="m5 8-2.5 6h5L5 8Zm14 0-2.5 6h5L19 8Z"/>',
    office: '<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    admin: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    more: '<circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>',
    viva: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    trackers: '<path d="M4 6h16M4 12h10M4 18h13"/><circle cx="19" cy="18" r="1.6"/>',
    desk: '<path d="M3 10h18M5 10v9M19 10v9M9 19v-5h6v5"/><path d="M7 10V6h10v4"/>',
    review: '<path d="M12 3l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8L6.7 19.6l1-6L3.3 9.4l6-.9L12 3z"/>'
  };
  function tabIcon(id) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    g.setAttribute('viewBox', '0 0 24 24'); g.setAttribute('aria-hidden', 'true'); g.setAttribute('class', 'ico');
    g.innerHTML = TABICON[id] || TABICON.guide;
    return g;
  }
  function moreSheet(more) {
    const close = modal('More', el('div.more-list',
      ...more.map(t => el('a.btn.ghost.wide', { href: '#' + t.id, onclick: () => close() }, t.label)),
      el('a.btn.ghost.wide', { href: '#password', onclick: () => close() }, 'Password'),
      el('button.btn.ghost.wide', { type: 'button', onclick: () => guard(async () => { await API.signOut(); start(); }) }, 'Sign out')),
      null, 'sheet');
  }
  function chrome(tabs, active) {
    const p = D.profile;
    const shown = tabs.slice(0, 4), more = tabs.slice(4);
    const bar = tabs.length ? el('nav.tabbar', { 'aria-label': 'Sections' }, el('div.in',
      ...shown.map(t => el('a', { href: '#' + t.id, class: t.id === active ? 'on' : '', 'aria-current': t.id === active ? 'page' : null },
        tabIcon(t.id), el('span', TABSHORT[t.id] || t.label), t.pip ? el('span.pip', t.pip) : null)),
      el('button.more', { type: 'button', class: more.some(t => t.id === active) ? 'on' : '', onclick: () => moreSheet(more) },
        tabIcon('more'), el('span', 'More')))) : null;
    document.body.classList.toggle('has-tabbar', !!bar);
    return el('div.shell',
      el('div.topbar', el('div.in',
        /* the mark reversed for the dark header: light teal, the crane bronze (the sign-in card keeps the normal one) */
        el('img.gwmark', { src: 'assets/gw-mark-reversed-256.png', alt: '' }),
        el('span.prog', 'Greenwich Works'),
        el('div.sp'),
        el('div.who', el('b', p.name || p.roll), el('span', p.roll || p.role)),
        /* the helper, on every screen (register AX): it opens already showing
           what this reader has to do next */
        el('button.out.helpbtn', { type: 'button', 'aria-haspopup': 'dialog',
          title: 'Rashid Bhai — what do I do now?', onclick: () => helperPanel() },
          el('span.q', '?'), el('span.l', 'Rashid Bhai')),
        el('button.out', { onclick: () => { location.hash = 'password'; render(); } }, 'Password'),
        el('button.out', { onclick: () => guard(async () => { await API.signOut(); start(); }) }, 'Sign out'))),
      API.misconfigured ? el('div.banner', 'config.js says MODE is live but the Supabase URL and key are not filled in — showing the demo cohort instead.')
        : API.isDemo ? el('div.banner', 'Demo mode — a made-up cohort. Nothing here is real and nothing is saved beyond this browser.') : null,
      el('div.nav', el('div.in', ...tabs.map(t =>
        el('a', { href: '#' + t.id, class: t.id === active ? 'on' : '' }, tabIcon(t.id), el('span.lbl', t.label),
          t.pip ? el('span.pip', t.pip) : null)))),
      bar);
  }
  function footnote() {
    return el('div.footnote',
      el('img', { src: L.anniv, alt: '' }),
      el('img.crest', { src: L.crest, alt: '' }),
      el('img.word', { src: L.word, alt: 'Greenwich University' }),
      el('span', 'Greenwich University · Greenwich Works · ' + CFG.TERM),
      el('span', { style: 'margin-left:auto' }, CFG.SUPPORT));
  }

  /* ---------------------------------------------------------- handins */
  /* Demo mode hands each hand-in type over as an array, the database as a
     row.  This read it as an array only, so every student screen in live mode
     died on "t is not iterable".  typeRow() takes either. */
  const isPG = () => /^postgraduate/i.test(String((D && D.me || {}).status || ''));
  function applicable(t) {
    const applies = typeRow(t).applies;
    if (applies === 'postgraduate') return false;       // withdrawn (register AJ.3, AL): never shown
    if (isPG()) return false;                           // postgraduate programmes: no team, no project
    if (applies === 'fieldwork') return !!(D.team && D.team.fieldwork);
    if (applies === 'has_lens') return lensCourses().length > 0;
    if (applies === 'project_course') return projectCourses().length > 0;
    return true;
  }
  /* who owes what, from the database's student_courses (db/15): never from the roster's copy */
  const myCourses = () => (D && D.myCourses) || [];
  const lensCourses = () => myCourses().filter(x => x.regime === 'lens');
  const viva30Courses = () => myCourses().filter(x => x.regime === 'viva30');
  const projectCourses = () => myCourses().filter(x => x.regime === 'project');
  const SET = k => ((D && D.settings) || {})[k];
  const STAGE = () => (D && D.stage) || 'before';
  const capOf = key => key === 'pcproj' ? 30 : 20;
  function typeRow(t) {
    return Array.isArray(t)
      ? { key: t[0], label: t[1], scope: t[2], due_on: t[3], blurb: t[5], applies: t[6] }
      : t;
  }
  const SHORT = { ethics: 'Ethics', plan: 'Plan', field: 'Field plan', charter: 'Charter',
                  folio: 'Folio', ai: 'AI note', lens: 'Lens note', brief: 'Client brief', handover: 'Handover', pcproj: 'Project' };
  const short = t => SHORT[t.key] || t.label;
  const DUE = { ethics: 'until the ethics sheet', plan: 'until the project plan',
                field: 'until the field plan', charter: 'until the team charter',
                folio: 'until the Folio', ai: 'until the AI declaration', lens: 'until your lens note' };
  function stateOf(t, filed) {
    if (filed) return 'ok';
    const d = daysTo(t.due_on);
    return d < 0 ? 'late' : d <= 10 ? 'due' : 'none';
  }
  /* An individual hand-in — the lens note — belongs to one person, and a
     team's rows are all in D.handins together.  Matching on the type alone
     made a teammate's lens note read as yours being filed. */
  function latest(key, course) {
    const t = (D.handinTypes || []).map(typeRow).find(x => x.key === key);
    const mine = D.me && D.me.roll;
    const rows = (D.handins || []).filter(h => {
      if (h.type_key !== key) return false;
      if (t && t.scope === 'individual') return mine ? h.roll === mine : false;
      return true;
    }).filter(h => key !== 'lens' || !course || h.course === course);
    rows.sort((a, b) => (b.version || 0) - (a.version || 0));
    return rows[0];
  }
  function versions(key, course) {
    const t = (D.handinTypes || []).map(typeRow).find(x => x.key === key);
    const mine = D.me && D.me.roll;
    return (D.handins || [])
      .filter(h => h.type_key === key
        && (!t || t.scope !== 'individual' || (mine && h.roll === mine))
        && (key !== 'lens' || !course || h.course === course))
      .sort((a, b) => (b.version || 0) - (a.version || 0));
  }

  /* Opening a filed file.  The link is signed by the database and lives for a
     few minutes, so it is fetched when the button is pressed rather than when
     the page is drawn.  Before this, nothing anywhere in the portal could open
     a file that had been handed in — a teacher was being asked to mark a Folio
     the portal would not let them read. */
  function openFile(h, label) {
    if (!h || !h.file_path) return null;
    return el('button.btn.ghost.sm', {
      type: 'button',
      onclick: e => guard(async () => {
        const b = e.target; const was = b.textContent;
        b.disabled = true; b.textContent = 'Opening…';
        try {
          const url = await API.fileUrl(h.file_path);
          if (!url) { toast(API.isDemo
            ? 'Demo mode keeps no files — only the name of what was sent.'
            : 'That file could not be opened. Ask the front desk.', 'err'); return; }
          window.open(url, '_blank', 'noopener');
        } finally { b.disabled = false; b.textContent = was; }
      })
    }, label || 'Open');
  }

  /* An irreversible action gets a sentence and a second press.  Cancelling a
     booking used to happen on the first click, on a slot somebody else was
     waiting for. */
  function confirmThen(title, body, label, fn) {
    const close = modal(title, el('p', { style: 'margin:0;font-size:14px;line-height:1.55' }, body),
      c => [el('button.btn.ghost', { onclick: c }, 'Leave it'),
            el('button.btn.danger', { onclick: () => { c(); fn(); } }, label)]);
    return close;
  }

  /* The late penalty, as the database works it out: five of the twenty a week,
     capped at the whole twenty.  Shown at the moment of a late upload, so it
     is never a surprise in December. */
  function penaltyFor(due, cap) {
    const d = -daysTo(due);
    if (d <= 0) return 0;
    const weeks = SET('late_week_rule') === 'full' ? Math.floor(d / 7) : Math.ceil(d / 7);
    return Math.min(cap || 20, weeks * 5);
  }

  /* One card per thing this student owes.  A lens note is one card PER COURSE
     (a second lens note is a second hand-in, never version 2 of the first); a
     course that marks the viva out of 30 gets a line, not a card; a student who
     studies courses as a project files ONE joined project and confirms their
     supervision hours here. */
  function handinItems() {
    const types = (D.handinTypes || []).map(typeRow).filter((t, i) => applicable(D.handinTypes[i]));
    const items = [];
    types.forEach(t => {
      if (t.key === 'lens') lensCourses().forEach(c => items.push({ t, course: c.course, title: c.title }));
      else items.push({ t });
    });
    return items;
  }
  const filedOf = it => latest(it.t.key, it.course);
  function handinsView() {
    const items = handinItems();
    const list = el('div.card', el('div.h', el('h3', 'Everything you hand in'),
      el('span.tag', items.length + ' items')),
      el('div.hint.pad', 'Tap a line to open it. PDF, Word, PowerPoint, a spreadsheet, a zip or a photograph, 60 MB at most. '
        + 'Replacing a file never deletes the old one: it files a new version.'),
      el('div.b.flush'));
    const body = list.querySelector('.b');
    let seenNext = false;                       // the first thing not filed opens; the rest fold
    if (!items.length) {
      body.append(el('div.empty',
        'Nothing is set for you yet. Hand-ins appear here once your convener has placed you in a team.'));
    }
    items.forEach(it => {
      const t = it.t, cap = capOf(t.key);
      const filed = filedOf(it), st = stateOf(t, filed), d = daysTo(t.due_on);
      const older = versions(t.key, it.course).slice(1);
      const idk = t.key + (it.course ? '-' + it.course : '');
      const label = it.course ? 'Lens note · ' + it.course + ' · ' + (it.title || '') : t.label;
      /* the same list the bucket is set to accept, so a file is refused here
         rather than after a two-minute upload */
      const file = el('input', { type: 'file', id: 'f-' + idk,
        accept: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.heic,.webp,.txt,.csv' });
      const note = el('input', { type: 'text', id: 'n-' + idk,
        placeholder: 'anything the convener should know (optional)' });
      const pen = penaltyFor(t.due_on, cap);
      const doSend = () => guard(async () => {
        const f = file.files[0];
        if (!f) throw Object.assign(new Error('Choose a file first.'), { friendly: true });
        if (f.size > 60 * 1024 * 1024)
          throw Object.assign(new Error('That file is ' + (f.size / 1048576).toFixed(0)
            + ' MB. The limit is 60 MB — split it, or compress the images.'), { friendly: true });
        await API.submitHandin(t.key, f, note.value, it.course || null);
        toast('Filed. ' + label + ' is in.' + (pen ? ' It is late, so the mark loses '
          + pen + ' of the ' + cap + (t.scope === 'team' ? ' in every course marking it.' : '.') : ''));
        refresh();
      });
      const send = el('button.btn.sm', {
        onclick: () => {
          /* a late upload costs marks, so it is said out loud before it happens */
          if (pen) return confirmThen('This one is late',
            label + ' was due on ' + pretty(t.due_on) + ', which is ' + Math.abs(d)
            + ' days ago. Filing it now costs ' + pen + ' of the ' + cap
            + (t.scope === 'team' ? ' in every course that marks it.' : '.') + ' Filing it later costs more. Send it?',
            'Send it anyway', doSend);
          doSend();
        }
      }, filed ? 'Replace it' : 'Hand it in');
      const part = ['brief', 'handover', 'ai'].indexOf(t.key) >= 0;

      const open = !filed && (st === 'late' || (!seenNext && (seenNext = true)));
      const head = el('div.hi-h', { role: 'button', tabindex: '0', 'aria-expanded': open ? 'true' : 'false' },
          el('div.t', el('b', X(t.key, label)),
            el('span.pill.' + (st === 'none' ? 'info' : st),
              filed ? 'filed' : st === 'late' ? Math.abs(d) + ' days late' : d + ' days left'),
            t.scope === 'individual' ? el('span.pill.none', 'yours, not the team’s') : null,
            part ? el('span.pill.none', 'part of the Folio') : null,
            filed && filed.penalty ? el('span.pill.late', filed.penalty + ' of ' + cap + ' lost, late') : null,
            filed && filed.state === 'accepted' ? el('span.pill.ok', 'accepted by your convener') : null,
            filed && filed.state === 'returned' ? el('span.pill.late', 'returned — ' + (filed.review_note || 'see your convener')) : null,
            el('span.when', 'due ' + pretty(t.due_on) + ', by midnight in Karachi')),
          el('span.caret', { 'aria-hidden': 'true' }));
      const fold = el('div.hi-body',
          el('p.blurb', t.blurb),
          filed ? el('div.filed',
            el('span', 'v' + filed.version + ' · ' + (filed.file_name || '') + ' · '
              + stamp(filed.submitted_at) + ' Karachi time'
              + (filed.by ? ' · ' + filed.by : '')),
            el('span', { style: 'margin-left:auto;display:inline-flex;gap:7px' },
              openFile(filed, 'Open'),
              older.length ? el('button.btn.ghost.sm', { type: 'button',
                onclick: () => modal(label + ' — every version',
                  el('table.t', el('tbody', ...versions(t.key, it.course).map(h =>
                    el('tr',
                      el('td.n', 'v' + h.version),
                      el('td', h.file_name || '',
                        el('div', { style: 'color:var(--text-3);font-size:11.5px;margin-top:3px' },
                          stamp(h.submitted_at)
                          + (h.by ? ' · ' + h.by : '')
                          + (h.penalty ? ' · ' + h.penalty + ' of ' + cap + ' lost' : ''))),
                      el('td', { style: 'text-align:right' }, openFile(h, 'Open')))))),
                  c => [el('button.btn.ghost', { onclick: c }, 'Close')]) },
                older.length + ' earlier') : null))
            : null,
          t.key === 'ai' ? aiDeclarationBlock(D.team ? D.team.id : null, filed) : el('div.act',
            el('label.vh', { for: 'f-' + idk }, 'File for ' + label), file,
            el('label.vh', { for: 'n-' + idk }, 'Note for ' + label), note,
            send));
      const item = el('div.hi.' + st + (open ? '.open' : ''), el('div.bar'), el('div.in', head, fold));
      const toggle = () => { const on = item.classList.toggle('open'); head.setAttribute('aria-expanded', on ? 'true' : 'false'); };
      head.addEventListener('click', e => { if (e.target.closest('.xp')) return; toggle(); });   // the ? beside the title keeps its own tap
      head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      body.append(item);
    });

    /* the Folio checklist: the four parts, and whether it can be accepted */
    const parts = ['folio', 'brief', 'handover', 'ai'];
    const have = parts.filter(k => latest(k)).length;
    const checklist = (D.team && items.some(it => it.t.key === 'folio')) ? el('div.card', { style: 'margin-bottom:14px' },
      el('div.h', el('h3', X('folio', 'The Folio checklist')), el('span.tag', have + ' of 4 on file')),
      el('div.b',
        el('div.stand', ...parts.map(k => {
          const f = latest(k);
          return el('div.s' + (f ? '.ok' : ''), el('i'), el('div', el('b', SHORT[k] || k), el('span', f ? 'filed v' + f.version : 'not yet')));
        })),
        el('div.hint', { style: 'margin-top:10px' }, 'The Folio is not accepted without its ',
          X('brief', 'client brief'), ', its ', X('handover', 'handover page'), ' and the ',
          X('ai', 'AI declaration'), '. Every course marking it takes ',
          X('late', '5 of the 20 off for each week it is late'), '.'))) : null;

    /* the courses that mark the viva out of 30: nothing to hand in, said plainly */
    const v30 = viva30Courses();
    const v30Card = v30.length ? el('div.card', { style: 'margin-bottom:14px' },
      el('div.h', el('h3', X('viva30', 'Marked on the viva out of 30'))),
      el('div.b', el('p', { style: 'margin:0 0 8px;font-size:13.5px;line-height:1.55' },
        'You already write two lens notes, so from the third lens course on nothing is written: the course marks your viva out of 30 instead.'),
        el('ul', { style: 'margin:0;padding-left:18px;font-size:13.5px' }, ...v30.map(c => el('li', c.course + ' · ' + c.title))))) : null;

    return el('div',
      el('div.page-h', el('div.eyebrow', 'Hand-ins'), el('h1', 'What is due'),
        el('p', 'Every version is kept, with the time it arrived. The database’s clock counts, not your phone’s; '
          + 'a due date ends at midnight, Karachi time.')),
      el('div#flash'), firstTimeLine(), termSpine(items), checklist, v30Card, list,
      projectCourses().length ? supervisionCard() : null,
      footnote());
  }

  /* the student's side of the supervision log: the teacher ticks the hour, the student confirms */
  function supervisionCard() {
    const weeks = (D.sessions || []).map(sessionRow).filter(x => /^session/i.test(x.label || ''));
    const first = +SET('supervision_first_n') || 3, last = +SET('supervision_last_n') || 14;
    const inRange = weeks.filter(w => w.n >= first && w.n <= last);
    const pct = +SET('supervision_pct') || 80;
    return el('div.card', { style: 'margin-top:14px' },
      el('div.h', el('h3', X('supervision', 'Your supervision hours')), el('span.tag', pct + '% to sit the defence')),
      el('div.b',
        el('p', { style: 'margin:0 0 10px;font-size:13.5px;line-height:1.55;color:var(--text-2)' },
          'One hour a week with your teacher for each course you study as a project. Your teacher ticks each hour held; '
          + 'you confirm it here. To sit the ', X('defence', 'oral defence'), ' you need ' + pct + ' per cent of the hours and a log confirmed by you both.'),
        ...projectCourses().map(c => {
          const rows = (D.supervision || []).filter(x => x.course === c.course);
          const held = rows.filter(x => x.held).length, conf = rows.filter(x => x.held && x.confirmed).length;
          const p = inRange.length ? Math.floor(100 * held / inRange.length) : 0;
          return el('div', { style: 'margin-bottom:12px' },
            el('div', { style: 'display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin-bottom:6px' },
              el('b', c.course + ' · ' + c.title),
              el('span.pill.' + (p >= pct ? 'ok' : 'due'), held + ' of ' + inRange.length + ' held · ' + p + '%'),
              conf < held ? el('span.pill.late', (held - conf) + ' to confirm') : (held ? el('span.pill.ok', 'all confirmed') : null),
              (D.defence && D.defence.chair_name) ? el('span.pill.info', 'chair: ' + D.defence.chair_name) : null),
            el('div.sup', ...inRange.map(w => {
              const r = rows.find(x => x.session_n === w.n);
              const cls = !r ? '' : r.held ? (r.confirmed ? '.held' : '.held.unc') : '.missed';
              const can = r && r.held && !r.confirmed;
              return el('button' + cls, { type: 'button', disabled: !can,
                title: w.label + (r ? (r.held ? (r.confirmed ? ' · held, confirmed' : ' · held — tap to confirm') : ' · not held') : ' · not logged yet'),
                'aria-label': w.label + (r ? (r.held ? (r.confirmed ? ', held and confirmed' : ', held, confirm it') : ', not held') : ', not logged'),
                onclick: () => can ? guard(async () => { await API.confirmSupervision(c.course, w.n); toast('Confirmed.'); refresh(); }) : null },
                el('span', 'S' + w.label.replace(/\D/g, '')), el('small', !r ? '—' : r.held ? (r.confirmed ? '✓' : 'confirm') : 'no'));
            })));
        }),
        el('div.hint', 'A dashed box is an hour your teacher has logged and you have not yet confirmed. Tap it to confirm.')));
  }
  const sessionRow = x => Array.isArray(x) ? { n: x[0], starts: x[1], ends: x[2], label: x[3], what: x[4] } : x;

  function diaryView() {
    const B = D.booking, wins = (B.windows || []).filter(w => !w.hidden);
    let win = (wins.find(w => { const t = today(); return t >= w.opens && t <= w.closes; }) || wins[0] || {}).key;
    const root = el('div',
      el('div.page-h', el('div.eyebrow', 'Fifteen minutes'), el('h1', 'Book a session'),
        el('p', 'Dr Naveed is on campus twelve till eight, every day including the weekend, from 5 October to 12 December. Book one day ahead and say in a sentence what is stuck — that sentence is what makes the fifteen minutes worth having.')),
      el('div#flash'));
    const mine = el('div'); const picker = el('div');
    root.append(mine, picker, footnote());

    function drawMine() {
      const bs = (D.bookings || []).filter(b => b.state !== 'cancelled');
      clear(mine).append(el('div.card', { style: 'margin-bottom:16px' },
        el('div.h', el('h3', 'Your sessions')),
        el('div.b.flush', bs.length ? el('table.t',
          el('tbody', ...bs.map(b => {
            /* the adapter gives every booking its Karachi day and time */
            return el('tr',
              el('td.n', b.day ? pretty(b.day) : ''),
              el('td.n', b.time || ''),
              el('td', (wins.find(w => w.key === b.window_key) || {}).label || b.window_key,
                 el('div', { style: 'color:var(--text-3);font-size:12px' }, b.what_is_stuck)),
              el('td', { style: 'text-align:right' },
                /* a slot somebody else is waiting for should not go on one click */
                el('button.btn.ghost.sm', { onclick: () => confirmThen('Give up this slot?',
                  'It goes straight back into the diary and somebody else may take it within the '
                  + 'minute. If you only want a different time, book the new one first.',
                  'Give it up', () => guard(async () => {
                    await API.cancelBooking(b.id); toast('Cancelled.'); refresh(); })) }, 'Cancel')));
          })))
          : el('div.empty', 'Nothing booked yet. Every team is given two sessions automatically — '
              + 'they appear here once the diary opens on 5 October. Individual slots are '
              + 'first come, one day ahead.'))));
    }

    function drawPicker() {
      const w = wins.find(x => x.key === win) || wins[0]; if (!w) return;
      /* Karachi calendar days, from tomorrow (a session is booked a day ahead)
         to the day the window closes.  Built on UTC arithmetic: the old loop
         printed a local midnight as ISO and every day came out one early. */
      const days = [];
      for (let d = w.opens > today() ? w.opens : today(); d <= w.closes; d = addDays(d, 1)) days.push(d);
      let day = days[0];
      const strip = el('div.daystrip'), grid = el('div.slots');
      clear(picker).append(el('div.card',
        el('div.h', el('h3', 'Pick a time'),
          el('span.tag', el('select', { onchange: e => { win = e.target.value; drawPicker(); } },
            ...wins.map(x => el('option', { value: x.key, selected: x.key === win }, x.label))))),
        el('div.b',
          el('div.msg.note', w.note || ''),
          days.length ? el('div', strip, grid)
                      : el('div.empty', 'This window has closed.'))));
      if (!days.length) return;

      API.slotCounts(days).then(counts => {
        clear(strip).append(...days.map(dd => {
          const c = counts.find(x => x.day === dd) || { free: 0, total: 0 };
          return el('button', { class: (dd === day ? 'on ' : '') + (c.free ? '' : 'full'),
            onclick: () => { day = dd; drawPicker.redrawStrip(); drawSlots(); } },
            el('div.d', DAY[dayDate(dd).getUTCDay()]),
            el('div.n', dayDate(dd).getUTCDate()),
            el('div.f', c.free + ' free'));
        }));
      });
      drawPicker.redrawStrip = () => [...strip.children].forEach((b, i) => b.classList.toggle('on', days[i] === day));
      function drawSlots() {
        clear(grid).append(el('div.empty', 'Loading…'));
        API.slotsFor(day).then(slots => {
          /* taken = somebody holds it (greyed, whoever they are); too soon =
             inside the day's notice the database insists on */
          const soon = s => s.bookable === false;
          if (!slots.length) { clear(grid).append(el('div.empty', 'No sessions are offered on this day.')); return; }
          clear(grid).append(...slots.map(s => el('button.slot', {
            class: s.mine ? 'mine' : '', disabled: (s.taken && !s.mine) || soon(s),
            title: s.mine ? 'yours' : s.taken ? 'taken' : soon(s) ? 'less than a day away' : 'free',
            'aria-label': s.time + (s.mine ? ', yours' : s.taken ? ', taken' : soon(s) ? ', too soon to book' : ', free'),
            onclick: () => (s.taken || soon(s)) ? null : ask(s) }, s.time)),
            el('div.hint', { style: 'grid-column:1/-1;margin-top:8px' },
              'Times are Karachi time. A greyed time is taken, or is less than a day away.'));
        }).catch(e => {
          clear(grid).append(el('div.msg.err', 'The times for this day did not load. '
            + (e && e.friendly ? e.message : 'Try again.')));
        });
      }
      function ask(s) {
        const what = el('textarea', { placeholder: 'One sentence. “We cannot get access to the riders.” “Our sample is 40 and we do not know if that is enough.”' });
        const close = modal('Book ' + pretty(s.day) + ', ' + s.time, el('div',
          el('div.msg.note', 'This is a fifteen-minute slot. Bring the thing that is stuck.'),
          el('label.f', el('span', 'What is stuck?'), what)),
          c => [el('button.btn.ghost', { onclick: c }, 'Not now'),
                el('button.btn', { onclick: () => guard(async () => {
                  await API.book(s.id, win, what.value); c(); toast('Booked. It is in your list above.'); refresh();
                }) }, 'Book it')]);
      }
      drawSlots();
    }
    drawMine(); drawPicker(); return root;
  }

  /* ---------------------------------------------------------- team */
  function teamView() {
    const t = D.team, mates = D.mates || [];
    const ST = String((D.me || {}).status || '');
    const PG = /^postgraduate/i.test(ST), SUPV = /^supervision/i.test(ST);
    const GONE = /^not (registered|in this cut)/i.test(ST);
    const root = el('div',
      el('div.page-h', el('div.eyebrow', 'Your team'), el('h1', t ? t.id : 'No team yet'),
        el('p', t ? [t.block, t.lane, t.track].filter(Boolean).join(' · ')
                  : GONE ? 'The Registrar’s file does not show you as registered this term.'
                  : 'You are registered but not yet in a team. The front desk can tell you why.')),
      el('div#flash'));
    if (!t) {
      root.append(
        el('div.card',
          el('div.h', el('h3', 'What happens next')),
          el('div.b',
            el('p', { style: 'margin:0 0 12px;font-size:14px;line-height:1.6' },
              PG ? 'Your courses run as ordinary classes. You have no team and no project.'
              : GONE ? 'Teams were made from the Registrar’s registration file, and you are not on it this term. '
                 + 'If you are registered, take your fee slip and timetable to the front desk and you will be placed by hand.'
              : SUPV ? 'You are registered only on a thesis or supervised study, which your supervisor runs. '
                 + 'It is not part of a Greenwich Works team.'
              : 'Teams are cut from the timetable, so a student registered on no timetabled course '
              + 'cannot be placed by the machine and has to be placed by a person. That is a '
              + 'registration matter, not a Greenwich Works one.'),
            el('p', { style: 'margin:0 0 14px;font-size:14px;line-height:1.6;color:var(--text-2)' },
              PG ? 'There is nothing for you to hand in here.'
              : GONE ? 'Until then there is nothing for you to hand in here.'
              : SUPV ? 'There is nothing for you to hand in here. Ask the front desk if that looks wrong.'
              : 'Go to the front desk with your roll number and your timetable. Until you are placed, '
              + 'nothing in this portal has anything for you to hand in.'),
            el('div.kv', el('div.k', 'Front desk'), el('div.v', CFG.SUPPORT)))),
        footnote());
      return root;
    }

    /* "My team" did not list the team.  The four names were loaded on every
       render and used only to fill in the reporting dropdown. */
    root.append(el('div.card', { style: 'margin-bottom:14px' },
      el('div.h', el('h3', 'Who is in ' + t.id), el('span.tag',
        mates.length + (mates.length === 1 ? ' member' : ' members'))),
      el('div.b.flush', mates.length ? el('table.t', el('tbody',
        ...mates.map(m => el('tr',
          el('td', el('b', shown(m.name, m.roll)),
            m.roll === (D.me || {}).roll
              ? el('span.pill.info', { style: 'margin-left:7px' }, 'you') : null),
          el('td.n', m.roll),
          el('td', { style: 'font-size:12px;color:var(--text-2)' }, m.major || m.prog || ''))))) 
        : el('div.empty', 'Your team has no other members on the register yet.'))));

    root.append(projectSection(t));

    root.append(el('div.card',
      el('div.h', el('h3', X('report', 'Something is wrong in the team'))),
      el('div.b',
        el('div.msg.warn', 'This goes to your convener and nobody else. Your teammates never see it, and neither does the person you name.'),
        el('button.btn.ghost', { onclick: () => reportModal(mates) }, 'Report a team member'))));
    root.append(footnote()); return root;
  }

  const ETHICS_WORD = { filed: 'filed with the panel', cleared: 'cleared', cleared_conditions: 'cleared with conditions', not_cleared: 'not cleared' };
  function ethicsLine(t) {
    if (!t || t.ethics_tier == null) return 'tier not set yet';
    let s = 'Tier ' + t.ethics_tier;
    if (t.ethics_status === 'filed') s += ' · filed with the panel on ' + pretty(t.ethics_filed_on);
    else if (t.ethics_status) s += ' · decided ' + pretty(t.ethics_decided_on) + ': ' + ETHICS_WORD[t.ethics_status];
    else s += ' · not cleared yet';
    return s;
  }
  const ethicsCleared = t => !!t && t.ethics_tier != null && (t.ethics_status === 'cleared' || t.ethics_status === 'cleared_conditions');
  /* where the team stands, one glance: the same five facts the home screen and the convener's board use */
  function standing(t) {
    const hasProject = !!(t && (t.project_id || (t.project_custom || '').trim()));
    const cells = [
      { k: 'sequence', l: 'Project', s: !t ? 'no team' : t.project_state === 'approved' ? 'ok' : t.project_state === 'returned' ? 'bad' : hasProject ? 'wait' : '',
        v: !hasProject ? (STAGE() === 'choice' ? 'not chosen yet' : 'chosen at Session 6') : t.project_state === 'approved' ? 'approved by ' + (t.project_decided_by || 'your convener')
           : t.project_state === 'returned' ? 'returned — choose again' : 'waiting for your convener' },
      { k: 'team_name', l: 'Team name', s: t && t.name ? 'ok' : '', v: t && t.name ? t.name : 'not named yet' },
      { k: 'prediction', l: 'Sealed prediction', s: t && t.prediction_sealed_on ? 'ok' : '',
        v: t && t.prediction_opened_on ? 'opened at the first viva on ' + pretty(t.prediction_opened_on)
           : t && t.prediction_sealed_on ? 'sealed on ' + pretty(t.prediction_sealed_on) + ' by ' + (t.prediction_sealed_by || 'your convener') : 'sealed at Session 6' },
      { k: 'tier', l: 'Ethics', s: ethicsCleared(t) ? 'ok' : t && t.ethics_status === 'not_cleared' ? 'bad' : t && t.ethics_tier != null ? 'wait' : '', v: ethicsLine(t) },
      { k: 'plan', l: 'Plan', s: latest('plan') ? 'ok' : '', v: latest('plan') ? 'in' : 'due ' + shortDay((typeRows().find(x => x.key === 'plan') || {}).due_on || '2026-10-24') },
      { k: 'charter', l: 'Charter', s: latest('charter') ? 'ok' : '', v: latest('charter') ? 'in' : 'due ' + shortDay((typeRows().find(x => x.key === 'charter') || {}).due_on || '2026-11-07') }
    ];
    if (t && t.fieldwork) { const f = latest('field');
      cells.push({ k: 'field', l: 'Field plan', s: f && f.state === 'accepted' ? 'ok' : f ? 'wait' : '', v: f ? (f.state === 'accepted' ? 'accepted' : 'filed, not yet accepted') : 'not filed' }); }
    return el('div.stand', ...cells.map(c => el('div.s' + (c.s ? '.' + c.s : ''), el('i'), el('div', el('b', X(c.k, c.l)), el('span', c.v)))));
  }
  const typeRows = () => (D.handinTypes || []).map(typeRow);

  /* ---- the project: menu at Session 4, the full projects at Session 5, the choice at Session 6 ---- */
  function projectSection(t) {
    const stage = STAGE();
    const mine = (D.projects || []).filter(p => p.block === t.block && !p.reserve).sort((a, b) => a.title < b.title ? -1 : 1);
    const chosen = mine.find(p => p.id === t.project_id);
    const box = el('div');
    const head = el('div.card', { style: 'margin-bottom:14px' },
      el('div.h', el('h3', 'Where your team stands')), el('div.b', standing(t)));

    function menuCard(p, availability) {
      const av = availability || {};
      const cls = p.id === t.project_id ? '.mine' : av.count >= 2 ? '.full2' : av.count ? '.taken' : '';
      return el('div.p' + cls,
        el('b', p.title), p.id === t.project_id ? el('span.pill.info', { style: 'margin-left:8px' }, 'your choice') : null,
        el('div.pr', p.problem),
        el('div.for', 'For: ' + (p.authority || []).join(' · ')),
        p.full && p.work ? el('div.full',
          el('p', el('b', 'What the team does. '), p.work),
          p.made ? el('p', el('b', 'What exists by December. '), p.made) : null,
          p.skill ? el('p', el('b', 'The skill you take away. '), p.skill) : null) : null,
        av.count != null ? el('div', { style: 'margin-top:6px;font-size:12px;color:' + (av.count >= 2 ? 'var(--red)' : 'var(--text-3)') },
          av.count >= 2 ? 'Taken by two teams already — not available.' : av.count === 1 ? 'One team has it, on: ' + av.patches.join(' · ') + '. A second team may take it on a different site.' : 'No team has taken it yet.') : null);
    }

    if (t && t.block) box.append(sectionsCard(t.block));   /* the merge page, once the convener has written it (register BF) */
    if (t) box.append(scopeAndDraftsCard(t.id));            /* the scope of Session 9 and the drafts seen at Session 11 (register BG) */
    if (t && t.fieldwork) box.append(fieldworkCard(t), incidentsCard(t));   /* the sign-out sheet and form F2 (register BH) */
    if (t) box.append(appealsCard(t));

    if (stage === 'before') {
      box.append(el('div.card', el('div.h', el('h3', X('menu', 'Your project menu'))),
        el('div.b', el('div.msg.note', 'The project menu — each project’s title, its problem in one line and who it is for — opens at Session 4'
          + (SET('menu_from') ? ', from ' + pretty(SET('menu_from')) : '') + '. The full projects follow at Session 5 and the final choice is made at Session 6. Your convener will tell you.'))));
    } else if (stage === 'menu' || stage === 'full') {
      box.append(el('div.card', el('div.h', el('h3', X(stage === 'menu' ? 'menu' : 'sequence', stage === 'menu' ? 'Your project menu' : 'The full projects')), el('span.tag', mine.length + ' in your block')),
        el('div.b',
          el('div.msg.note', stage === 'menu'
            ? 'Title, one-line problem, who it is for. Note the three your team likes; nobody chooses yet. The full projects follow at Session 5' + (SET('full_from') ? ' (from ' + pretty(SET('full_from')) + ')' : '') + '.'
            : 'The full projects, with the block brief you were given. Your team makes its final choice at Session 6' + (SET('choice_from') ? ' (from ' + pretty(SET('choice_from')) + ')' : '') + ', with its convener, and names itself.'),
          el('div.menu', ...mine.map(p => menuCard(p))))));
    } else {
      /* the choice: the same form as before, the menu underneath with what is taken */
      const sel = el('select', { id: 'proj' },
        el('option', { value: '' }, '— choose a project —'),
        ...mine.map(p => el('option', { value: p.id, selected: p.id === t.project_id }, p.title)));
      const own = el('input', { id: 'projown', type: 'text', placeholder: 'or describe your own project', value: t.project_custom || '' });
      const patch = el('input', { id: 'patch', type: 'text', value: t.patch || '',
        placeholder: 'e.g. Clifton Block 2 · 60 flats in PECHS · rice exporters under 50 staff' });
      const fw = el('input', { id: 'fieldwork', type: 'checkbox' }); fw.checked = !!t.fieldwork;
      const takenBox = el('div');
      const locked = t.project_state === 'approved';
      function showTaken() {
        const id = sel.value, custom = own.value.trim();
        if (!id && !custom) { clear(takenBox); return; }
        API.patchesTaken(id || null, custom).then(rows => {
          const others = rows.filter(r => r.team_id !== t.id);
          clear(takenBox).append(others.length >= 2
            ? el('div.msg.err', el('b', 'This project already has its two teams. '), 'At most two teams take one project. The portal will refuse a third — choose another.')
            : others.length
            ? el('div.msg.warn', el('b', 'One team has this project already, working on: '), others.map(r => r.patch).join(' · '),
                el('div', { style: 'margin-top:5px' }, 'At most two teams take one project, and only on different sites or areas. If you take it, name a different one.'))
            : el('div.msg.note', 'No team has taken this project yet.'));
        });
      }
      sel.addEventListener('change', () => { if (sel.value) own.value = ''; showTaken(); });
      own.addEventListener('change', showTaken);
      const nameIn = el('input', { type: 'text', value: t.name || '', placeholder: 'your team’s name (3 to 40 characters)', maxlength: 40 });
      box.append(el('div.card', { style: 'margin-bottom:14px' },
        el('div.h', el('h3', X('sequence', 'Your final choice')), el('span.tag', mine.length + ' in your block')),
        el('div.b',
          t.project_state === 'returned' ? el('div.msg.err', el('b', 'Your convener returned this choice. '), t.project_note || '', el('div', { style: 'margin-top:4px;font-size:12.5px' }, 'Choose again below.')) : null,
          locked ? el('div.msg.ok', el('b', 'Approved by ' + (t.project_decided_by || 'your convener') + '. '), chosen ? chosen.title : (t.project_custom || ''),
                     t.patch ? el('div', { style: 'margin-top:4px' }, 'Your site or area: ' + t.patch) : null,
                     el('div', { style: 'margin-top:4px;font-size:12.5px' }, 'Only your convener can reopen the choice.')) : null,
          !locked && chosen ? el('div.msg.note', el('b', chosen.title), t.patch ? el('div', { style: 'margin-top:4px' }, 'Your site or area: ' + t.patch) : null,
                     el('div', { style: 'margin-top:4px;font-size:12.5px' }, 'Entered; waiting for your convener to approve it.')) : null,
          el('label.f', el('span', 'The project'), sel),
          el('label.f', el('span', 'Or your own'), own),
          el('label.f', el('span', X('patch', 'Your site or area')), patch,
            el('div.hint', 'At most two teams take one project, and only on different sites or areas. Say where, or on whom, your team will work. The portal refuses a site another team on the same project already holds, and refuses a third team.')),
          takenBox,
          el('label.f', { style: 'display:flex;gap:9px;align-items:center;margin-top:12px' }, fw,
            el('span', { style: 'margin:0;text-transform:none;letter-spacing:0;font-size:13.5px;color:var(--text)' },
              'This involves fieldwork — going out and gathering something')),
          el('div.hint', 'Ticking fieldwork adds the ', X('field', 'field plan (form F1)'), ' to your hand-ins and puts you under the fieldwork rules. '
            + 'No team leaves campus before the ', X('gate', 'fieldwork gate'), ' opens, and none before its ethics sheet is cleared. Once the sheet or the '
            + 'field plan is filed, only your convener can take fieldwork off.'),
          el('button.btn', { style: 'margin-top:12px', disabled: locked, onclick: () => {
            const send = () => guard(async () => {
              await API.claimProject(sel.value || null, own.value, patch.value, fw.checked);
              toast('Entered. Your convener approves it, or returns it with a reason.'); refresh();
            });
            if (t.fieldwork && !fw.checked) return confirmThen('Take fieldwork off?',
              'The field plan (form F1) will disappear from your hand-ins and your team will no '
              + 'longer be under the fieldwork rules. If you go out after this without a signed '
              + 'field plan, you are out there with no cover.', 'Take it off', send);
            send();
          } }, locked ? 'Approved — locked' : 'Enter this project and site'),
          el('div', { style: 'margin-top:18px;padding-top:14px;border-top:1px solid var(--rule)' },
            el('label.f', el('span', X('team_name', 'Your team’s name')), nameIn),
            el('button.btn.ghost.sm', { onclick: () => guard(async () => { await API.setTeamName(nameIn.value); toast('Named.'); refresh(); }) }, t.name ? 'Rename' : 'Name the team')))));
      box.append(el('div.card', el('div.h', el('h3', 'The projects, and who has taken what')),
        el('div.b', el('div.menu.avail', ...mine.map(p => menuCard(p))))));
      const avail = box.querySelector('.menu.avail');
      /* one call per project on this screen is fine for a block of a dozen; it says what is gone */
      if (avail) mine.forEach((p, i) => API.patchesTaken(p.id, null).then(rows => {
        const others = rows.filter(r => r.team_id !== t.id);
        const card = menuCard(p, { count: others.length, patches: others.map(r => r.patch) });
        avail.children[i].replaceWith(card);
      }).catch(() => {}));
      showTaken();
    }
    return el('div', head, box);
  }

  /* ---------------------------------------------------------- home */
  /* One screen a student reads in ten seconds on a phone: what is due this
     week and the next, where the team stands, the marks map, the next fifteen
     minutes, and one button to report a teammate.  Nothing else. */
  const REGIME_LABEL = { folio: 'marks the Folio', lens: 'lens note', viva30: 'viva out of 30',
                         project: 'studied as a project', outside: 'outside Greenwich Works', unplaced: 'no team yet' };
  const REGIME_KEY = { folio: 'regime_folio', lens: 'lens', viva30: 'viva30', project: 'project_course', outside: 'regime_outside', unplaced: 'g_unplaced' };
  function reportModal(mates) {
    const who = el('select', el('option', { value: '' }, '— who —'),
      ...mates.filter(m => m.roll !== (D.me || {}).roll).map(m => el('option', { value: m.roll },
        hasName(m.name, m.roll) ? m.name : m.roll)));
    const body = el('textarea', { placeholder: 'What has happened, and since when.' });
    modal('Report a team member', el('div',
      el('div.msg.warn', 'This goes to your convener and nobody else. Your teammates never see it, and neither does the person you name. It is answered within five working days.'),
      el('label.f', el('span', 'Who'), who),
      el('label.f', el('span', 'What is going on'), body),
      el('div.hint', 'The convener decides what happens next. They may remove the person from the Folio, in which case that person is marked on their viva and what they can personally evidence.')),
      c => [el('button.btn.ghost', { onclick: c }, 'Cancel'),
            el('button.btn.danger', { onclick: () => guard(async () => {
              if (!who.value || !body.value.trim()) throw Object.assign(new Error('Name someone and say what happened.'), { friendly: true });
              await API.report(who.value, body.value); c(); toast('Sent to your convener.'); refresh();
            }) }, 'Send to the convener')]);
  }
  /* The first thing on the student's screen is the one thing to do next, in one card:
     what, when, and the button that does it.  Everything else follows. (22 Sep, register BD) */
  function nowCard(me, t, items, nextItem, late, done, reviewOn) {
    const lateItem = items.filter(it => !filedOf(it) && daysTo(it.t.due_on) < 0).sort((a, b) => a.t.due_on < b.t.due_on ? -1 : 1)[0];
    const it = lateItem || nextItem;
    const d = it ? daysTo(it.t.due_on) : null;
    const label = it ? (it.course ? 'Lens note · ' + it.course : it.t.label) : '';
    const main = !t
      ? el('div.main', el('div.k', 'Not yet in a team'), el('div.t', 'Your convener places you.'),
          el('div.w', 'Nothing else here opens until that happens. Your classes run as normal.'))
      : it
        ? el('div.main', el('div.k', lateItem ? 'Past its date' : 'Next for you'),
            el('div.t', X(it.t.key, label)),
            el('div.w', 'due ' + pretty(it.t.due_on) + ' · ' + (d < 0 ? Math.abs(d) + ' days past · 5 of the ' + capOf(it.t.key) + ' off per week' : d === 0 ? 'today' : d + ' days left')),
            el('div.cta', el('a.btn', { href: '#handins' }, lateItem ? 'Hand it in now' : 'Hand it in'),
              el('a.btn.ghost', { href: '#guide' }, 'How this works')))
        : el('div.main', el('div.k', 'Nothing due'), el('div.t', 'Everything you owe is filed.'),
            el('div.cta', el('a.btn.ghost', { href: '#handins' }, 'Hand-ins'), el('a.btn.ghost', { href: '#guide' }, 'How this works')));
    return el('section.now' + (lateItem ? '.late' : ''),
      el('div.hi-line',
        el('h1', hasName(me.name, me.roll) ? 'Hello, ' + String(me.name).trim().split(/\s+/)[0] : 'Hello'),
        el('span.sub', t ? t.id + (t.name ? ' · ' + t.name : '') + ' · ' + t.block : CFG.TERM)),
      main,
      t ? el('div.strip',
        el('span', done + ' of ' + items.length + ' filed'),
        el('div.prog', { role: 'progressbar', 'aria-valuenow': done, 'aria-valuemin': 0, 'aria-valuemax': items.length },
          el('i', { style: 'width:' + (items.length ? Math.round(100 * done / items.length) : 0) + '%' })),
        t.project_state === 'approved' ? el('span.chip', el('b', '✓'), 'project approved')
          : t.patch ? el('span.chip', el('b', '…'), 'project waiting for your convener') : el('span.chip', el('b', 'S6'), 'project chosen at Session 6'),
        reviewOn ? el('span.chip', el('b', String(daysTo(reviewOn))), X('review', 'days to the Karachi Review')) : null) : null);
  }

  function homeView() {
    const t = D.team, me = D.me || {};
    const items = handinItems();
    const done = items.filter(filedOf).length;
    const nextItem = items.filter(it => !filedOf(it)).sort((a, b) => a.t.due_on < b.t.due_on ? -1 : 1)[0];
    const bookings = (D.bookings || []).filter(b => b.state !== 'cancelled')
      .map(b => ({ at: b.starts_at ? new Date(b.starts_at) : b.slots ? new Date(b.slots.starts_at) : new Date(b.day + 'T' + b.time + ':00+05:00'), b }))
      .filter(x => x.at >= new Date()).sort((a, b) => a.at - b.at);
    const nextBooking = bookings[0] ? bookings[0].at : null;
    const G0 = GUIDE();
    const review = (G0 && G0.programme.calendar.find(c => /Karachi Review/i.test(c.session || '')));
    const reviewOn = review ? whenDate(review.dates) : null;
    const late = items.filter(it => !filedOf(it) && daysTo(it.t.due_on) < 0).length;
    const T = today(), horizon = addDays(T, 13);

    /* this week and the next: hand-ins, the dates the rules turn on, the next session */
    const rows = [];
    items.forEach(it => {
      const f = filedOf(it), d = it.t.due_on;
      if (f) return;
      if (d < T || d <= horizon) rows.push({ on: d, key: it.t.key, label: it.course ? 'Lens note · ' + it.course : it.t.label,
        sub: d < T ? Math.abs(daysTo(d)) + ' days past · 5 of the ' + capOf(it.t.key) + ' off per week' : daysTo(d) + ' days', over: d < T, go: '#handins' });
    });
    const dates = [['menu_from', 'menu', 'The project menu opens', 'title, one-line problem, who it is for'],
                   ['full_from', 'sequence', 'The full projects reach you', 'with the block brief'],
                   ['choice_from', 'sequence', 'Final choice, team name, sealed prediction', 'with your convener; the ethics sheet in class straight after'],
                   ['fieldwork_gate_date', 'gate', 'The fieldwork gate', 'if the duty phone and the sign-out sheet exist']];
    dates.forEach(([k, key, l, sub]) => { const d = SET(k); if (d && d >= T && d <= horizon && !(k === 'fieldwork_gate_date' && !(t && t.fieldwork)))
      rows.push({ on: d, key, label: l, sub, go: '#team' }); });
    if (nextBooking) { const d = new Intl.DateTimeFormat('en-CA', { timeZone: KHI }).format(nextBooking);
      if (d <= horizon) rows.push({ on: d, key: 'pvc', label: 'Fifteen minutes with the PVC', sub: stamp(nextBooking, { hour: '2-digit', minute: '2-digit' }) + ' · ' + (bookings[0].b.what_is_stuck || ''), go: '#diary' }); }
    rows.sort((a, b) => a.on < b.on ? -1 : 1);
    const week = el('div.week', ...(rows.length ? rows.map(r => el('div.row' + (r.over ? '.over' : ''),
        el('div.d', shortDay(r.on)),
        el('div.w', el('b', X(r.key, r.label)), el('span', r.sub)),
        r.go ? el('a.btn.ghost.sm', { href: r.go }, 'open') : null))
      : [el('div.empty', 'Nothing is due in the next two weeks.' + (nextItem ? ' Next: ' + (SHORT[nextItem.t.key] || nextItem.t.label) + ' on ' + pretty(nextItem.t.due_on) + '.' : ''))]));

    /* the marks map fills in when the database answers */
    const map = el('div.b.flush', el('div.empty', 'Loading…'));
    API.myMarksMap().then(list => {
      if (!list || !list.length) { clear(map).append(el('div.empty', 'No course is on your register yet.')); return; }
      const tbl = el('table.mmap',
        el('thead', el('tr', el('th', 'Course'), el('th', 'How it is marked'), el('th', { style: 'text-align:right' }, X('project30', 'Project 30')))),
        el('tbody', ...list.map(r => el('tr' + (r.regime === 'outside' ? '.out' : ''),
          el('td', el('span.c', r.course), el('div', { style: 'font-size:12.5px;color:var(--text-2)' }, r.title || '')),
          el('td', X(REGIME_KEY[r.regime] || r.regime, REGIME_LABEL[r.regime] || r.regime),
            r.regime === 'project' && r.midterm ? el('div', { style: 'font-size:11.5px;color:var(--text-3)' }, 'mid-term: ' + (r.midterm === 'plan' ? 'the Session 8 plan with the first 1,500 words' : 'a written paper in mid-term week')) : null,
            r.regime === 'lens' && r.handed_in === false ? el('div', { style: 'font-size:11.5px;color:var(--text-3)' }, 'lens note not filed yet') : null),
          el('td.m', r.regime === 'outside' || r.regime === 'unplaced' ? el('small', '—')
            : r.mark_30 == null ? el('small', r.closed ? 'closed' : 'not yet')
            : [String(r.mark_30), el('small', ' / 30' + (r.penalty ? ' · ' + r.penalty + ' late' : '')),
               r.oral_40 != null ? el('div', { style: 'font-size:12px' }, r.oral_40, el('small', ' / 40 oral')) : null])))));
      if (list.some(r => r.mark_30 != null)) { clear(map).append(tbl); return; }
      /* until a mark exists the table is nine rows of "not yet"; one line says the same (audit of 22 Sep, 3.5) */
      const c = {}; list.forEach(r => { c[r.regime] = (c[r.regime] || 0) + 1; });
      const parts = Object.entries(c).filter(([k]) => k !== 'outside' && k !== 'unplaced' && REGIME_LABEL[k]).map(([k, n]) => n + ' \u00d7 ' + REGIME_LABEL[k]);
      const inside = list.length - (c.outside || 0) - (c.unplaced || 0);
      clear(map).append(el('div.b',
        el('p', { style: 'margin:0;font-size:14px;line-height:1.55' }, el('b', inside + (inside === 1 ? ' course marks you' : ' courses mark you')),
          parts.length ? ': ' + parts.join(', ') + '.' : '.', ' Marks appear here as each course submits them, from Session 14.'),
        el('div', { style: 'margin-top:8px' }, el('button.btn.ghost.sm', { type: 'button', onclick: () => { clear(map).append(tbl); } }, 'Show every course'))));
    }).catch(() => clear(map).append(el('div.empty', 'The marks map did not load. Reload the page.')));

    return el('div',
      nowCard(me, t, items, nextItem, late, done, reviewOn),
      noticesCard(),
      el('div#flash'), firstTimeLine(),
      /* the helper, from the student home as well as the header (register AX.2) */
      el('div.hlp-line', { role: 'note' },
        el('span', el('b', 'Not sure what to do now? '),
          'Rashid Bhai already knows what your team has filed, and what is due next.'),
        el('button.btn.sm', { type: 'button', onclick: () => helperPanel() }, 'Ask Rashid Bhai'),
        el('button.btn.ghost.sm', { type: 'button', onclick: () => walkthrough(true) }, 'Show me round')),
      el('div.card.accent', { style: 'margin-bottom:14px' },
        el('div.h', el('h3', 'This week and next'), el('span.tag', pretty(T))),
        el('div.b', week)),
      t ? el('div.card', { style: 'margin-bottom:14px' },
        el('div.h', el('h3', 'Where your team stands'), el('span.tag', t.id + (t.name ? ' · ' + t.name : ''))),
        el('div.b', standing(t),
          el('div', { style: 'margin-top:12px;display:flex;gap:9px;flex-wrap:wrap' },
            el('a.btn.ghost.sm', { href: '#team' }, 'My team'),
            el('button.btn.ghost.sm', { onclick: () => reportModal(D.mates || []) }, 'Something is wrong in the team')))) : null,
      el('div.card', { style: 'margin-bottom:14px' },
        el('div.h', el('h3', 'Your courses, and how each marks you'), el('span.tag', X('marks_visible', 'marks appear as they are submitted'))),
        map),
      el('div.grid.g2',
        el('div.card',
          el('div.h', el('h3', X('pvc', 'Fifteen minutes with the PVC'))),
          el('div.b',
            nextBooking ? el('div.msg.ok', 'Booked for ' + stamp(nextBooking,
                { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ', Karachi time')
                        : el('p', { style: 'margin:0 0 12px;color:var(--text-2);font-size:13.5px' },
                            'Every team gets two automatically, and there are individual slots while they last. One day ahead, with one sentence saying what is stuck.'),
            el('a.btn', { href: '#diary' }, nextBooking ? 'The diary' : 'Book a session'))),
        el('div.card',
          el('div.h', el('h3', 'Your term'), el('span.tag', done + ' of ' + items.length + ' filed')),
          el('div.b', spine(items.map(it => it.t).filter((x, i, arr) => arr.findIndex(y => y.key === x.key) === i)),
            el('div', { style: 'margin-top:10px' }, el('a.btn.ghost.sm', { href: '#handins' }, 'Go to hand-ins'))))),
      el('div.card', { style: 'margin-top:14px' },
        el('div.h', el('h3', 'What you were given on paper')),
        el('div.b.flush', el('table.t', el('tbody',
          ...(t ? (CFG.BLOCK_DOCS || []) : []).map(d =>
            el('tr', el('td', d.prefix
              ? el('a', { href: d.prefix + slug(t.block) + '.pdf', target: '_blank', rel: 'noopener' }, d.name)
              : el('span', { style: 'color:var(--text-3)' }, d.name)))),
          ...CFG.DOCS.map(d =>
            el('tr', el('td', d.href
              ? el('a', { href: d.href, target: '_blank', rel: 'noopener' }, d.name)
              : el('span', { style: 'color:var(--text-3)' }, d.name)))))))),
      footnote());
  }

  /* ---------------------------------------------------------- convener */
  function gatesView() {
    const types = (D.handinTypes || []).map(typeRow).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const open = (D.reports || []).filter(r => r.state === 'open').length;

    const filter = el('input#gates-filter', { type: 'text',
      placeholder: 'a block, or a team id' });
    const grid = el('div');
    const stats = el('div.grid.g4', { style: 'margin-bottom:16px' });
    let ROWS = [];

    /* The states are drawn as colour AND shape, and the key says which is
       which.  Before this the grid was four colours with the meaning in a
       tooltip that does not exist on a phone — on the one sheet the whole
       chase runs from. */
    const KEY = [
      { cls: 'ok',   label: 'filed' },
      { cls: 'due',  label: 'due inside ten days' },
      { cls: 'late', label: 'past its date' },
      { cls: 'open', label: 'not due yet' },
      { cls: 'na',   label: 'does not apply to this team' }
    ];

    function draw() {
      const q = (filter.value || '').trim().toLowerCase();
      const teams = [];
      ROWS.forEach(r => { if (!teams.some(t => t.id === r.team_id))
        teams.push({ id: r.team_id, block: r.block, fieldwork: r.fieldwork }); });
      const shown = teams.filter(t => !q
        || t.id.toLowerCase().indexOf(q) >= 0 || (t.block || '').toLowerCase().indexOf(q) >= 0)
        .sort((a, b) => a.block === b.block ? (a.id < b.id ? -1 : 1) : (a.block < b.block ? -1 : 1));
      const cellOf = (tid, key) => {
        const r = ROWS.find(x => x.team_id === tid && x.type_key === key);
        return r || { cell: 'open' };
      };
      clear(grid).append(
        shown.length ? el('div.scroll', el('table.gates',
          el('thead', el('tr', el('th.l', 'Team'), el('th.l', 'Block'),
            ...types.map(t => el('th', { title: t.label + ' \u00b7 due ' + pretty(t.due_on) },
                                  short(t), el('div.due' + (daysTo(t.due_on) < 0 ? '.past' : daysTo(t.due_on) <= 10 ? '.soon' : ''), shortDay(t.due_on)))))),
          el('tbody', ...shown.map(tm => el('tr',
            el('td.l', tm.id),
            el('td.l', { style: 'font-family:var(--sans);font-size:12px' }, tm.block),
            ...types.map(t => {
              const r = cellOf(tm.id, t.key);
              const what = r.cell === 'na' ? 'does not apply'
                         : r.cell === 'filed' ? 'filed'
                              + (r.version > 1 ? ', v' + r.version : '')
                              + (r.penalty ? ', ' + r.penalty + ' of 20 lost' : '')
                         : r.cell === 'late' ? 'not filed, past its date'
                         : r.cell === 'due' ? 'not filed, due inside ten days'
                         : 'not filed, not due yet';
              return el('td', el('span.cell.' + (r.cell === 'filed' ? 'ok' : r.cell),
                { title: tm.id + ' \u00b7 ' + t.label + ' \u00b7 ' + what,
                  'aria-label': tm.id + ' ' + t.label + ' ' + what, role: 'img' }));
            }))))))
          : el('div.empty', ROWS.length
              ? 'No team matches “' + filter.value + '”.'
              : 'No teams yet. This fills once the register is loaded and teams are cut.'));

      const due = k => ROWS.filter(r => r.type_key === k && r.cell !== 'na').length;
      const got = k => ROWS.filter(r => r.type_key === k && r.cell === 'filed').length;
      const lateN = ROWS.filter(r => r.cell === 'late').length;
      clear(stats).append(
        el('div.stat', el('div.n', teams.length), el('div.l',
          D.profile.role === 'office' ? 'teams in the University' : 'teams in your blocks')),
        el('div.stat', el('div.n', (D.roster || []).length), el('div.l', 'students you can see')),
        el('div.stat' + (open ? '.r' : '.g'), el('div.n', open), el('div.l', 'reports waiting')),
        el('div.stat' + (lateN ? '.r' : '.g'), el('div.n', lateN),
          el('div.l', 'hand-ins past their date')));
      const tag = grid.parentNode && grid.parentNode.querySelector('.h .tag');
      if (tag) tag.textContent = types.map(t => short(t) + ' ' + got(t.key) + '/' + due(t.key)).join(' \u00b7 ');
    }
    filter.addEventListener('input', draw);

    const card = el('div.card', { style: 'margin-bottom:16px' },
      el('div.h', el('h3', 'Who has filed what'), el('span.tag', 'counting\u2026')),
      el('div.b', { style: 'padding-bottom:10px' },
        el('label.vh', { for: 'gates-filter' }, 'Filter by block or team'),
        filter,
        el('div.legend', { style: 'margin-top:10px' },
          ...KEY.map(k => el('span', el('i.cell.' + k.cls), k.label)))),
      el('div.b.flush', grid));

    API.gatesByTeam().then(rows => { ROWS = rows || []; draw(); })
      .catch(() => { ROWS = []; draw();
        clear(grid).append(el('div.empty', 'The grid did not load. Reload the page.')); });
    draw();

    return el('div',
      el('div.page-h', el('div.eyebrow', 'Conveners'), el('h1', 'The gates'),
        el('p', 'One row per team, one column per hand-in. This is the sheet the chasing runs from, '
          + 'and it is counted by the database rather than by your phone.')),
      el('div#flash'), stats, card,
      el('div.card',
        el('div.h', el('h3', 'Reports from students'), el('span.tag', open + ' open')),
        el('div.b.flush', (D.reports || []).length ? el('table.t',
          el('thead', el('tr', el('th', 'Team'), el('th', 'About'), el('th', 'What was said'), el('th', ''))),
          el('tbody', ...(D.reports || []).map(r => el('tr',
            el('td.n', r.team_id),
            el('td', API.nameOf ? API.nameOf(r.about_roll) : r.about_roll),
            el('td', r.body, el('div', { style: 'color:var(--text-3);font-size:11.5px;margin-top:3px' },
              stamp(r.created_at, { dateStyle: 'medium' }))),
            el('td', { style: 'text-align:right' }, r.state === 'open'
              ? el('button.btn.ghost.sm', { onclick: () => confirmThen('Mark this handled?',
                  'It leaves the queue and the student is not told anything by the portal. '
                  + 'Speak to them first if you have not.', 'Mark handled',
                  () => guard(async () => {
                    await API.resolveReport(r.id, 'seen by convener');
                    toast('Marked as handled.'); refresh(); })) }, 'Mark handled')
              : el('span.pill.ok', r.state))))))
          : el('div.empty', 'Nothing reported. This queue is private to you and the office.'))),
      footnote());
  }

  /* ---------------------------------------------------------- the team board */
  /* One row per team, one glance: project, prediction, ethics, plan, charter,
     field plan, weekly check, Folio.  Tap a row for the convener's actions —
     every one of them is a database function that refuses anybody else. */
  function teamsView() {
    const box = el('div');
    const filter = el('input#board-filter', { type: 'text', placeholder: 'a block, a team id, a name, or "stuck"' });
    let ROWS = [];
    const curSession = () => { const T = today(); const r = (D.sessions || []).map(sessionRow).filter(x => x.starts <= T).slice(-1)[0]; return r ? r.n : 3; };
    const tick = (on, acc) => el('i.tick' + (acc ? '.acc' : on ? '.ok' : '.no'), { title: acc ? 'accepted' : on ? 'filed' : 'not filed' });
    function draw() {
      const q = (filter.value || '').trim().toLowerCase();
      const rows = ROWS.filter(r => !q || q === 'stuck' && (r.stuck || []).length || q === 'todo' && (r.todo || []).length
        || [r.team_id, r.block, r.name, r.project_title].join(' ').toLowerCase().indexOf(q) >= 0)
        .sort((a, b) => a.block === b.block ? (a.team_id < b.team_id ? -1 : 1) : (a.block < b.block ? -1 : 1));
      clear(box).append(rows.length ? el('div.scroll', el('table.board',
        el('thead', el('tr', el('th', 'Team'), el('th', X('sequence', 'Project')), el('th', X('prediction', 'Prediction')), el('th', X('tier', 'Ethics')),
          el('th', X('plan', 'Plan')), el('th', X('charter', 'Charter')), el('th', X('field', 'Field')), el('th', X('folio', 'Folio')), el('th', X('weekly_check', 'Check')), el('th', X('board', 'Stuck / to do')))),
        el('tbody', ...rows.map(r => el('tr.pick', { onclick: () => actions(r), tabindex: '0', onkeydown: e => { if (e.key === 'Enter') actions(r); } },
          el('td.n', { 'data-label': 'Team' }, r.team_id, r.name ? el('div', { style: 'font-family:var(--sans);font-size:11.5px;color:var(--text-2)' }, r.name) : null,
            el('div', { style: 'font-family:var(--sans);font-size:11px;color:var(--text-3)' }, r.block)),
          el('td', { 'data-label': 'Project' }, r.project_title || r.project_custom || el('span', { style: 'color:var(--text-3)' }, 'none'),
            r.project_state ? el('div', el('span.pill.' + (r.project_state === 'approved' ? 'ok' : r.project_state === 'returned' ? 'late' : 'due'), r.project_state)) : null,
            r.tier3_expected ? el('div', el('span.pill.late', 'Tier 3 expected')) : null),
          el('td', { 'data-label': 'Prediction' }, r.prediction_opened_on ? 'opened ' + shortDay(r.prediction_opened_on) : r.prediction_sealed_on ? 'sealed ' + shortDay(r.prediction_sealed_on) : el('span', { style: 'color:var(--text-3)' }, '—')),
          el('td', { 'data-label': 'Ethics' }, r.ethics_tier == null ? (r.ethics_in ? el('span.pill.due', 'sheet in, no tier') : el('span', { style: 'color:var(--text-3)' }, '—'))
            : el('span.pill.' + (['cleared', 'cleared_conditions'].indexOf(r.ethics_status) >= 0 ? 'ok' : r.ethics_status === 'not_cleared' ? 'late' : 'due'),
                'T' + r.ethics_tier + ' ' + (r.ethics_status ? ETHICS_WORD[r.ethics_status] : 'not cleared'))),
          el('td', { 'data-label': 'Plan' }, tick(r.plan_in)), el('td', { 'data-label': 'Charter' }, tick(r.charter_in)),
          el('td', { 'data-label': 'Field' }, r.fieldwork ? tick(r.field_in, r.field_accepted) : el('span', { style: 'color:var(--text-3)' }, 'n/a')),
          el('td', { 'data-label': 'Folio' }, tick(r.folio_in)),
          el('td', { 'data-label': 'Check' }, r.last_check_n ? 'S' + ((D.sessions || []).map(sessionRow).find(x => x.n === r.last_check_n) || { label: '' }).label.replace(/\D/g, '') : el('span', { style: 'color:var(--text-3)' }, '—')),
          el('td', { 'data-label': 'Stuck / to do' }, (r.stuck || []).length ? el('div.stuck', (r.stuck || []).join(' · ')) : null,
                   (r.todo || []).length ? el('div.todo2', (r.todo || []).join(' · ')) : null,
                   !(r.stuck || []).length && !(r.todo || []).length ? el('span.pill.ok', 'on track') : null))))))
        : el('div.empty', ROWS.length ? 'No team matches.' : 'No teams to show yet.'));
    }
    filter.addEventListener('input', draw);

    function actions(r) {
      const T = today();
      const hin = k => (D.handins || []).filter(h => h.team_id === r.team_id && h.type_key === k).sort((a, b) => b.version - a.version)[0];
      const field = hin('field'), folio = hin('folio');
      const note = el('input', { type: 'text', placeholder: 'why (the team reads it)' });
      const name = el('input', { type: 'text', value: r.name || '', placeholder: 'team name', maxlength: 40 });
      const tier = el('select', el('option', { value: '' }, 'tier not set'), ...[1, 2, 3].map(n => el('option', { value: n, selected: r.ethics_tier === n }, 'Tier ' + n)));
      const status = el('select', el('option', { value: '' }, 'not cleared yet'),
        ...Object.entries(ETHICS_WORD).map(([k, v]) => el('option', { value: k, selected: r.ethics_status === k }, v)));
      const enote = el('input', { type: 'text', value: r.ethics_note || '', placeholder: 'conditions, or a note' });
      const sess = el('select', ...(D.sessions || []).map(sessionRow).filter(x => /^session/i.test(x.label || '') && x.starts <= T).map(x => el('option', { value: x.n, selected: x.n === curSession() }, x.label)));
      const Q = [['on_plan', 'Did you go where the plan says?', true], ['went_alone', 'Did anyone go alone?', false], ['incident', 'Anything at all happen?', false],
                 ['uneasy', 'Is anyone in the team uncomfortable about this site?', false], ['consent_ok', 'Consent forms counted, and their place known?', true]];
      const qs = {}; Q.forEach(([k, q, dflt]) => { qs[k] = el('input', { type: 'checkbox' }); qs[k].checked = dflt; });
      const logLine = el('textarea', { placeholder: 'two lines: the date, what was said, what you did', maxlength: 400, style: 'min-height:56px' });
      const wreason = el('input', { type: 'text', placeholder: 'the written reason (logged)' });
      const act = (label, fn, cls) => el('button.btn' + (cls || '.ghost') + '.sm', { onclick: () => guard(async () => { await fn(); toast(label + ' — done.'); close(); refresh(); }) }, label);
      const sec = (title, key, ...kids) => el('div', { style: 'padding:10px 0;border-bottom:1px solid var(--rule)' }, el('div', { style: 'font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px' }, key ? X(key, title) : title), ...kids);
      const close = modal(r.team_id + (r.name ? ' · ' + r.name : '') + ' · ' + r.block, el('div',
        sec('Project', 'choice_state',
          el('div', { style: 'font-size:13.5px;margin-bottom:6px' }, r.project_title || r.project_custom || 'no project chosen yet', r.patch ? ' · ' + r.patch : '',
            r.project_state ? el('span.pill.' + (r.project_state === 'approved' ? 'ok' : r.project_state === 'returned' ? 'late' : 'due'), { style: 'margin-left:6px' }, r.project_state) : null),
          r.project_note ? el('div.hint', 'note: ' + r.project_note) : null,
          (r.project_title || r.project_custom) ? el('div', { style: 'display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:6px' },
            r.project_state !== 'approved' ? act('Approve', () => API.decideProject(r.team_id, 'approve', note.value), '') : null,
            act('Return', () => API.decideProject(r.team_id, 'return', note.value)), note) : null,
          el('div', { style: 'display:flex;gap:7px;align-items:center;margin-top:8px' }, name, act('Name', () => API.setTeamName(name.value, r.team_id)))),
        sec('Sealed prediction', 'prediction',
          el('div', { style: 'font-size:13px;margin-bottom:6px' }, r.prediction_opened_on ? 'opened at the first viva on ' + pretty(r.prediction_opened_on)
            : r.prediction_sealed_on ? 'sealed on ' + pretty(r.prediction_sealed_on) + ' by ' + (r.prediction_sealed_by || '') : 'not sealed yet'),
          el('div', { style: 'display:flex;gap:7px;flex-wrap:wrap' },
            !r.prediction_sealed_on ? act('Record: sealed today', () => API.sealPrediction(r.team_id, null), '') : null,
            r.prediction_sealed_on && !r.prediction_opened_on ? act('Record: opened at the first viva today', () => API.openPrediction(r.team_id, null), '') : null)),
        sec('Ethics', 'tier',
          el('div', { style: 'font-size:13px;margin-bottom:6px' }, ethicsLine(r), r.ethics_in ? '' : ' · sheet not filed yet'),
          el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:7px' }, tier, status), enote,
          el('div', { style: 'margin-top:7px' }, act('Set the tier and status', () => API.setEthics(r.team_id, tier.value || null, status.value || null, null, enote.value), '')),
          el('div.hint', 'Tier 1 and 2 you clear yourself. A Tier 3 team you file with the panel; the office records the panel’s decision.')),
        sec('Field plan and Folio', 'field',
          el('div', { style: 'display:flex;gap:7px;flex-wrap:wrap;align-items:center' },
            field ? (field.state === 'accepted' ? el('span.pill.ok', 'field plan accepted') : act('Accept the field plan', () => API.acceptHandin(field.id, 'accepted', null), '')) : el('span.pill.none', r.fieldwork ? 'no field plan filed' : 'no fieldwork'),
            folio ? (folio.state === 'accepted' ? el('span.pill.ok', 'Folio accepted') : act('Accept the Folio', () => API.acceptHandin(folio.id, 'accepted', null), '')) : el('span.pill.none', 'no Folio filed')),
          el('div.hint', 'A field plan is accepted only once the tier is cleared and the fieldwork gate is open; a Folio only with its client brief, handover page and AI declaration. The database refuses otherwise.')),
        sec('Weekly five-question check', 'weekly_check',
          el('label.f', el('span', 'Week'), sess),
          ...Q.map(([k, q]) => el('label', { style: 'display:flex;gap:8px;align-items:center;font-size:13px;margin:4px 0' }, qs[k], q)),
          logLine,
          el('div', { style: 'margin-top:7px' }, act('Log this week', () => API.logWeeklyCheck(r.team_id, +sess.value, Object.fromEntries(Q.map(([k]) => [k, qs[k].checked])), logLine.value), ''))),
        fieldSection(r), appealsSection(r), aiSection(r), reviewSection(r),
        scopeSection(r),
        sec('Late penalty on the Folio', 'waiver',
          el('div', { style: 'display:flex;gap:7px;align-items:center' }, wreason, act('Waive', () => API.waivePenalty('folio', r.team_id, null, wreason.value))),
          el('div.hint', 'Waives the Folio’s late penalty for every course marking it, with your reason logged.'))),
        c => [el('button.btn.ghost', { onclick: c }, 'Close')]);
    }

    API.board().then(rows => { ROWS = rows || []; draw(); }).catch(() => { clear(box).append(el('div.empty', 'The board did not load. Reload the page.')); });
    return el('div',
      el('div.page-h', el('div.eyebrow', 'Conveners'), el('h1', X('board', 'Your teams')),
        el('p', 'One row per team: what is chosen, sealed, cleared, filed and checked. Red is what needs somebody; amber is what waits for you. Tap a team to act.')),
      el('div#flash'), firstTimeLine(),
      noticesEditor(), mergeEditor(),
      el('div.card', el('div.h', el('h3', 'The board'), el('span.tag', el('button.btn.ghost.sm', { onclick: () => { filter.value = 'stuck'; draw(); } }, 'only the stuck'))),
        el('div.b', { style: 'padding-bottom:10px' }, el('label.vh', { for: 'board-filter' }, 'Filter the board'), filter),
        el('div.b.flush', box)),
      footnote());
  }

  /* ---------------------------------------------------------- the office: settings, closing, defences */
  function adminView() {
    const S = D.settings || {}, N = D.settingNotes || {};
    const NOTE = { menu_from: 'Session 4: the project menu.', full_from: 'Session 5: the full projects.', choice_from: 'Session 6: the final choice, the team name, the sealed prediction.',
      fieldwork_gate_date: 'No field plan is accepted before this day (AO.3).', fieldwork_gate_open: 'yes once the duty phone and the sign-out sheet exist.',
      late_week_rule: 'started = five off for every week started (one day late = 5). full = five off for every full week (one day late = 0).',
      last_acceptance_date: 'Nothing is accepted after this day.', marks_visible_to_students: 'submitted | closed | never', storage_limit_gb: '1 now; 100 on Pro from November.',
      supervision_first_n: 'first row of the sessions table that counts (3 = Session 3)', supervision_last_n: 'last row that counts (14 = Session 13)', supervision_pct: 'per cent of hours to sit the defence',
      lens_cap: 'lens notes a student writes at most', max_teams_per_project: 'register AI.3', max_upload_mb: 'largest file' };
    const keys = Object.keys(S).sort();
    const settingsCard = el('div.card', { style: 'margin-bottom:14px' },
      el('div.h', el('h3', X('settings', 'Settings')), el('span.tag', keys.length + ' rows')),
      el('div.b', ...keys.map(k => {
        const v = el('input', { type: 'text', value: S[k] || '' });
        return el('div.setrow', el('div', el('div.k', k), el('div.note', N[k] || NOTE[k] || '')), v,
          el('button.btn.ghost.sm', { onclick: () => guard(async () => { await API.setSetting(k, v.value); toast(k + ' changed.'); refresh(); }) }, 'Save'));
      })));
    const courseIn = el('input', { type: 'text', placeholder: 'course code, e.g. GBMS323', style: 'text-transform:uppercase' });
    const reason = el('input', { type: 'text', placeholder: 'reason (needed to reopen)' });
    const closedCard = el('div.card', { style: 'margin-bottom:14px' },
      el('div.h', el('h3', X('closing', 'Closing marking')), el('span.tag', (D.closed || []).length + ' closed')),
      el('div.b',
        el('div', { style: 'display:flex;gap:7px;flex-wrap:wrap;align-items:center' }, courseIn, reason,
          el('button.btn.sm', { onclick: () => guard(async () => { await API.closeMarking(courseIn.value.trim().toUpperCase(), reason.value); toast('Closed.'); refresh(); }) }, 'Close'),
          el('button.btn.ghost.sm', { onclick: () => guard(async () => { await API.reopenMarking(courseIn.value.trim().toUpperCase(), reason.value); toast('Reopened.'); refresh(); }) }, 'Reopen')),
        (D.closed || []).length ? el('div', { style: 'margin-top:8px;font-family:var(--mono);font-size:12px' }, (D.closed || []).join(' · ')) : el('div.hint', { style: 'margin-top:8px' }, 'No course is closed. Close a course once its marks are final; after that nothing in it can change.')));
    const defBox = el('div.b.flush', el('div.empty', 'Loading…'));
    API.projectStudents().then(list => {
      if (!list.length) { clear(defBox).append(el('div.empty', 'Nobody studies a course as a project.')); return; }
      clear(defBox).append(el('div.scroll', el('table.t',
        el('thead', el('tr', el('th', 'Student'), el('th', 'Courses'), el('th', X('chair', 'Chair')), el('th', ''))),
        el('tbody', ...list.map(r => {
          const chair = el('input', { type: 'text', value: r.defence ? r.defence.chair_name : '', placeholder: 'chair named by the Dean', style: 'width:150px' });
          const alum = el('input', { type: 'text', value: r.defence && r.defence.alumnus_name || '', placeholder: 'alumnus present (optional)', style: 'width:150px' });
          const exc = el('input', { type: 'text', placeholder: 'exception reason', style: 'width:150px' });
          const excCourse = el('select', ...r.courses.map(c => el('option', { value: c }, c)));
          return el('tr',
            el('td', el('b', shown(r.name, r.roll)), el('div.n', { style: 'font-size:11px' }, r.roll + (r.team_id ? ' · ' + r.team_id : ''))),
            el('td', { style: 'font-family:var(--mono);font-size:12px' }, r.courses.join(' '),
              r.exceptions.length ? el('div', el('span.pill.info', X('exception', 'exception: ' + r.exceptions.map(e => e.course).join(' ')))) : null),
            el('td', el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap' }, chair, alum,
              el('button.btn.ghost.sm', { onclick: () => guard(async () => { await API.setDefence(r.roll, chair.value, alum.value, null); toast('Recorded.'); refresh(); }) }, 'Record'))),
            el('td', el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap' }, excCourse, exc,
              el('button.btn.ghost.sm', { onclick: () => guard(async () => { await API.grantDefenceException(excCourse.value, r.roll, exc.value); toast('Exception recorded.'); refresh(); }) }, 'Exception'))));
        })))));
    }).catch(() => clear(defBox).append(el('div.empty', 'Did not load.')));
    const wBox = el('div.b.flush', el('div.empty', 'Loading…'));
    API.waivers().then(ws => {
      clear(wBox).append(ws.length ? el('table.t', el('tbody', ...ws.map(w => el('tr',
        el('td.n', w.kind + ' · ' + (w.team_id || w.roll) + (w.course ? ' · ' + w.course : '')),
        el('td', w.reason, el('div', { style: 'font-size:11.5px;color:var(--text-3)' }, stamp(w.at, { dateStyle: 'medium' }))),
        el('td', { style: 'text-align:right' }, el('button.btn.ghost.sm', { onclick: () => guard(async () => { await API.withdrawWaiver(w.id); toast('Withdrawn.'); refresh(); }) }, 'Withdraw'))))))
        : el('div.empty', 'No late penalty has been waived.'));
    }).catch(() => clear(wBox).append(el('div.empty', 'Did not load.')));
    const aBox = el('div.b.flush', el('div.empty', 'Loading…'));
    API.auditTrail(40).then(rows => {
      clear(aBox).append(rows.length ? el('table.t', el('tbody', ...rows.map(a => el('tr',
        el('td.n', { style: 'white-space:nowrap' }, stamp(a.at)), el('td.n', a.action),
        el('td', { style: 'font-size:11.5px;color:var(--text-2);word-break:break-all' }, JSON.stringify(a.detail || {}).slice(0, 160))))))
        : el('div.empty', 'Nothing yet.'));
    }).catch(() => clear(aBox).append(el('div.empty', 'Did not load.')));
    return el('div',
      el('div.page-h', el('div.eyebrow', 'Front desk'), el('h1', 'Settings and closing'),
        el('p', 'The dates and switches the rules run on, closing a course’s marking, the defence chairs the Deans name, exceptions, and waivers. Every change here is logged with who and when.')),
      el('div#flash'), firstTimeLine(), settingsCard, closedCard,
      el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', X('defence', 'Oral defences')), el('span.tag', 'one per student')), defBox),
      el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', X('waiver', 'Late penalties waived'))), wBox),
      el('div.card', el('div.h', el('h3', 'The last forty changes'), el('span.tag', 'audit')), aBox),
      footnote());
  }

  function officeView() {
    const roster = D.roster || [], teams = D.teams || [];
    const claimed = roster.filter(r => r.claimed_at).length;
    const q = el('input#reg-q', { type: 'text', placeholder: 'roll number, name or team' });
    const out = el('div.b.flush');

    /* Reissuing a slip and resetting an account are both things the sign-in
       screen promises a student the front desk can do.  Until now neither had
       a button: the office had to paste SQL into the live database, weekly. */
    function reset(r) {
      confirmThen('Reset ' + r.roll + '?',
        (hasName(r.name, r.roll) ? r.name : r.roll) + ' will be signed out, their password will stop working, and a new '
        + 'claim code will be printed on this screen for you to hand over. Anything they have '
        + 'already handed in stays exactly where it is.',
        'Reset the account',
        () => guard(async () => {
          const res = await API.resetClaim(r.roll);
          refresh();
          modal('New claim code for ' + r.roll,
            el('div',
              el('p', { style: 'margin:0 0 10px;font-size:14px' },
                'Read it to them, or write it on a slip. It is used once and it is not stored '
                + 'anywhere you can look it up again.'),
              el('div', { style: 'font-family:var(--mono);font-size:30px;font-weight:600;'
                + 'letter-spacing:.16em;text-align:center;padding:16px;background:var(--teal-l);'
                + 'border:1px solid var(--teal-e);border-radius:10px;color:var(--teal-d)' },
                res && res.code ? res.code : '\u2014'),
              el('div.hint', { style: 'margin-top:10px' },
                'They enter their roll number and this code under \u201cFirst time here\u201d, '
                + 'then choose their own password.')),
            c => [el('button.btn', { onclick: c }, 'Done')]);
        }));
    }

    function draw() {
      const t = q.value.trim().toLowerCase();
      const all = t ? roster.filter(r =>
        (r.roll + ' ' + r.name + ' ' + (r.team_id || '')).toLowerCase().includes(t)) : roster;
      const rows = all.slice(0, 200);
      clear(out).append(rows.length ? el('div.scroll', el('table.t.reg',
        el('thead', el('tr', el('th', 'Roll'), el('th', 'Name'), el('th', 'Team'),
          el('th', 'Block'), el('th', 'Account'), el('th', ''))),
        el('tbody', ...rows.map(r => el('tr',
          el('td.n', { 'data-label': 'Roll' }, r.roll),
          el('td', { 'data-label': 'Name' }, hasName(r.name, r.roll) ? r.name
            : el('span', { style: 'color:var(--text-3)' }, NO_NAME)),
          el('td.n', { 'data-label': 'Team' }, r.team_id || '\u2014'),
          el('td', { 'data-label': 'Block', style: 'font-size:12px' }, r.block || '\u2014'),
          el('td', { 'data-label': 'Account' }, r.claimed_at ? el('span.pill.ok', 'set up')
                                : el('span.pill.none', 'not yet'),
             (r.claim_tries >= 8) ? el('span.pill.late', { style: 'margin-left:5px' }, 'locked') : null),
          el('td.act', { style: 'text-align:right' },
            el('button.btn.ghost.sm', { onclick: () => reset(r) },
               r.claimed_at ? 'Reset' : 'New code')))))))
        : el('div.empty', roster.length
            ? 'Nobody on the register matches \u201c' + q.value + '\u201d.'
            : 'The register is empty. It fills when the roster is loaded.'));
      const n = out.parentNode && out.parentNode.querySelector('.reg-count');
      if (n) n.textContent = all.length > 200
        ? 'Showing the first 200 of ' + all.length + '. Narrow the search, or export the lot.'
        : all.length + (all.length === 1 ? ' person.' : ' people.');
    }
    q.addEventListener('input', draw);

    const bookings = (D.bookings || []).slice()
      .sort((a, b) => (a.starts_at || a.day || '') < (b.starts_at || b.day || '') ? -1 : 1);

    const view = el('div',
      el('div.page-h', el('div.eyebrow', 'Front desk'), el('h1', 'Everyone'),
        el('p', 'The whole register, who has set their account up, every booking, and the two '
          + 'buttons the sign-in screen promises: a new claim code, and a reset. Exports are CSV.')),
      el('div#flash'),
      el('div.grid.g4', { style: 'margin-bottom:16px' },
        el('div.stat', el('div.n', roster.length), el('div.l', 'on the register')),
        el('div.stat' + (claimed < roster.length / 2 ? '.a' : '.g'), el('div.n', claimed),
          el('div.l', 'accounts set up')),
        el('div.stat', el('div.n', teams.length), el('div.l', 'teams')),
        el('div.stat', el('div.n', (D.handins || []).length), el('div.l', 'hand-ins filed'))),
      el('div.card', { style: 'margin-bottom:16px' },
        el('div.h', el('h3', 'Search the register'), el('span.tag',
          CFG.EXPORTS === false ? 'export disabled in this preview' :
          el('button.btn.ghost.sm', { onclick: () => csv('register.csv',
            [['roll', 'name', 'team', 'block', 'account']].concat(roster.map(r =>
              [r.roll, hasName(r.name, r.roll) ? r.name : '', r.team_id || '', r.block || '',
               r.claimed_at ? 'set up' : 'not yet']))) },
            'Export CSV'))),
        el('div.b', el('label.vh', { for: 'reg-q' }, 'Search the register'), q,
          el('div.hint.reg-count', 'Showing the first 200.')), out),
      el('div.card',
        el('div.h', el('h3', 'Every booking'), el('span.tag', bookings.length + ' booked')),
        el('div.b.flush', bookings.length ? el('div.scroll', el('table.t',
          el('thead', el('tr', el('th', 'When'), el('th', 'Who'), el('th', 'Window'),
            el('th', 'What is stuck'))),
          el('tbody', ...bookings.slice(0, 300).map(b => el('tr',
            el('td.n', b.day ? pretty(b.day) + ' ' + (b.time || '') : ''),
            el('td.n', b.team_id || (API.nameOf ? API.nameOf(b.roll) : b.roll) || ''),
            el('td', { style: 'font-size:12px' }, b.window_key || ''),
            el('td', b.what_is_stuck || ''))))))
          : el('div.empty', 'No sessions booked yet. The diary opens on 5 October, and every team '
              + 'is given two automatically once the roster is in.'))),
      footnote());
    draw(); return view;
  }

  function csv(name, rows) {
    const body = rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv' }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }


  /* ---------------------------------------------------------- marking */
  const RUBRIC = [
    ['substance',    'Substance',    8, 'The question, the method, and whether the answer is actually supported'],
    ['evidence',     'Evidence',     4, 'What was gathered, how much of it, and how honestly it is reported'],
    ['integration',  'Integration',  3, 'Whether the courses are joined up or merely stapled together'],
    ['presentation', 'Presentation', 3, 'Structure, referencing, figures, and whether a stranger could follow it'],
    ['revision',     'Revision',     2, 'Evidence that it changed between the draft and the file']
  ];

  function marksView() {
    const root = el('div',
      el('div.page-h', el('div.eyebrow', 'Marking'), el('h1', X('marking_card', 'The project 30')),
        el('p', 'The team mark out of 20 is entered once and applies to everyone in the team enrolled in the course. '
          + 'The adjustment and the viva are per student. Together they make the project 30; '
          + 'the mid-term 30 and the final 40 stay in the examination system. Lens notes, vivas out of 30 and courses '
          + 'studied as a project are marked one student at a time, below the team cards. The late penalty is worked out by the database and shown beside the raw mark.')),
      el('div#flash'));
    const picker = el('div.courses'), body = el('div');
    root.append(picker, body, footnote());
    let course = marksView.course || null;
    const canMark = code => ((D.profile && D.profile.courses) || []).indexOf(code) >= 0;
    /* a card sets this the moment a box is typed in, so switching course can
       say so instead of silently throwing the work away */
    let dirty = false;

    function switchTo(code) {
      const go = () => { dirty = false; marksView.course = code; course = code; render(); };
      if (!dirty) return go();
      confirmThen('Leave without saving?',
        'You have marks on this screen that have not been saved. Moving to another course '
        + 'discards them.', 'Discard and switch', go);
    }

    function loadCourses(andTeams) {
      return API.myMarkingCourses().then(cs => {
        if (!cs.length) {
          clear(picker);
          clear(body).append(el('div.empty',
            'No course of yours marks a Folio. The list comes from the Registrar’s timetable — the '
            + 'courses printed against your name — and it is refreshed whenever that file is loaded. '
            + 'If it looks wrong, tell the front desk the same week.'));
          return;
        }
        if (!cs.some(c => c.code === course)) course = cs[0].code;
        clear(picker).append(...cs.map(c => {
          const indiv = !c.teams;                       /* lens notes, vivas out of 30, projects */
          const total = indiv ? (c.students || 0) : c.teams;
          return el('button.cbtn', {
            class: c.code === course ? 'on' : '',
            'aria-pressed': c.code === course ? 'true' : 'false',
            onclick: () => switchTo(c.code) },
            el('div.cc', c.code, c.closed ? el('span.pill.none', { style: 'margin-left:6px' }, 'closed') : null),
            el('div.ct', c.title),
            el('div.cp', el('div.bar', { title: c.done + ' of ' + total + ' submitted' },
                el('i', { style: 'width:' + (total ? Math.round(c.done / total * 100) : 0) + '%' })),
               el('span', c.done + '/' + total + (indiv ? (c.project ? ' projects' : ' students') : ' teams'))));
        }));
        if (andTeams) drawTeams();
      });
    }
    loadCourses(true);

    const exportBtn = () => el('button.btn.ghost.sm', { style: 'margin-left:auto', onclick: () => guard(async () => {
      const rows = await API.exportMarks(course);
      if (!rows.length) throw Object.assign(new Error('Nothing to export yet.'), { friendly: true });
      const cols = Object.keys(rows[0]);
      csv(course + '-marks.csv', [cols].concat(rows.map(r => cols.map(c => r[c]))));
    }) }, 'Export for Examinations');
    function drawTeams() {
      clear(body).append(el('div.empty', 'Loading…'));
      const closed = (D.closed || []).indexOf(course) >= 0;
      const co = (D.courses || []).find(c => c.code === course) || {};
      Promise.all([co.regime === 'project' ? [] : API.marksFor(course), API.individualsFor(course)]).then(([teams, people]) => {
        clear(body);
        if (closed) body.append(el('div.msg.note', el('b', 'Marking for ' + course + ' is closed. '),
          'Nothing on this screen can be changed. The office can reopen it, with a written reason.'));
        if (co.regime !== 'project') body.append(el('div.rubcap', X('rubric', 'How the 20 is split')));
        if (co.regime !== 'project') body.append(el('div.rubkey', ...RUBRIC.map(([k, label, max, what]) =>
          el('div', el('b', label, ' ', el('em', '/' + max)), el('span', what)))));
        if (teams.length) body.append(sectionForCourse(teams, course));
        if (!teams.length && !people.length) {
          body.append(el('div.empty',
            'Nobody is marked by ' + course + ' in the portal: no team’s Folio, no lens note, no project. '
            + 'The list comes from the register; if it looks wrong, tell the front desk the same week.'));
          return;
        }
        if (teams.length) {
          body.append(el('div', { style: 'display:flex;gap:9px;align-items:center;margin-bottom:10px;flex-wrap:wrap' },
            el('span', { style: 'font-size:13px;color:var(--text-2)' },
              teams.filter(x => x.submitted).length + ' of ' + teams.length + ' teams submitted'),
            exportBtn()));
          /* the queue: one chip per team; tap it to open that team's card (stage 3, register BD.8) */
          teamCard.openNext = (teams.find(x => !x.submitted) || teams[0] || {}).team_id;
          body.append(el('div.mqueue', ...teams.map(tm =>
            el('button.mq' + (tm.submitted ? '.ok' : ''), { type: 'button', title: tm.block,
              onclick: () => { const c = body.querySelector('[data-team="' + tm.team_id + '"]');
                if (!c) return; c.classList.add('open'); c.scrollIntoView({ block: 'start', behavior: 'smooth' }); } },
              el('b', tm.team_id), el('span', tm.submitted ? 'submitted' : 'to mark')))));
          teams.forEach(tm => body.append(teamCard(tm, closed)));
        }
        if (people.length) body.append(individuals(people, co, closed, !teams.length));
      }).catch(e => {
        clear(body).append(el('div.msg.err',
          'The marking for ' + course + ' did not load. ' + (e && e.message ? e.message : '')));
      });
    }

    /* ---- lens notes, vivas out of 30, and courses studied as a project ---- */
    function individuals(people, co, closed, withExport) {
      const mayMark = canMark(course) && !closed;
      const wrap = el('div', { style: 'margin-top:18px' });
      const lens = people.filter(x => x.regime === 'lens'), v30 = people.filter(x => x.regime === 'viva30'), pc = people.filter(x => x.regime === 'project');
      const numIn = (v, max, w) => { const i = el('input', { type: 'number', min: 0, max, step: 1, value: v == null ? '' : v, inputmode: 'numeric', disabled: !mayMark });
        if (w) i.style.width = w; i.addEventListener('input', () => { dirty = true; }); return i; };
      const netLine = n => n ? el('div', { style: 'font-size:12px;color:var(--text-2);margin-top:4px' },
        X('net', 'raw ' + n.raw_30 + ' · penalty ' + (n.penalty || 0) + (n.waived ? ' (waived, ' + n.penalty_due + ' was due)' : '') + ' · net ' + n.net_30 + ' of 30')) : null;
      const who = r => el('div.who', el('b', shown(r.name, r.roll)), el('span', r.roll), r.team_id ? el('span', r.team_id) : null);
      const handinLine = r => r.handin ? el('div', { style: 'font-size:12px;color:var(--text-3);margin-top:3px' },
          'v' + r.handin.version + ' · ' + stamp(r.handin.submitted_at) + (r.handin.penalty ? ' · ' + r.handin.penalty + ' late' : ''), ' ', openFile(r.handin, 'Open'))
        : el('div', { style: 'font-size:12px;color:var(--text-3);margin-top:3px' }, 'nothing handed in yet');

      if (lens.length || v30.length) {
        wrap.append(el('div.page-h', { style: 'margin:0 0 8px' }, el('div.eyebrow', X('lens', 'Lens notes')),
          el('h1', { style: 'font-size:18px' }, lens.length + (lens.length === 1 ? ' lens note' : ' lens notes') + (v30.length ? ' · ' + v30.length + ' on the viva out of 30' : '')),
          el('p', 'Students who take ' + course + ' but whose team’s Folio it does not mark. Each writes about 3,000 words on their own project from this course’s angle: the same rubric, 20 + the viva 10. '
            + 'From a student’s third lens course on there is no written piece: ' + course + ' marks their viva out of 30 instead.')));
        const card = el('div.card', el('div.b.flush', { style: 'padding:0 16px' }));
        const b = card.querySelector('.b');
        if (withExport) card.prepend(el('div.h', el('h3', 'Marks'), el('span.tag', exportBtn())));
        lens.forEach(r => {
          const m = r.lens || {}; const ins = {};
          RUBRIC.forEach(([k, , max]) => { ins[k] = numIn(m[k], max, '56px'); });
          const viva = numIn(m.viva, 10, '56px');
          const tot = el('span.tot', '—', el('small', ' / 30'));
          const why = el('input.why', { type: 'text', value: m.comment || '', placeholder: 'a line for the student (optional)', disabled: !mayMark });
          const recalc = () => { const any = RUBRIC.some(([k]) => ins[k].value !== '') || viva.value !== '';
            tot.firstChild.textContent = any ? String(RUBRIC.reduce((a, [k]) => a + (parseInt(ins[k].value, 10) || 0), 0) + (parseInt(viva.value, 10) || 0)) : '—'; };
          Object.values(ins).concat([viva]).forEach(i => i.addEventListener('input', recalc)); recalc();
          const send = submit => guard(async () => {
            const marks = Object.fromEntries(RUBRIC.map(([k]) => [k, ins[k].value])); marks.viva = viva.value; marks.comment = why.value;
            await API.saveLensMark(course, r.roll, marks, submit); dirty = false;
            toast(submit ? 'Submitted.' : 'Saved as a draft.'); loadCourses(false); drawTeams();
          });
          b.append(el('div.irow',
            el('div', who(r), handinLine(r),
              el('div.nums', ...RUBRIC.map(([k, label, max]) => el('label', label + ' /' + max, ins[k])), el('label', 'Viva /10', viva), tot),
              why, netLine(r.net)),
            el('div.act', m.submitted ? el('span.pill.ok', 'submitted') : el('span.pill.none', m.marked_at ? 'draft' : 'not marked'),
              mayMark ? el('button.btn.ghost.sm', { onclick: () => send(false) }, 'Save a draft') : null,
              mayMark ? el('button.btn.sm', { onclick: () => send(true) }, m.submitted ? 'Re-submit' : 'Submit') : null)));
        });
        v30.forEach(r => {
          const m = r.lens || {};
          const v = numIn(m.viva30, 30, '64px');
          const why = el('input.why', { type: 'text', value: m.comment || '', placeholder: 'a line for the student (optional)', disabled: !mayMark });
          const send = submit => guard(async () => {
            await API.saveLensMark(course, r.roll, { viva30: v.value, comment: why.value }, submit); dirty = false;
            toast(submit ? 'Submitted.' : 'Saved as a draft.'); loadCourses(false); drawTeams();
          });
          b.append(el('div.irow',
            el('div', who(r), el('div', { style: 'font-size:12px;color:var(--text-3);margin-top:3px' }, X('viva30', 'third lens course: the viva out of 30, no written piece')),
              el('div.nums', el('label', 'Viva /30', v)), why),
            el('div.act', m.submitted ? el('span.pill.ok', 'submitted') : el('span.pill.none', m.marked_at ? 'draft' : 'not marked'),
              mayMark ? el('button.btn.ghost.sm', { onclick: () => send(false) }, 'Save a draft') : null,
              mayMark ? el('button.btn.sm', { onclick: () => send(true) }, m.submitted ? 'Re-submit' : 'Submit') : null)));
        });
        wrap.append(card);
      }

      if (pc.length) {
        const mid = (D.choices || []).find(c => c.course === course);
        const midSel = el('select', { disabled: !mayMark },
          el('option', { value: '' }, '— not chosen yet —'),
          el('option', { value: 'paper', selected: mid && mid.midterm === 'paper' }, 'A written paper in mid-term week'),
          el('option', { value: 'plan', selected: mid && mid.midterm === 'plan' }, 'The Session 8 plan with the first 1,500 words'));
        midSel.addEventListener('change', () => guard(async () => { if (!midSel.value) return; await API.setMidterm(course, midSel.value); toast('Recorded.'); refresh(); }));
        wrap.append(el('div.page-h', { style: 'margin:18px 0 8px' }, el('div.eyebrow', X('project_course', 'Studied as a project')),
          el('h1', { style: 'font-size:18px' }, pc.length + (pc.length === 1 ? ' student' : ' students') + ' · project 30 · mid-term 30 · oral defence 40'),
          el('p', 'Each student’s own project on their Build Block problem seen through ' + course + ', about 3,000 words, due Session 13 (five of the 30 off per week late). '
            + 'The mid-term 30 stays in the University’s system; your choice of it is recorded here. The oral final 40: command 15 · defends the choices 10 · answers the unexpected 10 · presents clearly 5.')));
        const card = el('div.card', el('div.h', el('h3', X('midterm', 'Your mid-term choice')), el('span.tag', withExport ? exportBtn() : null)),
          el('div.b', el('label.f', el('span', 'The mid-term 30 for ' + course), midSel)),
          el('div.b.flush', { style: 'padding:0 16px' }));
        const b = card.querySelectorAll('.b')[1];
        const weeks = (D.sessions || []).map(sessionRow).filter(x => /^session/i.test(x.label || '') && x.n >= (+SET('supervision_first_n') || 3) && x.n <= (+SET('supervision_last_n') || 14));
        pc.forEach(r => {
          const m = r.pc || {}; const sup = r.supervision || {};
          const proj = numIn(m.project, 30, '64px');
          const why = el('input.why', { type: 'text', value: m.comment || '', placeholder: 'a line for the student (optional)', disabled: !mayMark });
          const sendP = submit => guard(async () => { await API.savePcProject(course, r.roll, proj.value, why.value, submit); dirty = false;
            toast(submit ? 'Project mark submitted.' : 'Saved as a draft.'); loadCourses(false); drawTeams(); });
          /* the supervision log: tap a week to cycle held → not held → clear */
          const grid = el('div.sup', ...weeks.map(w => {
            const row = (r.log || []).find(x => x.session_n === w.n);
            const cls = !row ? '' : row.held ? (row.confirmed ? '.held' : '.held.unc') : '.missed';
            const started = w.starts <= today();
            return el('button' + cls, { type: 'button', disabled: !mayMark || !started,
              title: w.label + (row ? (row.held ? (row.confirmed ? ' · held, confirmed by the student' : ' · held, not yet confirmed') : ' · not held') : started ? ' · tap: held' : ' · not begun'),
              onclick: () => guard(async () => {
                const next = !row ? true : row.held ? false : null;
                await API.logSupervision(course, r.roll, w.n, next, null); toast(next === null ? 'Cleared.' : next ? 'Held.' : 'Not held.'); drawTeams();
              }) }, el('span', 'S' + w.label.replace(/\D/g, '')), el('small', !row ? '—' : row.held ? (row.confirmed ? '✓' : 'held') : 'no'));
          }));
          const oral = {}; Object.entries({ command: 15, defends: 10, unexpected: 10, presents: 5 }).forEach(([k, max]) => { oral[k] = numIn(m[k], max, '56px'); if (!sup.may_sit) oral[k].disabled = true; });
          const otot = el('span.tot', m.command == null ? '—' : String(m.command + m.defends + m.unexpected + m.presents), el('small', ' / 40'));
          Object.values(oral).forEach(i => i.addEventListener('input', () => { const any = Object.values(oral).some(x => x.value !== '');
            otot.firstChild.textContent = any ? String(Object.values(oral).reduce((a, x) => a + (parseInt(x.value, 10) || 0), 0)) : '—'; }));
          const owhy = el('input.why', { type: 'text', value: m.oral_comment || '', placeholder: 'the panel’s note (optional)', disabled: !mayMark || !sup.may_sit });
          const sendO = submit => guard(async () => { const sc = Object.fromEntries(Object.entries(oral).map(([k, i]) => [k, i.value])); sc.comment = owhy.value;
            await API.savePcDefence(course, r.roll, sc, submit); dirty = false; toast(submit ? 'Defence score submitted.' : 'Saved as a draft.'); loadCourses(false); drawTeams(); });
          b.append(el('div.irow',
            el('div', who(r), handinLine(r),
              el('div', { style: 'margin-top:10px' }, el('b', { style: 'font-size:12.5px' }, X('pcproj', 'The project 30'))),
              el('div.nums', el('label', 'Project /30', proj)), why, netLine(r.net),
              el('div', { style: 'margin-top:12px' }, el('b', { style: 'font-size:12.5px' }, X('supervision', 'Supervision hours')), ' ',
                el('span.pill.' + (sup.may_sit ? 'ok' : 'due'), (sup.held || 0) + ' of ' + (sup.expected || weeks.length) + ' held · ' + (sup.pct || 0) + '%'
                  + (sup.held && !sup.signed ? ' · not all confirmed' : '') + (sup.excepted ? ' · office exception' : ''))),
              grid,
              el('div', { style: 'margin-top:12px' }, el('b', { style: 'font-size:12.5px' }, X('defence', 'The oral defence 40')), ' ',
                r.defence ? el('span.pill.info', X('chair', 'chair: ' + r.defence.chair_name) , r.defence.alumnus_name ? ' · alumnus present: ' + r.defence.alumnus_name : '') : el('span.pill.none', 'chair not named yet'),
                !sup.may_sit ? el('span.pill.late', { style: 'margin-left:6px' }, 'score page locked — below ' + (SET('supervision_pct') || 80) + '% or unsigned') : null),
              el('div.nums', el('label', 'Command /15', oral.command), el('label', 'Defends /10', oral.defends), el('label', 'Unexpected /10', oral.unexpected), el('label', 'Presents /5', oral.presents), otot),
              owhy),
            el('div.act', m.project_submitted ? el('span.pill.ok', 'project submitted') : el('span.pill.none', 'project not submitted'),
              m.oral_submitted ? el('span.pill.ok', 'defence submitted') : null,
              mayMark ? el('button.btn.ghost.sm', { onclick: () => sendP(false) }, 'Save project') : null,
              mayMark ? el('button.btn.sm', { onclick: () => sendP(true) }, 'Submit project') : null,
              mayMark && sup.may_sit ? el('button.btn.sm', { onclick: () => sendO(true) }, 'Submit defence') : null)));
        });
        wrap.append(card);
      }
      return wrap;
    }

    function teamCard(tm, closed) {
      const rub = {}, mem = [];
      const totals = [];
      /* Marks are the course teacher's.  The office and a convener read this
         card; they never write it (save_marks() refuses them, db/12), so the
         boxes are shut and the buttons are not drawn.  A closed course is shut for everybody. */
      const mayMark = canMark(course) && !closed;
      const num = (v, min, max, w) => {
        const i = el('input', { type: 'number', min, max, step: 1, value: v === '' ? '' : v,
                                inputmode: 'numeric', disabled: !mayMark });
        if (w) i.style.width = w;
        i.addEventListener('input', () => { dirty = true; recalc(); });
        return i;
      };
      function folio() {
        return RUBRIC.reduce((s, [k]) => s + (parseInt(rub[k].value, 10) || 0), 0);
      }
      function recalc() {
        // An untouched team reads as a dash, not as a mark of zero.
        const rubTouched = RUBRIC.some(([k]) => rub[k].value !== '');
        const f = folio();
        card.querySelector('[data-folio]').textContent = rubTouched ? f : '—';
        mem.forEach((m, i) => {
          const touched = rubTouched || m.viva.value !== '';   /* m.part went with participation (AG.2) */
          const adj = parseInt(m.adj.value, 10) || 0;
          /* the reason is not optional once the mark has moved: the rule is
             ±3 ON THE EVIDENCE, and the database refuses a save without it */
          m.why.hidden = adj === 0;
          m.why.required = adj !== 0;
          if (!touched) { totals[i].textContent = '—'; totals[i].style.color = 'var(--text-3)'; return; }
          /* the Folio 20 ± 3 stays inside 0–20, then the viva (mark_total, db/15) */
          const own = Math.max(0, Math.min(20, f + adj));
          const capped = own + (parseInt(m.viva.value, 10) || 0);
          totals[i].textContent = capped;
          totals[i].title = f + adj > 20
            ? (f + adj) + ' before the cap. The Folio 20 and the ±3 stay inside 20; the viva is added to that.'
            : capped + ' of 30';
          totals[i].style.color = f + adj > 20 ? 'var(--amber)' : '';
        });
      }
      RUBRIC.forEach(([k, , max]) => { rub[k] = num(tm.rubric[k], 0, max); });

      const rows = tm.members.map(m => {
        const adj = num(m.adjustment, -3, 3), viva = num(m.viva, 0, 10);
        const why = el('input.why', { type: 'text', value: m.comment || '',
          placeholder: 'why — the viva, or the charter', hidden: true, disabled: !mayMark });
        why.addEventListener('input', () => { dirty = true; });
        const t40 = el('div.t40', { 'data-label': 'Project /30' }, '\u2014');
        totals.push(t40); mem.push({ roll: m.roll, adj, viva, why });
        return el('div.mrow',
          el('div.who', el('b', shown(m.name, m.roll)), el('span', m.roll),
            m.net ? el('span', { style: 'display:block;font-family:var(--sans);font-size:11px;color:var(--text-2)' },
              'net ' + m.net.net_30 + (m.net.penalty ? ' · ' + m.net.penalty + ' late' : '') + (m.net.waived ? ' · waived' : '')) : null),
          /* the header row is hidden on a phone, so each cell carries its own
             label — see the note in app.css */
          el('div.cell-w', { 'data-label': 'Adj ±3' }, adj),
          el('div.cell-w', { 'data-label': 'Viva /10' }, viva),
          t40, why);
      });

      const collect = () => ({
        rubric: Object.fromEntries(RUBRIC.map(([k]) => [k, rub[k].value])),
        members: mem.map(m => ({ roll: m.roll,
                                 adjustment: m.adj.value === '' ? 0 : m.adj.value,
                                 viva: m.viva.value,
                                 comment: m.why.value }))
      });
      const send = submit => guard(async () => {
        const d = collect();
        const missing = d.members.find(m => Number(m.adjustment) !== 0 && !String(m.comment).trim());
        if (missing) throw Object.assign(new Error(
          'An adjustment of ' + missing.adjustment + ' for ' + missing.roll
          + ' needs a one-line reason — the viva, or the charter.'), { friendly: true });
        await API.saveMarks(course, tm.team_id, d.rubric, d.members, submit);
        dirty = false;
        toast(submit ? tm.team_id + ' submitted.'
                     : tm.team_id + ' saved as a draft. Nothing has gone to Examinations.');
        loadCourses(false); drawTeams();
      });

      /* the Folio this card is marking, so the teacher can read the thing they
         are being asked to put a number on */
      const folioFile = (D.handins || []).filter(h => h.team_id === tm.team_id && h.type_key === 'folio')
        .sort((a, b) => (b.version || 0) - (a.version || 0))[0];

      const ck = tm.checklist || {};
      const hd = el('div.hd', el('span.tid', tm.team_id), el('span.blk', tm.block),
          folioFile ? openFile(folioFile, 'Open the Folio')
                    : el('span.pill.none', 'no Folio filed yet'),
          folioFile && folioFile.penalty
            ? el('span.pill.late', folioFile.penalty + ' of 20 late penalty') : null,
          folioFile ? el('span.pill.' + (ck.brief && ck.handover && ck.ai ? 'ok' : 'due'),
            X('folio', ck.brief && ck.handover && ck.ai ? 'brief, handover, AI note in' : 'missing: ' + [['brief', 'client brief'], ['handover', 'handover page'], ['ai', 'AI note']].filter(x => !ck[x[0]]).map(x => x[1]).join(', '))) : null,
          el('span.st', tm.submitted ? el('span.pill.ok', 'submitted')
                                     : el('span.pill.none', 'not submitted')),
          draftControl(tm.team_id, course, mayMark),
          aiChip(tm.team_id, course, mayMark), reviewChip(tm.team_id),
          el('span.caret', { 'aria-hidden': 'true' }));
      const tmBody = el('div.tm-body',
        el('div.rub',
          ...RUBRIC.map(([k, label, max]) => el('label', el('span', label + ' /' + max), rub[k])),
          el('div.tot', el('span', { 'data-folio': true }, '0'), el('em', ' / 20'))),
        el('div.mrow.head', el('div', 'Student'), el('div', X('adjustment', 'Adj ±3')), el('div', 'Viva /10'),
           el('div', { style: 'text-align:right' }, X('project30', '/30'))),
        ...rows,
        mayMark ? el('div.mark-foot',
          el('button.btn.ghost.sm', { onclick: () => send(false) }, 'Save a draft'),
          el('button.btn.sm', { onclick: () => send(true) },
             tm.submitted ? 'Re-submit' : 'Save and submit'),
          el('span.sp', 'A draft may have blanks in it and goes nowhere near Examinations. '
            + 'Submitting marks the team done and puts it in the export; you can still re-submit, '
            + 'and every change is recorded.'))
        : el('div.mark-foot', el('span.pill.none', closed ? 'closed' : 'read only'),
          el('span.sp', closed ? 'The office has closed marking for ' + course + '. Nothing on this card can change.'
            : 'Only the teacher of ' + course + ' enters or changes these marks. '
            + 'You can read them; nothing on this card can be saved from your account.')));
      const card = el('div.card.team-mark' + (teamCard.openNext === tm.team_id ? '.open' : ''), { 'data-team': tm.team_id }, hd, tmBody);
      /* on a phone the header folds the card; a tap on a button or link inside it keeps its own job */
      hd.addEventListener('click', e => { if (e.target.closest('button,a,input,.xp')) return; card.classList.toggle('open'); });
      recalc();
      return card;
    }
    return root;
  }

  /* ---------------------------------------------------------- moderation */
  function moderationView() {
    const root = el('div',
      el('div.page-h', el('div.eyebrow', X('moderation', 'Moderation')), el('h1', 'Where courses disagree'),
        el('p', 'The same Folio is marked by up to eight courses. A spread of four marks or more out of 20 '
          + 'is the trigger — it does not mean anyone is wrong, it means the file is worth a second look.')),
      el('div#flash'));
    const box = el('div'); root.append(box, footnote());

    Promise.all([API.moderation(), API.dash()]).then(([rows, dd]) => {
      const sum = dd && dd.moderation;
      const flagged = rows.filter(r => r.spread >= 4);
      clear(box).append(
        el('div.grid.g4', { style: 'margin-bottom:16px' },
          el('div.stat', el('div.n', rows.length), el('div.l', 'Folios with a mark so far')),
          el('div.stat' + (flagged.length ? '.a' : '.g'), el('div.n', flagged.length),
            el('div.l', 'at or over the four-mark spread')),
          el('div.stat', el('div.n', rows.length ? Math.max(...rows.map(r => r.spread)) : '—'),
            el('div.l', 'widest disagreement')),
          /* the cohort mean is counted over students in the database.  The
             browser used to average the team averages, which is a different
             number as soon as teams differ in size — and it is the number a
             sceptical Council member is most likely to check. */
          el('div.stat', el('div.n', sum && rows.length ? sum.mean_20 : '—'),
            el('div.l', sum && rows.length ? 'mean Folio mark of 20 · sd ' + sum.sd_20
                                           : 'mean Folio mark out of 20 · fills from Session 13'))),
        moderationRecord(),
        el('div.card', { style: 'margin-bottom:16px' },
          el('div.h', el('h3', 'Every marked team, widest first'),
            el('span.tag', 'the tick is the mean')),
          el('div.b', spreadStrip(rows, r => {
            modal('Team ' + r.team_id,
              el('div',
                el('p', { style: 'margin:0 0 12px;font-size:14px;line-height:1.55' },
                  r.marking_courses + ' courses have marked this Folio. They range from '
                  + r.low + ' to ' + r.high + ' out of 20, a spread of ' + r.spread
                  + ', with a mean of ' + r.mean + '.'),
                el('p', { style: 'margin:0;font-size:13.5px;line-height:1.55;color:var(--text-2)' },
                  r.spread >= 4
                    ? 'That reaches the trigger. Sample the Folio yourself, and if the courses '
                      + 'still disagree by four or more, order a re-mark in writing. You never '
                      + 'change a mark; the course teacher does.'
                    : 'That is inside the trigger. Nothing is required.')),
              c => [el('button.btn.ghost', { onclick: c }, 'Close')]);
          }))),

        el('div.card', el('div.h', el('h3', 'The same thing as a table')),
          el('div.b.flush', rows.length ? el('div.scroll', el('table.t',
            el('thead', el('tr', el('th', 'Team'), el('th', 'Courses marking'), el('th', 'Low'),
              el('th', 'High'), el('th', 'Mean'), el('th', 'Spread'))),
            el('tbody', ...rows.map(r => el('tr',
              el('td.n', r.team_id), el('td.n', r.marking_courses), el('td.n', r.low),
              el('td.n', r.high), el('td.n', r.mean),
              el('td.n', r.spread >= 4 ? el('span.pill.late', r.spread)
                                      : el('span.pill.ok', r.spread)))))))
            : el('div.empty', 'Nothing marked yet. This screen fills from Session 13, when the '
                + 'Folios are in and the courses start entering their twenties.'))));
    }).catch(() => {
      clear(box).append(el('div.msg.err', 'Moderation did not load. Reload the page.'));
    });
    return root;
  }

  /* ---------------------------------------------------------- routing */
  /* ==================================================================
     The moving ground, the dashboards and the explainer.
     Added 10 September 2026.

     Everything a person needs in order to understand the programme is
     in guide.js, keyed by role. Nothing below invents a fact: it lays
     out what that file says next to what the database says, so that
     "what you can do" and "what needs doing now" are on the same screen
     as the buttons that do it.
     ================================================================== */

  const GUIDE = () => window.GW_GUIDE || null;
  const TABNAME = { desk: 'The desk', review: 'The Karachi Review', viva: 'Viva day', trackers: 'Trackers', home: 'Home', handins: 'Hand-ins', diary: 'Book a session', team: 'My team',
                    gates: 'The gates', marks: 'Marking', moderation: 'Moderation',
                    office: 'Everyone', guide: 'How this works', teams: 'Teams', admin: 'Settings' };
  const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6,
                   august: 7, september: 8, october: 9, november: 10, december: 11 };

  /* "Saturday 17 October", "Session 3 · 21–26 September", "By 31 December"
     all resolve to the LAST date named, which is the one that bites.
     Anything with no date in it — "First sign-in", "Continuously" — gets
     null, and then no countdown is drawn rather than one being invented. */
  function whenDate(s) {
    if (!s) return null;
    const re = /(\d{1,2})\s*(?:[–—-]\s*(\d{1,2}))?\s+([A-Za-z]+)/g;
    let m, last = null;
    while ((m = re.exec(s))) {
      const mo = MONTHS[(m[3] || '').toLowerCase()];
      if (mo === undefined) continue;
      last = { d: Number(m[2] || m[1]), mo: mo };
    }
    if (!last) return null;
    const y = last.mo <= 5 ? 2027 : 2026;      /* the term runs September to December */
    return y + '-' + String(last.mo + 1).padStart(2, '0') + '-' + String(last.d).padStart(2, '0');
  }
  const roleKey = () => {
    const r = D && D.profile ? D.profile.role : 'student';
    return (GUIDE() && GUIDE().roles[r]) ? r : 'student';
  };

  /* ------------------------------------------------------------- hero band */
  function hero(o) {
    const band = el('div.hero',
      el('div.in',
        el('div.lede',
          el('div.eyebrow', o.eyebrow),
          el('h1', o.title),
          o.sub ? el('p', o.sub) : null,
          (o.chips || []).length ? el('div.chips', ...(o.chips || []).filter(Boolean).map(c =>
            el('div.chip' + (c.tone ? '.' + c.tone : ''), el('b', String(c.n)),
               c.x && EXPLAIN()[c.x] ? X(c.x, c.l) : c.l))) : null),
        (o.cta || []).length ? el('div.cta', ...(o.cta || []).filter(Boolean).map(c =>
          c.onclick ? el('button', { onclick: c.onclick }, c.label)
                    : el('a' + (c.solid ? '.solid' : ''), { href: c.href }, c.label))) : null));
    /* the canvas needs the band to have a size, so it goes on after paint */
    setTimeout(function () {
      try { if (window.GW_BG && band.isConnected) window.GW_BG.attach(band, { dark: true }); }
      catch (e) { /* a background is never worth an error */ }
    }, 0);
    return band;
  }

  /* --------------------------------------------------- the turning cards */
  /* Front: what it is. Back: what it actually means. Hover turns it on a
     mouse, tap or Enter turns it on a phone, and it is a real <button> so
     a keyboard and a screen reader both reach the back. */
  function turnCard(o) {
    const card = el('button.dcard' + (o.cls ? '.' + o.cls : ''), { type: 'button' },
      el('div.faces',
        el('div.face',
          el('div.k', o.kicker || ''),
          el('h4', o.title),
          o.when ? el('div.when', o.when) : null,
          el('div.foot', o.foot || '', el('span.turn', 'turn'))),
        el('div.face.back',
          el('div.k', o.backKicker || o.kicker || ''),
          o.backTitle ? el('h4', o.backTitle) : null,
          el('p', o.body),
          el('div.foot', o.goLabel || '', el('span.turn', 'back')))));
    card.addEventListener('click', function (e) {
      const showingBack = card.classList.contains('flip') ||
        (window.matchMedia && window.matchMedia('(hover:hover)').matches && card.matches(':hover'));
      if (o.go && showingBack) { e.preventDefault(); location.hash = o.go; render(); return; }
      card.classList.toggle('flip');
    });
    return card;
  }

  /* ------------------------------------------------ what needs doing now */
  /* The obligations come from guide.js, which is the written programme.
     Where the database knows whether a thing is done, the row says so;
     where it does not, the row is a reminder and says nothing it cannot
     support. It never claims something is finished on a guess. */
  function mustRows(role, doneOf) {
    const g = GUIDE(); if (!g || !g.roles[role]) return [];
    return g.roles[role].youMust.map(m => {
      const on = whenDate(m.by);
      const d = on ? daysTo(on) : null;
      const done = doneOf ? doneOf(m) : null;
      return { title: m.title, by: m.by, body: m.body, on: on, days: d, done: done };
    });
  }
  /* For a student the portal already knows most of this, so the list says so
     rather than reminding somebody to do a thing they did in August. Anything
     the database cannot answer is left as a plain reminder — never guessed. */
  function studentDone(m) {
    const T = (m.title || '').toLowerCase();
    if (T.indexOf('claim your account') === 0) return true;          /* they are reading this */
    if (T.indexOf('make your final choice') === 0) return !!(D.team && D.team.patch);
    if (T.indexOf('file the ethics') === 0) return !!latest('ethics');
    if (T.indexOf('file the one-page') === 0) return !!latest('plan');
    if (T.indexOf('file the field plan') === 0)
      return (D.team && !D.team.fieldwork) ? true : !!latest('field');
    if (T.indexOf('file the team charter') === 0) return !!latest('charter');
    if (T.indexOf('upload the folio') === 0) return !!(latest('folio') && latest('ai'));
    return null;
  }
  function todoList(rows, limit) {
    const live = rows.filter(r => r.done !== true);
    const soon = live.slice().sort((a, b) => {
      if (a.days == null) return 1; if (b.days == null) return -1; return a.days - b.days;
    }).slice(0, limit || 4);
    const show = soon.length ? soon : rows.slice(0, limit || 4);
    return el('div.todo', ...show.map(r => {
      const cls = r.done === true ? 'ok' : (r.days != null && r.days < 0) ? 'over'
                : (r.days != null && r.days <= 14) ? 'now' : '';
      return el('div.row' + (cls ? '.' + cls : ''),
        el('div.tick', r.done === true ? '✓' : ''),
        el('div.txt', el('b', r.title), el('span', r.body)),
        el('div.by', r.by,
          r.days != null && r.done !== true
            ? el('div', { style: 'margin-top:3px' },
                r.days < 0 ? Math.abs(r.days) + ' days past' : r.days + ' days')
            : null));
    }));
  }

  /* --------------------------------------------------- the role dashboard */
  /* Everybody who is not a student lands here. Before this screen existed a
     convener signed in and was dropped straight onto a grid of ticks with
     no statement of what the grid was for. */
  /* --------------------------------------------------- the role dashboard */
  /* Everybody who is not a student lands here.  Before this screen existed a
     convener signed in and was dropped straight onto a grid of ticks with no
     statement of what the grid was for; now the first thing on the page is the
     funnel, which is the one picture that says where the cohort has stopped. */
  function dashView() {
    const g = GUIDE(), role = roleKey(), R = g ? g.roles[role] : null;
    const teams = D.teams || [], roster = D.roster || [];
    const open = (D.reports || []).filter(r => r.state === 'open').length;
    const folio = (D.handinTypes || []).map(typeRow).find(t => t.key === 'folio');
    const folioDue = folio ? folio.due_on : null;
    const isTeacher = D.profile.role === 'teacher';
    const isOffice  = D.profile.role === 'office';
    const box = { top: el('div'), mid: el('div'), low: el('div') };

    const chips = isTeacher
      ? [{ n: '\u2026', l: 'Folios still to mark' },
         folioDue ? { n: daysTo(folioDue), l: 'days to the Folio',
                      tone: daysTo(folioDue) < 14 ? 'warn' : '' } : null]
      : [{ n: teams.length, l: teams.length === 1 ? 'team' : 'teams' },
         { n: '\u2026', l: 'waiting for you' },
         { n: roster.length, l: 'students' },
         open ? { n: open, l: open === 1 ? 'report waiting' : 'reports waiting', tone: 'bad' } : null,
         folioDue ? { n: daysTo(folioDue), l: 'days to the Folio',
                      tone: daysTo(folioDue) < 14 ? 'warn' : '' } : null];

    const first = isTeacher ? 'marks' : isOffice ? 'office' : 'gates';
    const firstLabel = isTeacher ? 'Go to marking' : isOffice ? 'Open the register' : 'Open the gates';

    /* the name goes in as it is held, never cut into a first name: the
       register carries "Dr Uzma Qazi" and "Front desk" alike */
    const tile = c => { if (!c) return null;
      const t = el(c.go ? 'a.stat' : 'div.stat', { href: c.go || null, class: c.tone === 'bad' ? 'r' : c.tone === 'warn' ? 'a' : '' },
        el('div.n', { 'data-left': c.l === 'Folios still to mark' ? '' : null, 'data-wait': c.l === 'waiting for you' ? '' : null }, String(c.n)), el('div.l', c.l));
      return t; };
    const goOf = l => /waiting/.test(l) ? '#teams' : /report/.test(l) ? '#teams' : /team/.test(l) ? '#teams' : /student/.test(l) ? (isOffice ? '#office' : '#teams') : /Folio/.test(l) ? '#marks' : null;
    const root = el('div',
      el('section.now.staff',
        el('div.hi-line', el('h1', D.profile.name || (R ? R.label : 'Greenwich Works')),
          el('span.sub', (R ? R.label : 'Greenwich Works') + ' \u00b7 ' + CFG.TERM)),
        el('p.blurb', R ? R.blurb : (g ? g.programme.oneLine : '')),
        el('div.tiles', ...chips.filter(Boolean).map(c => tile(Object.assign({ go: goOf(c.l) }, c)))),
        el('div.cta', el('a.btn', { href: '#' + first }, firstLabel), el('a.btn.ghost', { href: '#guide' }, 'How this works'))),
      el('div#flash'),
      el('div.hlp-line', { role: 'note' },
        el('span', el('b', 'Not sure what to do now? '), 'Rashid Bhai already knows what your teams have filed, and what is due next.'),
        el('button.btn.sm', { type: 'button', onclick: () => helperPanel() }, 'Ask Rashid Bhai'),
        el('button.btn.ghost.sm', { type: 'button', onclick: () => walkthrough(true) }, 'Show me round')),
      box.top, box.mid,
      el('div.card.accent', { style: 'margin:14px 0' },
        el('div.h', el('h3', 'What needs doing now'),
          el('span.tag', 'from the programme calendar')),
        el('div.b', todoList(mustRows(role), 5),
          el('div', { style: 'margin-top:14px' },
            el('a.btn.ghost', { href: '#guide/you' }, 'Everything you owe, in order')))),
      box.low,
      el('div.grid.g2', { style: 'align-items:start' },
        el('div.card',
          el('div.h', el('h3', 'What is not yours to decide')),
          el('div.b', el('ul.notyours', ...(R ? R.notYours : []).slice(0, 4).map(x => el('li', x))))),
        el('div.card',
          el('div.h', el('h3', 'The programme in one line')),
          el('div.b', el('p', { style: 'margin:0;font-family:var(--serif);font-size:15px;line-height:1.6' },
            g ? g.programme.oneLine : ''),
            el('div', { style: 'margin-top:13px' },
              el('a.btn.ghost', { href: '#guide' }, 'Read the whole thing'))))),
      el('div.page-h', { style: 'margin-top:26px' },
        el('div.eyebrow', 'Your screens'), el('h1', { style: 'font-size:20px' }, 'What you can do here'),
        el('p', 'Turn a card over to see what the screen actually gives you.')),
      el('div.deck', ...(R ? R.youCan : []).map(c => turnCard({
        kicker: c.tab ? TABNAME[c.tab] || c.tab : 'not on a screen',
        title: c.title, body: c.body, go: c.tab,
        foot: c.tab ? 'what it does' : 'happens off the portal',
        goLabel: c.tab ? 'tap again to open ' + (TABNAME[c.tab] || c.tab) : ''
      }))),
      footnote());

    /* a skeleton, so the page does not jump when the numbers land */
    box.top.append(el('div.card', el('div.b', el('div.empty', 'Counting\u2026'))));
    /* "waiting for you": the teams the board marks stuck or with something to do (audit of 22 Sep, 3.1) */
    if (!isTeacher) API.board().then(rows => {
      const n = (rows || []).filter(r => (r.stuck || []).length || (r.todo || []).length).length;
      const t = root.querySelector('.tiles [data-wait]'); if (!t) return;
      t.textContent = String(n); t.closest('.stat').classList.toggle('a', n > 0);
    }).catch(() => {});

    API.dash().then(dd => {
      clear(box.top); clear(box.mid); clear(box.low);

      if (isTeacher) {
        const prog = dd.marking || [];
        const left = prog.reduce((a, r) => a + Math.max(0, (+r.teams || 0) - (+r.done || 0)), 0);
        const chip = root.querySelector('.tiles [data-left]');
        if (chip) chip.textContent = String(left);
        box.top.append(
          el('div.card.accent',
            el('div.h', el('h3', 'Folios still to mark'),
              el('span.tag', left + ' of ' + prog.reduce((a, r) => a + (+r.teams || 0), 0))),
            el('div.b', prog.length ? el('div.fnl', ...prog.filter(r => +r.teams > 0).map(r =>
                el('div.row',
                  el('div.lab', { title: r.title || r.course }, r.course),
                  el('div.track', el('i' + ((+r.done === +r.teams) ? '' : '.w'),
                     { style: 'width:' + pct(+r.done || 0, +r.teams || 1) + '%' })),
                  el('div.val', (+r.done || 0) + ' / ' + (+r.teams || 0)))))
              : el('div.empty', 'No course of yours marks a Folio yet. The list comes from the Registrar’s timetable.'),
              prog.some(r => !(+r.teams > 0)) ? el('div.hint', { style: 'margin-top:8px' },
                prog.filter(r => !(+r.teams > 0)).length + ' more of your courses set lens notes or projects rather than mark a Folio; they are on Marking.') : null,
              el('div', { style: 'margin-top:14px' }, el('a.btn', { href: '#marks' }, 'Go to marking')))));
        box.mid.append(teacherDates(),
          el('div.card', { style: 'margin-top:14px' },
            el('div.h', el('h3', 'Where your marks sit'),
              el('span.tag', 'yours against every course marking the same teams')),
            el('div.b', histChart(dd.histogram, (D.profile.courses || [])),
              el('div.hint', { style: 'margin-top:10px' },
                'Nobody is told to move a mark. It is here so that a column a mark and a half below '
                + 'everybody else is something you notice in November rather than hear about at '
                + 'moderation in December.'))));
        return;
      }

      box.top.append(
        el('div',
          el('div.card.accent', { style: 'margin-bottom:14px' },
            el('div.h', el('h3', 'Where it has stalled'),
              el('span.tag', isOffice ? 'the whole University' : 'your blocks')),
            el('div.b', funnelChart(dd.funnel,
              'Each bar counts teams that have filed. A step nobody has reached because it is not '
              + 'due for six weeks is not a problem; a step with a red bar is.'))),
          el('div.card',
            el('div.h', el('h3', 'Block by block'),
              el('span.tag', 'shaded by how many of that block\u2019s teams have filed')),
            el('div.b', blockStrip(dd.blockStrip, b => {
              location.hash = 'gates'; render();
              setTimeout(() => {
                const q = document.querySelector('#gates-filter');
                if (q) { q.value = b; q.dispatchEvent(new Event('input')); }
              }, 60);
            }),
              el('div.hint', { style: 'margin-top:10px' },
                'One row per block instead of one per team. Tap a block to open it in the gates grid.')))));

      if (!isOffice) box.mid.append(inFieldCard(), draftsCard(), hoursCard());
      if (isOffice) {
        box.mid.append(
          el('div.card', { style: 'margin-top:14px' },
            el('div.h', el('h3', 'The numbers that decide something'),
              el('span.tag', 'front desk')),
            el('div.b', gaugesFor(dd.gauges))),
          el('div.grid.g2', { style: 'margin-top:14px;align-items:start' },
            el('div.card', el('div.h', el('h3', 'Accounts claimed')),
              el('div.b', claimChart(dd.claimCurve, dd.gauges && dd.gauges.roster))),
            el('div.card', el('div.h', el('h3', 'Hand-ins per day'),
                el('span.tag', 'the last three weeks')),
              el('div.b', submissionsChart(dd.submissions)))));
      }

      if (dd.moderation) {
        box.low.append(
          el('div.card', { style: 'margin-bottom:14px' },
            el('div.h', el('h3', 'Where courses disagree'),
              el('span.tag', 'mean ' + dd.moderation.mean_20 + ' of 20 \u00b7 sd ' + dd.moderation.sd_20)),
            el('div.b',
              el('p', { style: 'margin:0 0 12px;font-size:13.5px;color:var(--text-2)' },
                dd.moderation.markings + ' markings across ' + dd.moderation.teams_marked
                + ' teams, from ' + dd.moderation.low + ' to ' + dd.moderation.high + ' out of 20.'),
              el('a.btn.ghost', { href: '#moderation' }, 'Open moderation'))));
      }
    }).catch(e => {
      clear(box.top).append(el('div.card', el('div.b',
        el('div.msg.err', 'The dashboard numbers did not load. Everything else on this screen '
          + 'works. (' + (e && e.message ? e.message : 'no detail') + ')'))));
    });

    return root;
  }

  /* -------------------------------------------------------- the explainer */
  /* The permanent answer to "what is this". Five sections; the role section
     is first and is the one that opens, because the commonest question is
     not "what is Greenwich Works" but "what am I supposed to do". */
  function guideView() {
    const g = GUIDE();
    if (!g) return el('div', el('div.page-h', el('h1', 'How this works')),
      el('div.card', el('div.b', el('div.empty', 'The explainer did not load. Reload the page.'))));
    const role = roleKey(), R = g.roles[role];
    let sec = (location.hash.split('/')[1]) || 'you';
    const box = el('div');
    const SECS = [['you', 'Your part'], ['what', 'What Greenwich Works is'], ['marks', 'How the marks work'],
                  ['when', 'The term, week by week'], ['words', 'The words we use'], ['ask', 'Questions people ask']];

    function nav() {
      return el('div.guide-nav', ...SECS.map(([k, lab]) =>
        el('button', { class: sec === k ? 'on' : '', onclick: () => { sec = k; draw(); } }, lab)));
    }
    function youSec() {
      return el('div',
        el('div.card.accent', { style: 'margin-bottom:14px' },
          el('div.h', el('h3', 'You are signed in as a ' + R.label.toLowerCase()),
            el('span.tag', D.profile.name || D.profile.roll || '')),
          el('div.b', el('p', { style: 'margin:0 0 14px;font-family:var(--serif);font-size:16px;line-height:1.6' }, R.blurb),
            el('button.btn.ghost', { onclick: () => walkthrough(true) }, 'Take the two-minute tour again'))),
        el('div.card', { style: 'margin-bottom:14px' },
          el('div.h', el('h3', 'What you must do, in order')),
          el('div.b', todoList(mustRows(role, role === 'student' ? studentDone : null), 99))),
        el('div.grid.g2',
          el('div.card', el('div.h', el('h3', 'What you can do in the portal')),
            el('div.b', el('div.todo', ...R.youCan.map(c =>
              el('div.row', el('div.tick', '·'),
                el('div.txt', el('b', c.title), el('span', c.body)),
                c.tab ? el('div.by', el('a.btn.ghost.sm', { href: '#' + c.tab }, 'open')) : null))))),
          el('div.card', el('div.h', el('h3', 'What is not yours')),
            el('div.b', el('ul.notyours', ...R.notYours.map(x => el('li', x)))))));
    }
    function whatSec() {
      return el('div',
        el('div.card.accent', { style: 'margin-bottom:14px' },
          el('div.h', el('h3', g.programme.name), el('span.tag', g.programme.term)),
          el('div.b', el('div.prose',
            ...g.programme.what.map((p, i) => el('p' + (i === 0 ? '.first' : ''), p))))),
        el('div.card',
          el('div.h', el('h3', 'The other roles')),
          el('div.b', el('div.deck', ...Object.keys(g.roles).filter(k => k !== role).map(k =>
            turnCard({ kicker: 'role', title: g.roles[k].label, body: g.roles[k].blurb,
                       foot: g.roles[k].youMust.length + ' obligations' }))))));
    }
    function marksSec() {
      const total = g.programme.marks.reduce((s, m) => s + m.marks, 0);
      const cols = ['#1e6b63', '#2f8378', '#4d7a45', '#b07d24', '#9a4426'];
      return el('div',
        el('div.card', { style: 'margin-bottom:14px' },
          el('div.h', el('h3', 'Every course, out of ' + total)),
          el('div.b',
            el('div.mbar', ...g.programme.marks.map((m, i) =>
              el('i', { style: 'flex:' + m.marks + ';background:' + cols[i % cols.length],
                        title: m.component + ' — ' + m.marks }))),
            el('div.mbar-k', ...g.programme.marks.map((m, i) =>
              el('span', el('i', { style: 'background:' + cols[i % cols.length] }),
                 m.component.replace(/ —.*/, '') + ' ' + m.marks))),
            el('div.mk', ...g.programme.marks.map(m =>
              el('div.r', el('div.m', m.marks),
                el('div.d', el('b', m.component), el('i', m.whoGives), el('p', m.note))))))),
        el('div.card', el('div.h', el('h3', 'The detail that decides arguments')),
          el('div.b', el('div.prose', el('p', g.programme.marksNote)))));
    }
    function whenSec() {
      return el('div.card',
        el('div.h', el('h3', 'The term'), el('span.tag', 'teal marks the weeks you are named in')),
        el('div.b', el('div.tl', ...g.programme.calendar.map(c => {
          const mine = (c.who || []).includes(role);
          const on = whenDate(c.dates);
          const now = on && Math.abs(daysTo(on)) <= 7;
          return el('div.e' + (now ? '.now' : mine ? '.mine' : ''),
            el('div.s', el('b', c.session), ' · ' + c.dates + (now ? ' · this week' : '')),
            el('p', c.what));
        }))));
    }
    function wordsSec() {
      return el('div.card',
        el('div.h', el('h3', 'The words we use'), el('span.tag', g.programme.vocabulary.length + ' terms')),
        el('div.b', el('dl.vocab', ...g.programme.vocabulary.map(v =>
          el('div.t', el('dt', v.term), el('dd', v.meaning))))));
    }
    function askSec() {
      const list = el('div.faq', ...R.faq.map((f, i) => {
        const q = el('div.q',
          el('button', { type: 'button' }, f.q),
          el('div.a', el('p', f.a)));
        q.querySelector('button').addEventListener('click', () => q.classList.toggle('open'));
        if (i === 0) q.classList.add('open');
        return q;
      }));
      return el('div',
        el('div.card', { style: 'margin-bottom:14px' },
          el('div.h', el('h3', 'Questions ' + R.label.toLowerCase() + 's ask')),
          el('div.b', list)),
        el('div.card', el('div.h', el('h3', 'If it is still not answered')),
          el('div.b', el('p', { style: 'margin:0;color:var(--text-2);font-size:13.5px;line-height:1.6' },
            'The front desk holds this portal, and the front desk is ' + CFG.SUPPORT + '. '
            + 'Anything about a mark goes to the course teacher; anything about a project, a team or an '
            + 'exception goes to the convener who holds your Build Block.'))));
    }
    function draw() {
      /* replaceState, not location.replace: changing the hash would fire a
         hashchange, re-render the whole tab and throw away the scroll. */
      try { history.replaceState(null, '', '#guide/' + sec); } catch (e) { /* file:// */ }
      clear(box).append(nav(), { you: youSec, what: whatSec, marks: marksSec,
                                 when: whenSec, words: wordsSec, ask: askSec }[sec]());
    }
    draw();
    return el('div',
      el('section.now.staff',
        el('div.hi-line', el('h1', g.programme.name), el('span.sub', 'How this works \u00b7 ' + CFG.TERM)),
        el('p.blurb', g.programme.oneLine),
        el('div.tiles', ...[[g.programme.marks.length, 'parts to every course mark'], [g.programme.vocabulary.length, 'terms explained'],
                            [R.youMust.length, 'things you owe']].map(([n, l]) => el('div.stat', el('div.n', String(n)), el('div.l', l))))),
      box, footnote());
  }

  /* ------------------------------------------------------ the walkthrough */
  /* Five cards on first sign-in, then never again unless it is asked for.
     Whether it has been seen is a convenience, not a record, so it lives in
     the browser and a browser that refuses to store it simply shows the tour
     once more. */
  const SEEN = 'gw.tour.v1';
  function tourSeen() { try { return !!localStorage.getItem(SEEN); } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN, '1'); } catch (e) { /* fine */ } }

  /* ============================================================ 22 September, register BF: notices, the merge page, viva day, the trackers */
  const myBlockList = () => { const p = D.profile || {}; return (D.myBlocks && D.myBlocks.length ? D.myBlocks : (p.blocks || [])).slice(); };
  const allCourseCodes = () => (D.courses || []).map(c => c.code).filter(Boolean).sort();
  function firstSentence(b) {
    const t = String(b || ''); const i = t.indexOf('. ');
    return i < 0 ? el('p', t) : el('p', el('b', t.slice(0, i + 1)), ' ' + t.slice(i + 2));
  }
  function noticeRow(n, withBlock, onWithdraw) {
    return el('div.notice', el('p', n.body),
      el('div.meta', (withBlock ? n.block + ' \u00b7 ' : '') + (n.by_name || 'your convener') + ' \u00b7 ' + stamp(n.posted_at) + (n.until ? ' \u00b7 until ' + pretty(n.until) : '')),
      onWithdraw ? el('button.btn.ghost.sm', { type: 'button', onclick: () => onWithdraw(n) }, 'Withdraw') : null);
  }
  /* the student's home: what the convener has said, newest first; nothing at all when there is nothing */
  function noticesCard() {
    const box = el('div');
    API.notices().then(rows => {
      if (!rows || !rows.length) return;
      box.append(el('div.card.notices', el('div.h', el('h3', 'From your convener'), el('span.tag', rows.length + (rows.length === 1 ? ' notice' : ' notices'))),
        el('div.b', ...rows.slice(0, 5).map(n => noticeRow(n, false, null)))));
    }).catch(() => {});
    return box;
  }
  /* the convener's Teams page: post to a block, see what stands, withdraw */
  function noticesEditor() {
    const blocks = myBlockList(); if (!blocks.length) return null;
    const sel = el('select#notice-block', ...blocks.map(b => el('option', { value: b }, b)));
    const body = el('textarea#notice-body', { maxlength: '600', placeholder: 'One notice, plain words: what, when, where. Six hundred characters at most.' });
    const until = el('input#notice-until', { type: 'date' });
    const list = el('div.b.flush');
    const withdraw = n => confirmThen('Withdraw this notice?', 'It leaves every student\u2019s home screen. The audit keeps that it was posted and withdrawn.', 'Withdraw',
      () => guard(async () => { await API.withdrawNotice(n.id); toast('Withdrawn.'); draw(); }));
    const draw = () => API.notices().then(rows => { clear(list); const mine = (rows || []).filter(n => blocks.indexOf(n.block) >= 0);
      if (!mine.length) { list.append(el('div.empty', 'Nothing posted yet. A notice reaches every student of the block on their home screen, dated and signed.')); return; }
      mine.slice(0, 20).forEach(n => list.append(noticeRow(n, blocks.length > 1, withdraw))); }).catch(() => {});
    draw();
    return el('div.card', { style: 'margin-bottom:14px' },
      el('div.h', el('h3', 'Notices to your block'), el('span.tag', 'students read these on their home screen')),
      el('div.b', el('div.nform', el('label.f', el('span', 'Block'), sel), el('label.f', el('span', 'Until (optional)'), until)), body,
        el('div', { style: 'margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap' },
          el('button.btn.sm', { type: 'button', onclick: () => guard(async () => {
            await API.postNotice(sel.value, body.value, until.value || null); body.value = ''; until.value = ''; toast('Posted.'); draw(); }) }, 'Post the notice'),
          el('span.hint', { style: 'margin:0' }, 'One way: students read it, they do not reply here. Kept, with who posted it and when.'))),
      list);
  }
  /* the merge page: the Folio's sections for a block, the convener's job two */
  function mergeEditor() {
    const blocks = myBlockList(); if (!blocks.length) return null;
    if (blocks.length <= 2) { const wrap = el('div'); blocks.forEach(b => wrap.append(mergeCard(b))); return wrap; }
    /* the office, or a convener of several blocks: one page at a time, chosen here */
    const wrap = el('div'), slot = el('div');
    const sel = el('select#merge-block', ...blocks.map(b => el('option', { value: b, selected: b === mergeEditor.block }, b)));
    sel.addEventListener('change', () => { mergeEditor.block = sel.value; clear(slot).append(mergeCard(sel.value)); });
    wrap.append(el('div.card', { style: 'margin-bottom:10px' }, el('div.b', { style: 'padding:10px 16px' }, el('label.f', { style: 'margin:0' }, el('span', 'The merge page for'), sel))), slot);
    clear(slot).append(mergeCard(mergeEditor.block || blocks[0]));
    return wrap;
  }
  function mergeCard(block) {
    const rowsBox = el('div.mrows'), meta = el('span.tag', 'not written yet');
    let rows = [];
    const codes = allCourseCodes();
    const dl = el('datalist#course-codes', ...codes.map(c => el('option', { value: c })));
    const rowEl = (r, i) => {
      const title = el('input', { type: 'text', value: r.title || '', placeholder: 'Section ' + (i + 1) + ' \u2014 its title', maxlength: '80' });
      const what = el('textarea', { placeholder: 'What goes in this section, in a sentence or two.', maxlength: '600' }); what.value = r.what_goes_in || '';
      const courses = el('input', { type: 'text', value: (r.courses || []).join(', '), placeholder: 'course codes that mark it, with commas: GBMS323, GHRW321', list: 'course-codes' });
      const keep = () => { r.title = title.value; r.what_goes_in = what.value; r.courses = courses.value.split(/[,\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean); };
      [title, what, courses].forEach(x => x.addEventListener('input', keep));
      return el('div.mrow2', el('div.mn', String(i + 1)), el('div.mf', title, what, courses),
        el('button.btn.ghost.sm', { type: 'button', title: 'Remove this section', onclick: () => { rows.splice(i, 1); paint(); } }, '\u00d7'));
    };
    const paint = () => { clear(rowsBox).append(...rows.map(rowEl)); };
    API.folioSections(block).then(got => {
      rows = (got || []).map(r => ({ n: r.n, title: r.title, what_goes_in: r.what_goes_in, courses: r.courses || [] }));
      if (got && got.length) meta.textContent = 'set by ' + (got[0].set_by_name || '') + ' \u00b7 ' + stamp(got[0].set_at);
      if (!rows.length) rows = Array.from({ length: 7 }, (_, i) => ({ n: i + 1, title: '', what_goes_in: '', courses: [] }));
      paint();
    }).catch(() => { rows = Array.from({ length: 7 }, (_, i) => ({ n: i + 1, title: '', what_goes_in: '', courses: [] })); paint(); });
    return el('div.card', { style: 'margin-bottom:14px' },
      el('div.h', el('h3', 'The merge page \u00b7 ' + block), meta, el('button.btn.ghost.sm', { type: 'button', style: 'margin-left:8px', onclick: () => printSections(block, rows.filter(r => String(r.title || '').trim())) }, 'Print')),
      el('div.b',
        el('p', { style: 'margin:0 0 10px;font-size:13.5px;color:var(--text-2);line-height:1.5' },
          'Session 7: turn what every marking course asked for into one document with a handful of sections, and say which courses mark each. Students see this page on My team; each teacher sees the section that names their course. The Folio stays 3,000 words a member however many courses mark it.'),
        dl, rowsBox,
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center' },
          el('button.btn.ghost.sm', { type: 'button', onclick: () => { if (rows.length < 9) { rows.push({ n: rows.length + 1, title: '', what_goes_in: '', courses: [] }); paint(); } } }, 'Add a section'),
          el('button.btn.sm', { type: 'button', onclick: () => guard(async () => {
            const out = rows.filter(r => String(r.title || '').trim()).map((r, i) => ({ n: i + 1, title: r.title.trim(), what_goes_in: r.what_goes_in || '', courses: r.courses || [] }));
            if (!out.length) throw Object.assign(new Error('Give at least one section a title.'), { friendly: true });
            await API.setFolioSections(block, out); toast('The merge page is saved. Students and teachers see it now.'); render(); }) }, 'Save the page'))));
  }
  /* the student's team page: the Folio's sections, if the convener has written them */
  function sectionsCard(block) {
    const box = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', 'Your Folio\u2019s sections'), el('span.tag', 'set by your convener')),
      el('div.b', el('div.empty', 'Loading\u2026')));
    const b = box.querySelector('.b');
    API.folioSections(block).then(rows => { clear(b);
      if (rows && rows.length) box.querySelector('.h').append(el('button.btn.ghost.sm', { type: 'button', style: 'margin-left:8px', onclick: () => printSections(block, rows) }, 'Print'));
      if (!rows || !rows.length) { b.append(el('p', { style: 'margin:0;font-size:13.5px;color:var(--text-2)' }, 'Your convener writes this at Session 7: one document, a handful of sections, and which courses mark each. Until then, the block brief and the rubric say what each course wants.')); return; }
      b.append(el('ol.sections', ...rows.map(r => el('li', el('b', r.title), r.what_goes_in ? el('span', r.what_goes_in) : null,
        r.courses && r.courses.length ? el('i', 'marked by ' + r.courses.join(', ')) : null)))); }).catch(() => clear(b).append(el('div.empty', 'Did not load.')));
    return box;
  }
  /* the teacher's marking screen: the section that names this course, per block */
  function sectionForCourse(teams, course) {
    const box = el('div');
    const blocks = []; teams.forEach(t => { if (t.block && blocks.indexOf(t.block) < 0) blocks.push(t.block); });
    Promise.all(blocks.map(b => API.folioSections(b).then(rows => ({ block: b, rows: (rows || []).filter(r => (r.courses || []).indexOf(course) >= 0) })).catch(() => ({ block: b, rows: [] }))))
      .then(all => { const hit = all.filter(x => x.rows.length); if (!hit.length) return;
        box.append(el('div.card', { style: 'margin-bottom:12px' }, el('div.h', el('h3', 'Your section of the Folio'), el('span.tag', 'from the convener\u2019s merge page')),
          el('div.b', el('ol.sections', ...hit.flatMap(x => x.rows.map(r => el('li', el('b', (blocks.length > 1 ? x.block + ' \u00b7 ' : '') + r.n + ' \u00b7 ' + r.title), r.what_goes_in ? el('span', r.what_goes_in) : null))))))); });
    return box;
  }
  /* the hand-ins page: the term on one line, today marked */
  function termSpine(items) {
    const types = items.map(it => it.t).filter((x, i, arr) => arr.findIndex(y => y.key === x.key) === i);
    if (!types.length) return null;
    return el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', 'Your term'), el('span.tag', items.filter(filedOf).length + ' of ' + items.length + ' filed')),
      el('div.b', spine(types), el('div', { style: 'margin-top:10px' }, el('button.btn.ghost.sm', { type: 'button', onclick: () => calendarFile(types) }, 'Add my dates to my calendar'))));
  }
  /* the teacher's dates: the three that are not the Folio */
  function teacherDates() {
    const ses = (D.sessions || []).map(sessionRow); const at = n => ses.find(x => x.n === n);
    const folio = (D.handinTypes || []).map(typeRow).find(t => t.key === 'folio');
    const rows = [[at(11), 'Draft review, in class', 'ten minutes a team: what exists, not what is planned'],
                  [folio ? { starts: folio.due_on, label: 'Session 13' } : null, 'The Folio is due', 'then the marking card opens for real'],
                  [at(14), 'Vivas, in your own class', 'three minutes a student; the sealed prediction is opened']].filter(r => r[0]);
    if (!rows.length) return null;
    return el('div.card', { style: 'margin-top:14px' }, el('div.h', el('h3', 'Your dates'), el('span.tag', 'the ones that are yours')),
      el('div.b', el('div.week', ...rows.map(([w, what, why]) => el('div.row', el('div.d', shortDay(w.starts)), el('div.w', el('b', what), el('span', why + ' \u00b7 ' + (daysTo(w.starts) < 0 ? Math.abs(daysTo(w.starts)) + ' days past' : daysTo(w.starts) + ' days')))))))); 
  }
  /* viva day: one student at a time, three minutes each */
  function vivaView() {
    const root = el('div', el('div.page-h', el('div.eyebrow', 'Session 14'), el('h1', 'Viva day'),
      el('p', 'One student at a time, three minutes each. The viva is ten marks that are the student\u2019s own; the adjustment of up to three, with its reason, goes in here too. Every save is a draft on the marking card; submit the team there when the class is over.')),
      el('div#flash'));
    const picker = el('div.courses'), teamsBox = el('div.mqueue'), stage = el('div');
    root.append(picker, teamsBox, stage, footnote());
    let course = vivaView.course || null;
    API.myMarkingCourses().then(cs => {
      const folio = (cs || []).filter(c => c.teams);
      if (!folio.length) { stage.append(el('div.empty', 'No course of yours marks a Folio.')); return; }
      if (!folio.some(c => c.code === course)) course = folio[0].code;
      clear(picker).append(...folio.map(c => el('button.cbtn', { type: 'button', class: c.code === course ? 'on' : '', onclick: () => { vivaView.course = c.code; render(); } },
        el('div.cc', c.code), el('div.ct', c.title), el('div.cp', el('span', c.done + '/' + c.teams + ' teams')))));
      loadTeams();
    }).catch(() => stage.append(el('div.empty', 'The courses did not load.')));
    function loadTeams() {
      API.marksFor(course).then(ts => {
        clear(teamsBox).append(...ts.map(t => el('button.mq' + (t.submitted ? '.ok' : ''), { type: 'button', onclick: () => open(t) }, el('b', t.team_id), el('span', t.submitted ? 'submitted' : (t.members || []).length + ' students'))));
        if (ts.length) open(ts[0]); else clear(stage).append(el('div.empty', 'No team to examine in ' + course + '.'));
      }).catch(() => clear(stage).append(el('div.empty', 'The teams did not load.')));
    }
    function open(t) {
      let i = 0; const rub = t.rubric || {};
      const marked = RUBRIC.some(([k]) => rub[k] != null && rub[k] !== '');
      const folio = RUBRIC.reduce((a, [k]) => a + (parseInt(rub[k], 10) || 0), 0);
      const mem = (t.members || []).map(m => ({ roll: m.roll, name: m.name, adjustment: m.adjustment == null ? 0 : m.adjustment, viva: m.viva == null ? '' : m.viva, comment: m.comment || '' }));
      const rubricOut = Object.fromEntries(RUBRIC.map(([k]) => [k, rub[k] == null ? '' : rub[k]]));
      let timer = null, left = 180;
      const clock = el('div.clock', '3:00');
      const show = () => { clock.textContent = Math.floor(Math.max(0, left) / 60) + ':' + String(Math.max(0, left) % 60).padStart(2, '0'); clock.classList.toggle('over', left <= 0); };
      const stop = () => { if (timer) clearInterval(timer); timer = null; startStop.textContent = left < 180 && left > 0 ? 'Resume' : 'Start the clock'; };
      const startStop = el('button.btn.sm', { type: 'button', onclick: () => { if (timer) { stop(); return; } timer = setInterval(() => { left--; show(); if (left <= 0) stop(); }, 1000); startStop.textContent = 'Pause'; } }, 'Start the clock');
      const reset = () => { stop(); left = 180; show(); startStop.textContent = 'Start the clock'; };
      function paint() {
        const m = mem[i]; if (!m) return;
        const viva = el('input#viva-mark', { type: 'number', min: 0, max: 10, step: 1, value: m.viva, inputmode: 'numeric' });
        const adj = el('select#viva-adj', ...[-3, -2, -1, 0, 1, 2, 3].map(v => el('option', { value: v, selected: Number(m.adjustment) === v }, (v > 0 ? '+' : '') + v)));
        const why = el('input#viva-why', { type: 'text', value: m.comment, placeholder: 'why \u2014 the viva, or the charter (needed when the adjustment is not 0)' });
        const keep = () => { m.viva = viva.value; m.adjustment = adj.value; m.comment = why.value; };
        const save = async () => { keep();
          const bad = mem.find(x => Number(x.adjustment) !== 0 && !String(x.comment).trim());
          if (bad) throw Object.assign(new Error('An adjustment for ' + bad.roll + ' needs a one-line reason \u2014 the viva, or the charter.'), { friendly: true });
          await API.saveMarks(course, t.team_id, rubricOut, mem.map(x => ({ roll: x.roll, adjustment: x.adjustment === '' ? 0 : x.adjustment, viva: x.viva, comment: x.comment })), false); };
        clear(stage).append(el('div.card.viva',
          el('div.h', el('h3', t.team_id + (t.block ? ' \u00b7 ' + t.block : '')), el('span.tag', (marked ? 'Folio ' + folio + ' of 20' : 'Folio not marked yet') + ' \u00b7 student ' + (i + 1) + ' of ' + mem.length)),
          el('div.b',
            el('div.vwho', el('b', shown(m.name, m.roll)), el('span', m.roll)),
            el('div.vclock', clock, startStop, el('button.btn.ghost.sm', { type: 'button', onclick: reset }, 'Reset')),
            el('div.vgrid', el('label.f', el('span', 'Viva /10'), viva), el('label.f', el('span', X('adjustment', 'Adjustment \u00b13')), adj)),
            why,
            el('div.vnav',
              el('button.btn.ghost', { type: 'button', disabled: i === 0, onclick: () => { keep(); i--; reset(); paint(); } }, 'Previous'),
              el('button.btn', { type: 'button', onclick: () => guard(async () => { await save(); reset();
                if (i < mem.length - 1) { toast('Saved as a draft.'); i++; paint(); } else { toast('Team done. Submit it on the marking card when the class is over.'); loadTeams(); } }) },
                i < mem.length - 1 ? 'Save and next' : 'Save, team done'),
              el('a.btn.ghost', { href: '#marks' }, 'Marking card')))));
        viva.focus();
      }
      paint();
    }
    return root;
  }
  /* the trackers: letters, guests, visits, alumni — one editor, four lists */
  function trackerCard(spec) {
    const card = el('div.card', { style: 'margin-bottom:16px' }, el('div.h', el('h3', spec.title), el('span.tag', spec.tag || '')), el('div.b.flush'));
    const body = card.querySelector('.b');
    const input = (f, v) => {
      if (f.type === 'select') return el('select', { 'data-k': f.k, 'aria-label': f.label }, ...f.options.map(o => el('option', { value: o[0], selected: String(v == null ? '' : v) === String(o[0]) }, o[1])));
      if (f.type === 'check') { const c = el('input', { type: 'checkbox', 'data-k': f.k, 'aria-label': f.label }); c.checked = !!v; return c; }
      return el('input', { type: f.type || 'text', 'data-k': f.k, value: v == null ? '' : v, placeholder: f.label, 'aria-label': f.label, style: f.w ? 'width:' + f.w : null });
    };
    const read = tr => { const o = {}; tr.querySelectorAll('[data-k]').forEach(x => { o[x.dataset.k] = x.type === 'checkbox' ? x.checked : x.value; }); return o; };
    function draw(rows) {
      clear(body);
      const table = el('table.t.trk', el('thead', el('tr', ...spec.fields.map(f => el('th', f.label)), el('th', ''))), el('tbody'));
      const tb = table.querySelector('tbody');
      const rowEl = r => { const tr = el('tr', ...spec.fields.map(f => el('td', { 'data-label': f.label }, input(f, r[f.k]))),
          el('td.act', spec.canWrite(r) ? el('button.btn.sm', { type: 'button', onclick: () => guard(async () => { const o = read(tr); o.id = r.id || null; await spec.save(o); toast('Saved.'); load(); }) }, r.id ? 'Save' : 'Add') : null,
            r.id && spec.canWrite(r) ? el('button.btn.ghost.sm', { type: 'button', onclick: () => confirmThen('Delete this row?', 'It leaves the list; the audit keeps that it was there.', 'Delete', () => guard(async () => { await spec.del(r.id); toast('Deleted.'); load(); })) }, 'Delete') : null));
        if (!spec.canWrite(r)) tr.querySelectorAll('input,select').forEach(x => { x.disabled = true; });
        return tr; };
      rows.forEach(r => tb.append(rowEl(r)));
      if (spec.canWrite({})) tb.append(rowEl({}));
      body.append(rows.length || spec.canWrite({}) ? el('div.scroll', table) : el('div.empty', 'Nothing here yet.'));
      if (spec.extra) body.append(el('div', { style: 'padding:10px 16px' }, spec.extra(load)));
    }
    const load = () => spec.load().then(rows => draw(rows || [])).catch(e => clear(body).append(el('div.empty', 'Did not load. ' + ((e && e.message) || ''))));
    load(); return card;
  }
  function trackersView() {
    const role = (D.profile || {}).role, office = role === 'office';
    const blocks = myBlockList(); const blockOpts = blocks.map(b => [b, b]);
    const holds = r => office || (role === 'convener' && (!r.block || blocks.indexOf(r.block) >= 0));
    const sessOpts = [['', '\u2014'], ['4', 'Session 4'], ['5', 'Session 5'], ['6', 'Session 6']];
    const root = el('div',
      el('div.page-h', el('div.eyebrow', office ? 'Front desk' : 'Conveners'), el('h1', 'Trackers'),
        el('p', office ? 'The four lists the office keeps: the letters to the public bodies, the guest speakers, the industrial visits, and the alumni for the December days. Type in a row and save it; every save is logged.'
                       : 'The letters to the public bodies (the office keeps them), and the guest speaker and the industrial visit for your own blocks, which you keep.')),
      el('div#flash'), firstTimeLine(),
      trackerCard({ title: 'Letters to the public bodies', tag: 'wave 1 by 19 Oct \u00b7 wave 2 by 2 Nov \u00b7 the Review invitation, 17 Nov',
        fields: [{ k: 'body_name', label: 'Body', w: '220px' }, { k: 'wave', label: 'Wave', type: 'select', options: [['1', '1 \u00b7 19 Oct'], ['2', '2 \u00b7 2 Nov'], ['3', '3 \u00b7 17 Nov']] },
                 { k: 'recipient', label: 'Named recipient', w: '180px' }, { k: 'sent_on', label: 'Sent', type: 'date' }, { k: 'replied_on', label: 'Replied', type: 'date' }, { k: 'note', label: 'Note', w: '160px' }],
        load: () => API.letters(), save: o => API.saveLetter(o), del: id => API.deleteTracker('letter', id), canWrite: () => office,
        extra: office ? reload => el('button.btn.ghost.sm', { type: 'button', onclick: () => guard(async () => { const n = await API.seedLetters(); toast(n + ' bod' + (n === 1 ? 'y' : 'ies') + ' added from the projects.'); reload(); }) }, 'Add every body the projects name') : null }),
      trackerCard({ title: 'Guest speakers', tag: 'one practitioner per block, Session 4, 5 or 6',
        fields: [{ k: 'block', label: 'Block', type: 'select', options: [['', '\u2014']].concat(blockOpts) }, { k: 'speaker', label: 'Speaker', w: '160px' }, { k: 'organisation', label: 'Organisation', w: '160px' },
                 { k: 'session_n', label: 'Session', type: 'select', options: sessOpts }, { k: 'on_date', label: 'Date', type: 'date' }, { k: 'confirmed', label: 'Confirmed', type: 'check' }, { k: 'note', label: 'Note', w: '140px' }],
        load: () => API.guests(), save: o => API.saveGuest(o), del: id => API.deleteTracker('guest', id), canWrite: holds }),
      trackerCard({ title: 'Industrial visits', tag: 'eight this term, between Session 9 and Session 12',
        fields: [{ k: 'block', label: 'Block', type: 'select', options: [['', '\u2014']].concat(blockOpts) }, { k: 'host', label: 'Host', w: '200px' }, { k: 'on_date', label: 'Date', type: 'date' },
                 { k: 'transport', label: 'Transport', w: '120px' }, { k: 'confirmed', label: 'Confirmed', type: 'check' }, { k: 'note', label: 'Note', w: '160px' }],
        load: () => API.visits(), save: o => API.saveVisit(o), del: id => API.deleteTracker('visit', id), canWrite: holds }),
      office ? trackerCard({ title: 'Alumni for the December days', tag: 'about 45 wanted \u00b7 the Review on 15 Dec, the viva panels on 19 Dec',
        fields: [{ k: 'name', label: 'Name', w: '160px' }, { k: 'organisation', label: 'Organisation', w: '160px' }, { k: 'invited_on', label: 'Invited', type: 'date' }, { k: 'replied', label: 'Replied', type: 'check' },
                 { k: 'coming_15dec', label: '15 Dec', type: 'check' }, { k: 'coming_19dec', label: '19 Dec', type: 'check' }, { k: 'pair_no', label: 'Pair', type: 'number', w: '64px' }, { k: 'note', label: 'Note', w: '140px' }],
        load: () => API.alumni(), save: o => API.saveAlumnus(o), del: id => API.deleteTracker('alumnus', id), canWrite: () => office }) : null,
      office ? incidentsTracker() : null,
      office ? appealsTracker() : null,
      footnote());
    return root;
  }



  /* ============================================================ 22 September, register BH: the sign-out sheet, form F2, the AI declaration, appeals, the Karachi Review */
  const ktime = iso => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: KHI, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch (e) { return ''; } };
  const kdate = iso => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: KHI }).format(new Date(iso)); } catch (e) { return ''; } };
  const overdueBy = r => r.state === 'out' ? Math.round((Date.now() - new Date(r.due_at).getTime()) / 60000) : 0;   /* minutes past due, for a line that is out */
  const KINDS = [['incident', 'Something happened'], ['near_miss', 'A near miss — nothing came of it'], ['refusal', 'A refusal that turned hostile'], ['authority', 'Approached by police, rangers or agency staff'],
                 ['injury', 'Somebody was hurt'], ['theft', 'Theft or snatching, or an attempt'], ['harassment', 'Harassment of a student'], ['overdue', 'A team not back at its time']];
  const kindLabel = k => (KINDS.find(x => x[0] === k) || [k, k])[1];
  const GRADE = { G: 'green', A: 'amber', R: 'red' };

  /* ---- the student's team page ---- */
  function fieldworkCard(t) {
    const b = el('div.b', el('div.empty', 'Loading…'));
    const card = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', X('signout', 'Going out: sign out, sign in')), el('span.tag', 'the desk signs both ends')), b);
    const draw = () => Promise.all([API.signouts(t.id).catch(() => []), API.closedSites().catch(() => [])]).then(([rows, closed]) => {
      clear(b);
      const open = (rows || []).find(r => r.state === 'filed' || r.state === 'out');
      b.append(el('p.rules', el('b', 'Never alone. Daylight only. Message out, message back. '), 'Two of you at least, three anywhere graded amber; back by 6 pm; the desk counts heads before you go. A red site is signed out on paper, with your convener’s written approval and an escort.'));
      if (open) {
        const late = overdueBy(open);
        b.append(el('div.soline' + (open.state === 'out' ? '.out' : '') + (late > 0 ? '.late' : ''),
          el('div', el('b', open.where_to + ' · ' + GRADE[open.grade]), el('div.meta', open.rolls.join(', ') + ' · due back ' + ktime(open.due_at)
            + (open.state === 'filed' ? ' · waiting at the desk: heads counted, cards and letter seen' : ' · signed out ' + ktime(open.out_at) + ' by the desk')
            + (open.reported_back_at ? ' · you said back at ' + ktime(open.reported_back_at) : ''))),
          open.state === 'out' && !open.reported_back_at ? el('button.btn.sm', { type: 'button', onclick: () => guard(async () => { await API.reportBack(open.id); toast('Told the desk: back. The desk signs you in.'); draw(); }) }, 'We are back') : null));
        if (late > 0) b.append(el('div.msg.warn', late + ' minutes past your time. Ring the duty number now; at ninety minutes this is an incident.'));
      } else {
        const where = el('input', { type: 'text', maxlength: '200', placeholder: 'street and area — “Saddar” on its own is not a destination' });
        const grade = el('select', el('option', { value: 'G' }, 'Green — pairs'), el('option', { value: 'A' }, 'Amber — three of you, convener told the day before'));
        const me = (D.me || {}).roll; const who = (D.mates || []).map(m => { const c = el('input', { type: 'checkbox', value: m.roll }); if (m.roll === me) c.checked = true;
          return el('label.chk', c, el('span', (hasName(m.name, m.roll) ? m.name : m.roll) + (m.roll === me ? ' (you)' : ''))); });
        const due = el('input', { type: 'time', value: '17:00', max: '18:00' }); const phone = el('input', { type: 'text', maxlength: '40', placeholder: 'team phone in the field' });
        b.append(el('div.soform',
          el('label.f', el('span', 'Where'), where), el('div.two', el('label.f', el('span', 'Grade, from the field plan'), grade), el('label.f', el('span', 'Back by (never after 6 pm)'), due)),
          el('div.f', el('span', 'Who is going'), el('div.chks', ...who)), el('label.f', el('span', 'Phone'), phone),
          el('button.btn.sm', { type: 'button', onclick: () => guard(async () => {
            const rolls = [...b.querySelectorAll('.chks input:checked')].map(c => c.value);
            const iso = new Date(today() + 'T' + (due.value || '17:00') + ':00+05:00').toISOString();
            await API.fileSignout(t.id, rolls, where.value, grade.value, iso, phone.value); toast('Filed. Go to the desk: it counts heads, sees your cards and the letter, and signs you out.'); draw(); }) }, 'Sign out at the desk')));
      }
      if (closed && closed.length) b.append(el('div.closedlist', el('b', 'Closed sites — no team goes: '), closed.map(c => c.location + ' (since ' + shortDay(c.closed_on) + ')').join(' · ')));
      const past = (rows || []).filter(r => r.state === 'back' || r.state === 'closed').slice(0, 5);
      if (past.length) b.append(el('div.past', el('b', 'Earlier'), ...past.map(r => el('div.meta', kdate(r.at) + ' · ' + r.where_to + ' · ' + r.rolls.length + ' of you · ' + (r.state === 'back' ? 'back ' + ktime(r.back_at) : 'closed: ' + (r.note || ''))))));
    });
    draw(); return card;
  }
  function incidentsCard(t) {
    const b = el('div.b', el('div.empty', 'Loading…'));
    const card = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', X('f2', 'Anything happen? Form F2')), el('span.tag', 'the same day, including the nothings')), b);
    const draw = () => API.incidents(t.id).then(rows => { clear(b);
      b.append(el('p', { style: 'margin:0 0 8px;font-size:13.5px;line-height:1.5' }, 'Every incident, near miss, refusal that turned hostile, or approach by anyone in authority is reported to your convener the same day — including the ones where nothing actually happened. If somebody is hurt: care first, ring 1122, then the duty number.'),
        el('button.btn.sm', { type: 'button', onclick: () => incidentModal(t.id, D.mates || [], null, null, draw) }, 'Report it — form F2'));
      if (rows && rows.length) b.append(el('div.past', { style: 'margin-top:10px' }, ...rows.map(i => el('div.notice', el('p', el('b', kindLabel(i.kind)), ' · ' + i.location + ' · ' + ktime(i.happened_at) + ' ' + shortDay(kdate(i.happened_at))),
        el('div.meta', 'filed by ' + (i.filed_name || i.filed_role) + (i.convener_signed_at ? ' · signed by your convener' : ' · waiting for your convener’s signature') + (i.received_at ? ' · received by the Registrar' : '') + (i.site_closed && !i.site_reopened_on ? ' · site closed' : ''))))));
    }).catch(() => clear(b).append(el('div.empty', 'Did not load.')));
    draw(); return card;
  }
  function incidentModal(teamId, mates, signoutId, kindDefault, after) {
    const kind = el('select', ...KINDS.map(([v, l]) => el('option', { value: v }, l))); if (kindDefault) kind.value = kindDefault;
    const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const when = el('input', { type: 'datetime-local', value: local }); const where = el('input', { type: 'text', maxlength: '200', placeholder: 'street and area' });
    const present = mates && mates.length ? el('div.chks', ...mates.map(m => el('label.chk', el('input', { type: 'checkbox', value: m.roll }), el('span', hasName(m.name, m.roll) ? m.name : m.roll))))
                                          : el('input', { type: 'text', placeholder: 'roll numbers, with commas' });
    const hurt = el('input', { type: 'checkbox' }), auth = el('input', { type: 'checkbox' }); const authWho = el('input', { type: 'text', maxlength: '120', placeholder: 'who: police, rangers, a guard…' });
    const what = el('textarea', { maxlength: '2000', placeholder: 'What happened, in your own words.', style: 'min-height:90px' });
    const action = el('input', { type: 'text', maxlength: '600', placeholder: 'action taken (left the site, rang the duty number…)' }); const to = el('input', { type: 'text', maxlength: '200', placeholder: 'reported onward to' });
    const warn = el('div.msg.warn', { style: 'display:none' });
    const paint = () => { const k = kind.value; const lines = [];
      if (k === 'injury' || hurt.checked) lines.push('Care first: 1122, then the duty number. Nobody moves an injured person; nobody films. The convener tells the Registrar within the hour.');
      if (k === 'authority' || auth.checked) lines.push('Comply, be polite, show the card and the letter, ask the officer to ring the duty number. Do not delete anything. The Registrar is told the same day.');
      if (k === 'harassment') lines.push('The team leaves the site and does not return. The convener the same day; the harassment committee within three days. The site is closed to every team until the Registrar reopens it.');
      if (k === 'theft') lines.push('Give up the phone or the bag. Move to a lit, populated place, ring the duty number; the police only with a member of staff present.');
      warn.style.display = lines.length ? '' : 'none'; clear(warn).append(...lines.map(l => el('div', l))); };
    [kind, hurt, auth].forEach(x => x.addEventListener('change', paint)); paint();
    modal('Incident form F2', el('div.f2',
      el('label.f', el('span', 'What kind'), kind), el('div.two', el('label.f', el('span', 'Date and time'), when), el('label.f', el('span', 'Location'), where)),
      el('div.f', el('span', 'Who was present'), present),
      el('div.two', el('label.chk', hurt, el('span', 'Anyone hurt?')), el('label.chk', auth, el('span', 'Police / authority involved?'))), authWho,
      el('label.f', el('span', 'What happened, in the students’ own words'), what), action, el('div', { style: 'margin-top:6px' }, to), warn),
      c => [el('button.btn.ghost', { onclick: c }, 'Not now'), el('button.btn', { onclick: () => guard(async () => {
        const rolls = present.tagName === 'INPUT' ? present.value.split(/[,\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean) : [...present.querySelectorAll('input:checked')].map(x => x.value);
        await API.fileIncident(teamId, kind.value, new Date(when.value).toISOString(), where.value, rolls, hurt.checked, auth.checked, authWho.value, what.value, action.value, to.value, signoutId);
        c(); toast('Filed. Your convener signs it; the Registrar receives it.'); if (after) after(); }) }, 'File it')], 'wide');
  }
  function appealsCard(t) {
    const b = el('div.b', el('div.empty', 'Loading…'));
    const card = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', X('appeal', 'Disagree with a ruling?')), el('span.tag', 'seven days · in writing · the programme heads')), b);
    const draw = () => API.appeals().then(rows => { clear(b);
      b.append(el('p', { style: 'margin:0 0 8px;font-size:13.5px;line-height:1.5' }, 'A ruling by your convener — a removal from the Folio, a team change, a report answered — can be appealed in writing to the programme heads within seven days. Their decision ends it. A mark is not appealed here: the University’s ordinary route applies.'),
        el('button.btn.ghost.sm', { type: 'button', onclick: () => appealModal(draw) }, 'Appeal in writing'));
      const mine = (rows || []).filter(a => a.roll === (D.me || {}).roll);
      if (mine.length) b.append(el('div.past', { style: 'margin-top:10px' }, ...mine.map(a => el('div.notice', el('p', el('b', a.ruling), ' · ruling of ' + shortDay(a.ruling_on)),
        el('div.meta', a.state === 'decided' ? 'Decided ' + shortDay(a.decided_on) + ': ' + a.outcome + ' — ' + a.decision : 'Filed ' + shortDay(kdate(a.at)) + ' · with the programme heads')))));
    }).catch(() => clear(b).append(el('div.empty', 'Did not load.')));
    draw(); return card;
  }
  function appealModal(after) {
    const on = el('input', { type: 'date', value: today(), max: today() }); const ruling = el('input', { type: 'text', maxlength: '400', placeholder: 'what was ruled, in a line' });
    const grounds = el('textarea', { maxlength: '2000', placeholder: 'why you disagree — your grounds, in writing', style: 'min-height:110px' });
    modal('Appeal to the programme heads', el('div', el('div.two', el('label.f', el('span', 'Date of the ruling'), on), el('label.f', el('span', 'The ruling'), ruling)), el('label.f', el('span', 'Your grounds'), grounds),
      el('div.hint', 'Within seven days of the ruling. Your convener reads it and writes their account; the heads decide; the office records the decision. Their decision ends it.')),
      c => [el('button.btn.ghost', { onclick: c }, 'Not now'), el('button.btn', { onclick: () => guard(async () => { await API.fileAppeal(on.value, ruling.value, grounds.value); c(); toast('Filed with the programme heads.'); if (after) after(); }) }, 'File the appeal')]);
  }
  /* ---- the AI declaration: the kit's sheet as a form ---- */
  function aiDeclarationBlock(teamId, filed) {
    const box = el('div.act.ai', el('div.empty', 'Loading…'));
    if (!teamId) { clear(box).append(el('div.hint', 'You are not in a team yet.')); return box; }
    const draw = () => API.aiDeclaration(teamId).then(({ decl, seen }) => { clear(box);
      box.append(el('p.blurb', { style: 'margin:0 0 8px' }, 'Not an upload: the sheet is signed here, for the team — which tools, what for, how you checked, what is your own, and one place a tool was wrong. It carries no marks of its own; what it protects is the credit for your work.'));
      if (decl) box.append(el('div.filed', el('span', 'Signed for the team by ' + decl.signed_name + ' · ' + stamp(decl.signed_at) + ' · v' + decl.version
        + ((seen || []).length ? ' · seen by ' + seen.map(x => x.course).join(', ') : '')), el('span', { style: 'margin-left:auto' }, el('button.btn.ghost.sm', { type: 'button', onclick: () => aiReadModal(decl, seen) }, 'Read it'))));
      box.append(el('div', { style: 'margin-top:8px' }, el('button.btn.sm', { type: 'button', onclick: () => aiDeclarationModal(teamId, decl, draw) }, decl ? 'Sign it again' : 'Sign the declaration')));
    }).catch(() => clear(box).append(el('div.empty', 'Did not load.')));
    draw(); return box;
  }
  function aiDeclarationModal(teamId, decl, after) {
    const rowsBox = el('div.airows'); let rows = decl && Array.isArray(decl.tools) && decl.tools.length ? decl.tools.map(r => Object.assign({}, r)) : [{ tool: '', used_for: '', checked: '', who: '' }];
    const rowEl = (r, i) => { const f = (k, ph) => { const x = el('input', { type: 'text', value: r[k] || '', placeholder: ph }); x.addEventListener('input', () => { r[k] = x.value; }); return x; };
      return el('div.airow', el('div.mn', String(i + 1)), f('tool', 'tool'), f('used_for', 'what you used it for'), f('checked', 'how you checked the output'), f('who', 'who on the team'),
        el('button.btn.ghost.sm', { type: 'button', title: 'Remove', onclick: () => { rows.splice(i, 1); if (!rows.length) rows.push({ tool: '', used_for: '', checked: '', who: '' }); paint(); } }, '×')); };
    const paint = () => { clear(rowsBox).append(...rows.map(rowEl)); };
    paint();
    const teamWork = el('textarea', { maxlength: '1500', placeholder: 'In your own words: the decisions, the judgement, the work that was not produced by a tool. Be specific — this is the part the viva examines.', style: 'min-height:90px' }); teamWork.value = decl ? decl.team_work : '';
    const wrong = el('textarea', { maxlength: '1000', placeholder: 'At least one example. A team that reports none is either not checking or not saying.', style: 'min-height:70px' }); wrong.value = decl ? decl.tool_wrong : '';
    const tick = el('input', { type: 'checkbox' }); const name = el('input', { type: 'text', maxlength: '120', value: (D.me || {}).name || '', placeholder: 'your name, as the register has it' });
    modal('AI declaration · ' + teamId, el('div.aiform',
      el('div.sub', 'One per team, bound into the Folio. You are expected to use AI tools on this project; this sheet is how you say what you used them for. Undeclared use is academic misconduct.'),
      el('div.k', '1 · Tools used'), rowsBox, rows.length < 8 ? el('button.btn.ghost.sm', { type: 'button', onclick: () => { if (rows.length < 8) { rows.push({ tool: '', used_for: '', checked: '', who: '' }); paint(); } } }, '+ another tool') : null,
      el('div.k', '2 · What the team did itself'), teamWork,
      el('div.k', '3 · Where a tool was wrong'), wrong,
      el('div.k', 'The declaration'), el('label.chk.decl', tick, el('span', 'We confirm that every tool we used is named above, that we checked the output before using it, and that each of us can explain and defend the work submitted. We understand that work a student cannot explain at the viva is not credited to that student, and that no real client, patient or examinee data, or anything identifying a real person, was entered into any tool.')),
      el('label.f', el('span', 'Signed for the team'), name)),
      c => [el('button.btn.ghost', { onclick: c }, 'Not now'), el('button.btn', { onclick: () => guard(async () => { await API.signAiDeclaration(rows, teamWork.value, wrong.value, tick.checked, name.value); c(); toast('Signed for the team. The Folio checklist has it.'); refresh(); if (after) after(); }) }, 'Sign it')], 'wide');
  }
  function aiReadModal(decl, seen, teamId, course, after) {
    const seenBy = (seen || []).find(x => x.course === course);
    modal('AI declaration · ' + decl.team_id, el('div.aiform',
      el('div.k', '1 · Tools used'), el('table.t.ai', el('thead', el('tr', el('th', 'Tool'), el('th', 'What for'), el('th', 'How checked'), el('th', 'Who'))),
        el('tbody', ...(decl.tools || []).map(r => el('tr', el('td', r.tool), el('td', r.used_for), el('td', r.checked), el('td', r.who))))),
      el('div.k', '2 · What the team did itself'), el('p', decl.team_work), el('div.k', '3 · Where a tool was wrong'), el('p', decl.tool_wrong),
      el('div.meta', 'Signed for the team by ' + decl.signed_name + ' · ' + stamp(decl.signed_at) + ' · v' + decl.version + ((seen || []).length ? ' · seen by ' + seen.map(x => x.course + ' (' + shortDay(kdate(x.at)) + ')').join(', ') : '')),
      course && seenBy ? el('div.msg.ok', 'Seen by ' + course + ' on ' + shortDay(kdate(seenBy.at)) + '.') : null),
      c => [el('button.btn.ghost', { onclick: c }, 'Close'), course && !seenBy ? el('button.btn', { onclick: () => guard(async () => { await API.seeAiDeclaration(decl.team_id, course); c(); toast('Seen by ' + course + '.'); if (after) after(); }) }, 'Seen by the course teacher') : null], 'wide');
  }
  /* ---- the teacher's marking card ---- */
  function aiChip(teamId, course, mayMark) {
    const slot = el('span.aichip');
    const paint = () => API.aiDeclaration(teamId).then(({ decl, seen }) => { clear(slot);
      if (!decl) { slot.append(el('span.pill.none', 'no AI declaration')); return; }
      const mine = (seen || []).find(x => x.course === course);
      slot.append(el('button.btn.ghost.sm', { type: 'button', onclick: e => { e.stopPropagation(); aiReadModal(decl, seen, teamId, mayMark ? course : null, paint); } }, mine ? 'declaration seen' : 'AI declaration')); }).catch(() => {});
    paint(); return slot;
  }
  function reviewChip(teamId) {
    const slot = el('span.rvchip');
    API.reviewScores(teamId).then(rows => { const r = (rows || [])[0]; if (r) slot.append(el('span.pill.info', { title: r.sentence || '' }, 'Review ' + r.total + '/10 · advisory')); }).catch(() => {});
    return slot;
  }
  /* ---- the convener's team modal ---- */
  const secBH = (title, ...kids) => el('div', { style: 'padding:10px 0;border-bottom:1px solid var(--rule)' }, el('div', { style: 'font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px' }, title), ...kids);
  function fieldSection(r) {
    const body = el('div', el('div.hint', 'Loading…'));
    const draw = () => Promise.all([API.signouts(r.team_id).catch(() => []), API.incidents(r.team_id).catch(() => [])]).then(([so, inc]) => { clear(body);
      const open = (so || []).filter(x => x.state === 'filed' || x.state === 'out');
      open.forEach(x => { const late = overdueBy(x); body.append(el('div.soline' + (late > 0 ? '.late' : ''), el('div', el('b', x.where_to + ' · ' + GRADE[x.grade]), el('div.meta', x.rolls.join(', ') + ' · due ' + ktime(x.due_at) + ' · ' + (x.state === 'filed' ? 'waiting at the desk' : 'out since ' + ktime(x.out_at)) + (x.reported_back_at ? ' · said back ' + ktime(x.reported_back_at) : '') + (late > 0 ? ' · ' + late + ' min over: ring them' : ''))))); });
      if (!open.length) body.append(el('div.hint', 'Nobody out now.' + ((so || []).length ? ' ' + so.length + ' line' + (so.length === 1 ? '' : 's') + ' on the sheet this term.' : '')));
      (inc || []).forEach(i => body.append(el('div.notice', el('p', el('b', kindLabel(i.kind)), ' · ' + i.location + ' · ' + shortDay(kdate(i.happened_at)) + ' ' + ktime(i.happened_at) + (i.hurt ? ' · hurt' : '') + (i.authority ? ' · ' + (i.authority_who || 'authority') : '')),
        el('div.meta', i.what), el('div.meta', 'filed by ' + (i.filed_name || i.filed_role) + (i.convener_signed_at ? ' · signed ' + (i.convener_signed_by || '') : '') + (i.received_at ? ' · received by the Registrar' : '') + (i.site_closed && !i.site_reopened_on ? ' · site closed' : '')),
        !i.convener_signed_at && (D.profile || {}).role === 'convener' ? el('button.btn.ghost.sm', { type: 'button', onclick: () => guard(async () => { await API.signIncident(i.id); toast('Signed.'); draw(); }) }, 'Sign it') : null)));
      body.append(el('div', { style: 'margin-top:6px' }, el('button.btn.ghost.sm', { type: 'button', onclick: () => incidentModal(r.team_id, [], null, null, draw) }, 'Form F2 for this team')));
    });
    draw(); return secBH('In the field · form F2', body);
  }
  function appealsSection(r) {
    const body = el('div', el('div.hint', 'Loading…'));
    const draw = () => API.appeals(r.team_id).then(rows => { clear(body);
      if (!rows || !rows.length) { body.append(el('div.hint', 'No appeal.')); return; }
      rows.forEach(a => { const note = el('input', { type: 'text', maxlength: '800', placeholder: 'your account, for the programme heads', value: a.convener_note || '' });
        body.append(el('div.notice', el('p', el('b', a.roll + ' · ' + a.ruling), ' · ruling of ' + shortDay(a.ruling_on)), el('div.meta', a.grounds),
          a.state === 'decided' ? el('div.meta', el('b', 'Decided ' + shortDay(a.decided_on) + ': ' + a.outcome + '. '), a.decision)
            : (D.profile || {}).role === 'convener' ? el('div', { style: 'display:flex;gap:6px;margin-top:6px' }, note, el('button.btn.ghost.sm', { type: 'button', onclick: () => guard(async () => { await API.answerAppeal(a.id, note.value); toast('Your account is with the heads.'); draw(); }) }, 'Send')) : el('div.meta', a.convener_note ? 'convener: ' + a.convener_note : 'waiting for the convener’s account'))); });
    }).catch(() => {});
    draw(); return secBH('Appeals to the programme heads', body);
  }
  function aiSection(r) {
    const body = el('div', el('div.hint', 'Loading…'));
    API.aiDeclaration(r.team_id).then(({ decl, seen }) => { clear(body);
      if (!decl) { body.append(el('div.hint', 'Not signed yet. Due with the Folio; the Folio is not accepted without it.')); return; }
      body.append(el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, el('span.pill.ok', 'signed v' + decl.version + ' · ' + shortDay(kdate(decl.signed_at))), el('span.meta', (seen || []).length ? 'seen by ' + seen.map(x => x.course).join(', ') : 'no course has marked it seen yet'), el('button.btn.ghost.sm', { type: 'button', onclick: () => aiReadModal(decl, seen) }, 'Read'))); }).catch(() => {});
    return secBH('AI declaration', body);
  }
  function reviewSection(r) {
    const body = el('div', el('div.hint', 'Loading…'));
    const openDay = (D.settings || {}).review_open === 'yes';
    Promise.all([API.reviewScores(r.team_id).catch(() => []), API.presence().catch(() => [])]).then(([sc, pr]) => { clear(body);
      const p = (pr || []).find(x => x.team_id === r.team_id); const s0 = (sc || [])[0];
      const tick = el('input', { type: 'checkbox' }); tick.checked = !!(p && p.present);
      tick.addEventListener('change', () => guard(async () => { await API.markPresent(r.team_id, tick.checked); toast(tick.checked ? 'At its table.' : 'Not at its table.'); }));
      body.append(el('label.chk', tick, el('span', 'At its table on 15 December' + (p ? ' · ' + (p.by_name || '') + ' ' + ktime(p.at) : ''))),
        s0 ? el('div.meta', { style: 'margin-top:6px' }, 'Judged ' + s0.total + '/10 · advisory' + (s0.sentence ? ' · “' + s0.sentence + '”' : '')) : el('div.hint', openDay ? 'Not scored yet.' : 'Scored on the day by a judging pair; advisory, never a mark.')); }).catch(() => {});
    return secBH('The Karachi Review', body);
  }
  /* ---- the convener's home: who is out now ---- */
  function inFieldCard() {
    const b = el('div.b.flush'); const card = el('div.card', { style: 'margin-top:14px' }, el('div.h', el('h3', 'In the field now'), el('span.tag', 'from the sign-out sheet')), b);
    card.style.display = 'none';
    API.signouts().then(rows => { const open = (rows || []).filter(r => r.state === 'filed' || r.state === 'out'); if (!open.length) return; card.style.display = '';
      open.forEach(x => { const late = overdueBy(x); b.append(el('div.notice' + (late > 0 ? '.late' : ''), el('p', el('b', x.team_id + ' · ' + x.where_to), ' · ' + GRADE[x.grade] + ' · ' + x.rolls.length + ' students'),
        el('div.meta', 'due ' + ktime(x.due_at) + ' · ' + (x.state === 'filed' ? 'waiting at the desk' : 'out since ' + ktime(x.out_at)) + (x.reported_back_at ? ' · said back ' + ktime(x.reported_back_at) : '') + (late > 30 ? ' · ' + late + ' min over — the desk has rung; ring them yourself' : late > 0 ? ' · ' + late + ' min over' : '')))); }); }).catch(() => {});
    return card;
  }
  /* ---- the office: the desk (the day sheet), incidents and appeals trackers ---- */
  function deskView() {
    const root = el('div', el('div.page-h', el('div.eyebrow', 'Front desk'), el('h1', 'The desk · sign out, sign in'),
      el('p', 'The day sheet, as rows. A team files its line from its own screen; you count heads, see the cards and the letter, and sign it out. On return you sign it in. At 8 pm every line has a sign-in time or an explanation.')),
      el('div#flash'), firstTimeLine());
    const box = el('div'); root.append(box, footnote());
    const draw = () => Promise.all([API.signouts().catch(() => []), API.closedSites().catch(() => []), API.incidents().catch(() => [])]).then(([rows, closed, inc]) => { clear(box);
      const T = today(); const todayRows = (rows || []).filter(r => kdate(r.at) === T || r.state === 'filed' || r.state === 'out');
      const out = todayRows.filter(r => r.state === 'out'), waiting = todayRows.filter(r => r.state === 'filed'), late = out.filter(r => overdueBy(r) > 0);
      box.append(el('div.grid.g4', { style: 'margin-bottom:16px' },
        el('div.stat', el('div.n', String(waiting.length)), el('div.l', 'waiting at the desk')), el('div.stat' + (out.length ? '.a' : ''), el('div.n', String(out.length)), el('div.l', 'out now')),
        el('div.stat' + (late.length ? '.a' : ''), el('div.n', String(late.length)), el('div.l', 'past their time')), el('div.stat', el('div.n', String((closed || []).length)), el('div.l', 'sites closed'))));
      if (late.length) box.append(el('div.msg.warn', el('b', 'The ninety minutes. '), 'At the due time ring the team — the lead, then a second member — and write the time and the answer. Thirty minutes over, ring the convener. Ninety minutes over with nobody answering is an incident: the duty holder rings the Registrar, form F2 the same day.'));
      const sheet = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', 'Today’s sheet · ' + pretty(T)), el('span.tag', todayRows.length + ' line' + (todayRows.length === 1 ? '' : 's'))), el('div.b.flush'));
      const sb = sheet.querySelector('.b');
      if (!todayRows.length) sb.append(el('div.empty', 'No team has signed out today.'));
      todayRows.sort((a, b) => (a.state === 'filed' ? 0 : a.state === 'out' ? 1 : 2) - (b.state === 'filed' ? 0 : b.state === 'out' ? 1 : 2) || (a.due_at < b.due_at ? -1 : 1)).forEach(r => {
        const late = overdueBy(r); const line = el('div.deskline.' + r.state + (late > 0 ? '.late' : ''));
        line.append(el('div.t', el('b', r.team_id), el('span', r.where_to + ' · ' + GRADE[r.grade]), el('div.meta', r.rolls.join(', ') + (r.phone ? ' · ' + r.phone : '') + ' · filed ' + ktime(r.at) + ' by ' + (r.filed_name || ''))),
          el('div.times', el('span', 'out ' + (r.out_at ? ktime(r.out_at) : '—')), el('span', 'due ' + ktime(r.due_at)), el('span', 'in ' + (r.back_at ? ktime(r.back_at) : r.reported_back_at ? 'said back ' + ktime(r.reported_back_at) : '—')), el('span.meta', (r.out_by ? 'out: ' + r.out_by : '') + (r.back_by ? ' · in: ' + r.back_by : '') + (r.note ? ' · ' + r.note : ''))));
        if (r.state === 'filed') { const c1 = el('input', { type: 'checkbox' }), c2 = el('input', { type: 'checkbox' });
          line.append(el('div.acts', el('label.chk', c1, el('span', 'cards and letter seen')), el('label.chk', c2, el('span', 'duty number on every card')),
            el('button.btn.sm', { type: 'button', onclick: () => guard(async () => { await API.deskSignout(r.id, c1.checked, c2.checked); toast('Out. ' + r.rolls.length + ' heads.'); draw(); }) }, 'Sign out'),
            el('button.btn.ghost.sm', { type: 'button', onclick: () => closeLine(r) }, 'Did not go'))); }
        if (r.state === 'out') line.append(el('div.acts', el('button.btn.sm', { type: 'button', onclick: () => guard(async () => { await API.signBack(r.id); toast('In.'); draw(); }) }, 'Sign in'),
          el('button.btn.ghost.sm', { type: 'button', onclick: () => closeLine(r) }, 'Close with an explanation'), late > 0 ? el('button.btn.ghost.sm', { type: 'button', onclick: () => incidentModal(r.team_id, [], r.id, 'overdue', draw) }, 'Form F2') : null));
        sb.append(line); });
      box.append(sheet);
      const cl = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', 'The closed list'), el('span.tag', 'dated · the Registrar reopens')), el('div.b.flush'));
      const cb = cl.querySelector('.b'); const closedInc = (inc || []).filter(i => i.site_closed && !i.site_reopened_on);
      if (!closedInc.length) cb.append(el('div.empty', 'No site is closed.'));
      closedInc.forEach(i => cb.append(el('div.notice', el('p', el('b', i.location), ' · closed ' + shortDay(i.site_closed_on) + ' · ' + kindLabel(i.kind) + ' · ' + i.team_id), el('button.btn.ghost.sm', { type: 'button', onclick: () => guard(async () => { await API.reopenSite(i.id); toast('Reopened.'); draw(); }) }, 'The Registrar reopened it'))));
      box.append(cl);
    });
    const closeLine = r => { const note = el('input', { type: 'text', maxlength: '400', placeholder: 'the explanation' });
      modal('Close the line · ' + r.team_id, el('div', el('p', { style: 'margin:0 0 8px;font-size:14px' }, 'Every line has a sign-in time or an explanation. A team that came back and did not sign in counts as not back: ring before you assume.'), note),
        c => [el('button.btn.ghost', { onclick: c }, 'Back'), el('button.btn', { onclick: () => guard(async () => { await API.closeSignout(r.id, note.value); c(); toast('Closed.'); draw(); }) }, 'Close it')]); };
    draw(); return root;
  }
  function incidentsTracker() {
    const b = el('div.b.flush', el('div.empty', 'Loading…'));
    const card = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', 'Incident forms, F2'), el('span.tag', 'every one, including the nothings · the Monday return to the Registrar')), b);
    const draw = () => API.incidents().then(rows => { clear(b); if (!rows || !rows.length) { b.append(el('div.empty', 'None filed.')); return; }
      rows.forEach(i => { const note = el('input', { type: 'text', maxlength: '400', placeholder: 'the Registrar’s note (optional)', value: i.received_note || '' }); const closed = el('input', { type: 'checkbox' }); closed.checked = !!i.site_closed;
        b.append(el('div.notice', el('p', el('b', i.team_id + ' · ' + kindLabel(i.kind)), ' · ' + i.location + ' · ' + shortDay(kdate(i.happened_at)) + ' ' + ktime(i.happened_at) + (i.hurt ? ' · hurt' : '') + (i.authority ? ' · ' + (i.authority_who || 'authority') : '')),
          el('div.meta', i.what + (i.action ? ' — ' + i.action : '') + (i.reported_to ? ' — reported to ' + i.reported_to : '')),
          el('div.meta', 'filed by ' + (i.filed_name || i.filed_role) + ' ' + shortDay(kdate(i.at)) + (i.convener_signed_at ? ' · signed by ' + (i.convener_signed_by || 'the convener') : ' · not yet signed by the convener') + (i.received_at ? ' · received ' + shortDay(kdate(i.received_at)) + ' (' + (i.received_by || '') + ')' : '') + (i.site_closed ? (i.site_reopened_on ? ' · site reopened ' + shortDay(i.site_reopened_on) : ' · site closed') : '')),
          el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px' }, el('label.chk', closed, el('span', 'site closed')), note,
            el('button.btn.ghost.sm', { type: 'button', onclick: () => guard(async () => { await API.receiveIncident(i.id, closed.checked, note.value); toast('Recorded: received by the Registrar.'); draw(); }) }, i.received_at ? 'Record again' : 'Received by the Registrar')))); }); }).catch(() => {});
    draw(); return card;
  }
  function appealsTracker() {
    const b = el('div.b.flush', el('div.empty', 'Loading…'));
    const card = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', 'Appeals to the programme heads'), el('span.tag', 'seven days · their decision ends it')), b);
    const draw = () => API.appeals().then(rows => { clear(b); if (!rows || !rows.length) { b.append(el('div.empty', 'None filed.')); return; }
      rows.forEach(a => { const out = el('select', el('option', { value: 'upheld' }, 'upheld'), el('option', { value: 'overturned' }, 'overturned'), el('option', { value: 'varied' }, 'varied')); const dec = el('input', { type: 'text', maxlength: '800', placeholder: 'the heads’ decision, in a line or two' });
        b.append(el('div.notice', el('p', el('b', a.roll + (a.team_id ? ' · ' + a.team_id : '') + ' · ' + a.ruling), ' · ruling of ' + shortDay(a.ruling_on) + ' · filed ' + shortDay(kdate(a.at))), el('div.meta', a.grounds),
          el('div.meta', a.convener_note ? 'convener (' + (a.convener_by || '') + '): ' + a.convener_note : 'no account from the convener yet'),
          a.state === 'decided' ? el('div.meta', el('b', 'Decided ' + shortDay(a.decided_on) + ' by ' + (a.decided_by || '') + ': ' + a.outcome + '. '), a.decision)
            : el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px' }, out, dec, el('button.btn.ghost.sm', { type: 'button', onclick: () => guard(async () => { await API.decideAppeal(a.id, out.value, dec.value); toast('Recorded. That ends it.'); draw(); }) }, 'Record the decision')))); }); }).catch(() => {});
    draw(); return card;
  }
  /* ---- the Karachi Review: circuits (the office), the sheet (the judging pair), the tables (the convener) ---- */
  function reviewView() {
    const role = (D.profile || {}).role, office = role === 'office';
    const openDay = (D.settings || {}).review_open === 'yes';
    const root = el('div', el('div.page-h', el('div.eyebrow', office ? 'Front desk' : role === 'teacher' ? 'Teachers' : 'Conveners'), el('h1', 'The Karachi Review · Tuesday 15 December'),
      el('p', 'Every team exhibits at its own table, 10:00 to 17:00, across the campus. Eleven judging pairs — a teacher and an alumnus — walk circuits of about twenty teams, eight minutes a team, and score at the table out of 10. The score is advisory: it goes to every course marking the Folio and is never entered as a mark.')),
      el('div#flash'), firstTimeLine());
    const box = el('div'); root.append(box, footnote());
    Promise.all([API.circuits().catch(() => []), API.reviewScores().catch(() => []), office || role === 'convener' ? API.presence().catch(() => []) : Promise.resolve([]), office || role === 'convener' ? API.board().catch(() => []) : Promise.resolve([])]).then(([circuits, scores, presence, board]) => {
      const myName = (D.profile || {}).name; const myId = (D.profile || {}).user_id;
      const mine = (circuits || []).filter(c => (myId && c.judge_user === myId) || (c.judge_name && c.judge_name === myName));
      const blockOf = t => { const r = (board || []).find(x => x.team_id === t); return r ? r.block : ''; };
      const scoreOf = t => (scores || []).find(x => x.team_id === t);
      if (office) box.append(circuitsCard(circuits, board, openDay));
      mine.forEach(c => box.append(judgeCard(c, scoreOf, openDay, blockOf)));
      if (role === 'teacher' && !mine.length) box.append(el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', 'Your circuit')), el('div.b', el('div.empty', 'You are not on a judging pair. The office builds the eleven circuits; a judge walks one that never holds their own blocks.'))));
      if (role === 'convener' || office) box.append(tablesCard(board, presence, scores, openDay, office));
    });
    return root;
  }
  function circuitsCard(circuits, board, openDay) {
    const b = el('div.b'); const card = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', 'The circuits'), el('span.tag', (circuits || []).length + ' built · the day is ' + (openDay ? 'OPEN for scoring' : 'closed'))), b);
    b.append(el('div', { style: 'margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap' },
      el('button.btn.sm', { type: 'button', onclick: () => guard(async () => { await API.setSetting('review_open', openDay ? 'no' : 'yes'); toast(openDay ? 'Scoring closed.' : 'Scoring open. The pairs can score at the tables.'); refresh(); }) }, openDay ? 'Close the day' : 'Open the day for scoring')));
    const num = el('input', { type: 'number', min: '1', max: '20', value: String(((circuits || []).length || 0) + 1), style: 'width:70px' }), name = el('input', { type: 'text', maxlength: '60', placeholder: 'name: a wing, a floor' });
    const judge = el('select', el('option', { value: '' }, '— the teacher on the pair —')); const alum = el('input', { type: 'text', maxlength: '120', placeholder: 'the alumnus on the pair' });
    const teams = el('textarea', { placeholder: 'team ids, with commas or spaces: the teams whose tables this pair walks', style: 'min-height:56px' });
    API.staffList().then(list => (list || []).forEach(p => judge.append(el('option', { value: p.id }, p.name + ' · ' + p.role + (p.blocks && p.blocks.length ? ' · holds ' + p.blocks.length + ' block' + (p.blocks.length === 1 ? '' : 's') : ''))))).catch(() => {});
    const fill = c => { num.value = c.id; name.value = c.name || ''; judge.value = c.judge_user || ''; alum.value = c.alumnus_name || ''; teams.value = (c.teams || []).join(', '); };
    b.append(el('div.mgrid', el('label.f', el('span', 'No.'), num), el('label.f', el('span', 'Name'), name), el('label.f', el('span', 'Teacher'), judge), el('label.f', el('span', 'Alumnus'), alum)), teams,
      el('div', { style: 'margin-top:8px' }, el('button.btn.sm', { type: 'button', onclick: () => guard(async () => { await API.setCircuit(num.value, name.value, judge.value || null, alum.value, teams.value.split(/[,\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean)); toast('Circuit ' + num.value + ' saved.'); refresh(); }) }, 'Save the circuit')),
      el('div.hint', { style: 'margin-top:6px' }, 'A judge is never on a circuit that takes in their own blocks; a team stands on one circuit only; a paired block stands on its neighbour’s circuit.'));
    if ((circuits || []).length) b.append(el('table.t.reg', { style: 'margin-top:12px' }, el('thead', el('tr', el('th', 'No.'), el('th', 'Name'), el('th', 'Pair'), el('th', 'Teams'), el('th', ''))),
      el('tbody', ...circuits.map(c => el('tr', el('td', { 'data-label': 'No.' }, String(c.id)), el('td', { 'data-label': 'Name' }, c.name || ''), el('td', { 'data-label': 'Pair' }, (c.judge_name || '—') + ' · ' + (c.alumnus_name || '—')),
        el('td', { 'data-label': 'Teams' }, (c.teams || []).length + ': ' + (c.teams || []).join(' ')), el('td', el('button.btn.ghost.sm', { type: 'button', onclick: () => fill(c) }, 'Edit')))))));
    return card;
  }
  function judgeCard(c, scoreOf, openDay, blockOf) {
    const b = el('div.b.flush'); const card = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', 'Your circuit · ' + (c.name || 'Circuit ' + c.id)), el('span.tag', (c.teams || []).length + ' teams · with ' + (c.alumnus_name || 'your alumnus') + ' · eight minutes a table')), b);
    if (!openDay) b.append(el('div.hint.pad', 'The office opens scoring on the day. Until then the sheet is read-only.'));
    (c.teams || []).forEach(t => { const s0 = scoreOf(t);
      const mk = (max, v) => { const x = el('select', ...Array.from({ length: max + 1 }, (_, i) => el('option', { value: String(i) }, String(i)))); x.value = String(v == null ? max : v); x.disabled = !openDay; return x; };
      const w = mk(4, s0 && s0.works), cl = mk(3, s0 && s0.claim), an = mk(2, s0 && s0.answered), ou = mk(1, s0 && s0.outside);
      const bx = s0 && s0.boxes ? s0.boxes : {}; const yn = (g, k) => { const x = el('input', { type: 'checkbox' }); x.checked = !!(bx[g] && bx[g][k]); x.disabled = !openDay; return x; };
      const v1 = yn('venture', 'paying'), v2 = yn('venture', 'accounted'), v3 = yn('venture', 'incubation'), c1 = yn('client', 'handed_over'), c2 = yn('client', 'present'), c3 = yn('client', 'again');
      const sentence = el('input', { type: 'text', maxlength: '300', placeholder: 'one sentence the team should hear', value: s0 ? s0.sentence || '' : '' }); sentence.disabled = !openDay;
      const total = el('b.total', s0 ? s0.total + '/10' : '—'); const sum = () => { total.textContent = (+w.value + +cl.value + +an.value + +ou.value) + '/10'; }; [w, cl, an, ou].forEach(x => x.addEventListener('change', sum));
      b.append(el('div.sheet', el('div.sh', el('b', t), el('span.meta', blockOf(t) || ''), total),
        el('div.rows', el('label.sr', el('span', 'Does it work? Is the thing on the table real — live, finished, usable?'), w, el('i', '/4')), el('label.sr', el('span', 'Is the claim supported? Evidence behind the gap, the market, the method or the argument.'), cl, el('i', '/3')),
          el('label.sr', el('span', 'Did they answer your questions? On their feet, from two people who are not their teachers.'), an, el('i', '/2')), el('label.sr', el('span', 'Would you take this outside the university? Client-ready, customer-ready, publishable.'), ou, el('i', '/1'))),
        el('div.boxes', el('div', el('b', 'Venture teams only'), el('label.chk', v1, el('span', 'first paying customer evidenced')), el('label.chk', v2, el('span', 'every rupee in and out accounted for')), el('label.chk', v3, el('span', 'recommended for a Spring incubation slot'))),
          el('div', el('b', 'Client teams only'), el('label.chk', c1, el('span', 'deliverable handed over')), el('label.chk', c2, el('span', 'client present, or comment on file')), el('label.chk', c3, el('span', 'client would work with Greenwich again')))),
        sentence, openDay ? el('div', { style: 'margin-top:6px' }, el('button.btn.sm', { type: 'button', onclick: () => guard(async () => {
          await API.scoreReview(t, w.value, cl.value, an.value, ou.value, { venture: { paying: v1.checked, accounted: v2.checked, incubation: v3.checked }, client: { handed_over: c1.checked, present: c2.checked, again: c3.checked } }, sentence.value); toast(t + ' scored ' + total.textContent + '.'); }) }, s0 ? 'Score again' : 'Score it')) : null)); });
    return card;
  }
  function tablesCard(board, presence, scores, openDay, office) {
    const rows = (board || []).slice().sort((a, b) => a.block < b.block ? -1 : a.block > b.block ? 1 : a.team_id < b.team_id ? -1 : 1);
    const b = el('div.b.flush'); const n = (presence || []).filter(p => p.present).length;
    const card = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', office ? 'Every table' : 'Your teams at their tables'), el('span.tag', n + ' of ' + rows.length + ' at their table · attendance is compulsory')), b);
    if (!rows.length) { b.append(el('div.empty', 'No teams.')); return card; }
    b.append(el('table.t.reg', el('thead', el('tr', el('th', 'Team'), el('th', 'Block'), el('th', 'At its table'), el('th', 'Judged'), el('th', 'The sentence'))),
      el('tbody', ...rows.map(r => { const p = (presence || []).find(x => x.team_id === r.team_id); const s0 = (scores || []).find(x => x.team_id === r.team_id);
        const tick = el('input', { type: 'checkbox' }); tick.checked = !!(p && p.present); tick.addEventListener('change', () => guard(async () => { await API.markPresent(r.team_id, tick.checked); card.querySelector('.tag').textContent = ((presence || []).filter(x => x.team_id !== r.team_id && x.present).length + (tick.checked ? 1 : 0)) + ' of ' + rows.length + ' at their table · attendance is compulsory'; (presence || []).splice(0, presence.length, ...presence.filter(x => x.team_id !== r.team_id), { team_id: r.team_id, present: tick.checked }); }));
        return el('tr', el('td', { 'data-label': 'Team' }, el('b', r.team_id)), el('td', { 'data-label': 'Block' }, r.block), el('td', { 'data-label': 'At its table' }, tick), el('td', { 'data-label': 'Judged' }, s0 ? s0.total + '/10' : '—'), el('td', { 'data-label': 'The sentence' }, s0 && s0.sentence ? s0.sentence : '')); }))));
    return card;
  }

  /* ============================================================ 22 September, register BG: the four records, the calendar, badges, print */
  function scopeSection(r) {
    const scope = el('textarea', { maxlength: '400', placeholder: 'One line: what the team will and will not cover, agreed with them at Session 9.', style: 'min-height:56px' });
    const client = el('input', { type: 'text', maxlength: '160', placeholder: 'client or subject confirmed (optional)' });
    const state = el('div.hint', 'Not agreed yet.');
    API.teamScope(r.team_id).then(sc => { if (!sc) return; scope.value = sc.scope || ''; client.value = sc.client || ''; state.textContent = 'Agreed on ' + pretty(sc.agreed_on) + (sc.by_name ? ' by ' + sc.by_name : '') + '.'; }).catch(() => {});
    return el('div', { style: 'padding:10px 0;border-bottom:1px solid var(--rule)' },
      el('div', { style: 'font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px' }, 'Scope, Session 9'),
      scope, el('div', { style: 'margin-top:6px' }, client),
      el('div', { style: 'display:flex;gap:8px;align-items:center;margin-top:7px;flex-wrap:wrap' },
        el('button.btn.sm', { type: 'button', onclick: () => guard(async () => { await API.agreeScope(r.team_id, scope.value, client.value); toast('Scope agreed.'); state.textContent = 'Agreed today.'; }) }, 'Agree the scope'), state));
  }
  function scopeAndDraftsCard(teamId) {
    const b = el('div.b', el('div.empty', 'Loading…'));
    const card = el('div.card', { style: 'margin-bottom:14px' }, el('div.h', el('h3', 'Scope and drafts'), el('span.tag', 'Session 9 · Session 11')), b);
    Promise.all([API.teamScope(teamId).catch(() => null), API.draftReviews(teamId).catch(() => [])]).then(([sc, dr]) => {
      clear(b);
      b.append(el('p', { style: 'margin:0 0 8px;font-size:14px;line-height:1.5' }, el('b', 'Scope. '),
        sc ? sc.scope + (sc.client ? ' · ' + sc.client : '') + ' — agreed on ' + pretty(sc.agreed_on) + '.' : 'Not agreed yet. Your convener agrees it with you at Session 9.'));
      b.append(el('p', { style: 'margin:0;font-size:14px;line-height:1.5' }, el('b', 'Drafts seen. '),
        dr && dr.length ? dr.map(d => d.course + ' (' + shortDay(String(d.at).slice(0, 10)) + (d.note ? ': ' + d.note : '') + ')').join(' · ') : 'No course has looked at your draft yet. Session 11 is the draft review, in class.'));
    });
    return card;
  }
  function draftControl(teamId, course, mayMark) {
    const slot = el('span.draft');
    const paint = rows => { clear(slot); const mine = (rows || []).find(x => x.course === course);
      if (mine) { slot.append(el('span.pill.ok', { title: mine.note || '' }, 'draft seen ' + shortDay(String(mine.at).slice(0, 10)))); return; }
      if (mayMark) slot.append(el('button.btn.ghost.sm', { type: 'button', onclick: e => { e.stopPropagation();
        const note = el('input', { type: 'text', maxlength: '300', placeholder: 'one line for the team (optional)' });
        const close = modal('Draft seen · ' + teamId, el('div', el('p', { style: 'margin:0 0 10px;font-size:14px;line-height:1.5' }, 'Session 11: you saw what exists, not what is planned. Ten minutes a team, in class.'), note),
          c => [el('button.btn.ghost', { onclick: c }, 'Not yet'), el('button.btn', { onclick: () => guard(async () => { await API.reviewDraft(teamId, course, note.value); c(); toast('Recorded.'); paint(await API.draftReviews(teamId)); }) }, 'Seen it')]); } }, 'Draft seen?')); };
    API.draftReviews(teamId).then(paint).catch(() => {});
    return slot;
  }
  function draftsCard() {
    const b = el('div.b', el('div.empty', 'Counting…'));
    const card = el('div.card', { style: 'margin-top:14px' }, el('div.h', el('h3', 'Session 11 · drafts seen'), el('span.tag', 'by the marking courses')), b);
    Promise.all([API.draftReviews().catch(() => []), API.board().catch(() => [])]).then(([dr, rows]) => {
      clear(b); const byTeam = {}; (dr || []).forEach(d => { (byTeam[d.team_id] = byTeam[d.team_id] || []).push(d.course); });
      const teams = (rows || []).map(r => r.team_id); const seen = teams.filter(t => byTeam[t]).length;
      b.append(el('p', { style: 'margin:0 0 8px;font-size:14px' }, el('b', seen + ' of ' + teams.length + ' teams'), ' have had a draft seen by at least one course.'),
        seen ? el('div', { style: 'font-size:12.5px;color:var(--text-2);line-height:1.5' }, ...teams.filter(t => byTeam[t]).map(t => el('div', el('b', t), ' · ' + byTeam[t].join(', ')))) : el('div.hint', 'Nothing yet. Teachers tick "Draft seen?" on their marking card at Session 11.'));
    });
    return card;
  }
  function moderationRecord() {
    const blocks = myBlockList(); if (!blocks.length) return null;
    const block = el('select', ...blocks.map(b => el('option', { value: b }, b)));
    const team = el('select', el('option', { value: '' }, '— the block, no one team —'));
    const kind = el('select', el('option', { value: 'sample' }, 'Sampled: one of the three Folios'), el('option', { value: 'remark' }, 'Re-marked with the teacher'));
    const course = el('input', { type: 'text', placeholder: 'course code (a re-mark)', maxlength: '12', list: 'course-codes' });
    const spread = el('input', { type: 'number', step: '0.5', min: '0', max: '20', placeholder: 'spread /20' });
    const note = el('input', { type: 'text', maxlength: '400', placeholder: 'what you found' });
    const outcome = el('input', { type: 'text', maxlength: '200', placeholder: 'the outcome (a re-mark)' });
    const list = el('div.b.flush');
    const fillTeams = () => API.board().then(rows => { clear(team).append(el('option', { value: '' }, '— the block, no one team —'), ...(rows || []).filter(r => r.block === block.value).map(r => el('option', { value: r.team_id }, r.team_id))); }).catch(() => {});
    const draw = () => API.moderationLog(block.value).then(rows => { clear(list);
      if (!rows || !rows.length) { list.append(el('div.empty', 'Nothing recorded for ' + block.value + ' yet. Week 11: three drafts a block. Weeks 13–14: the mark sample, and any re-mark.')); return; }
      rows.forEach(m => list.append(el('div.notice', el('p', el('b', (m.kind === 'remark' ? 'Re-mark' : 'Sample') + (m.team_id ? ' · ' + m.team_id : '') + (m.course ? ' · ' + m.course : '') + (m.spread != null ? ' · spread ' + m.spread : '')), (m.note ? ' ' + m.note : '') + (m.outcome ? ' — ' + m.outcome : '')),
        el('div.meta', (m.by_name || '') + ' · ' + stamp(m.at))))); }).catch(() => {});
    block.addEventListener('change', () => { fillTeams(); draw(); }); fillTeams(); draw();
    return el('div.card', { style: 'margin-bottom:16px' }, el('div.h', el('h3', 'The record'), el('span.tag', 'what was sampled, what was re-marked, and why')),
      el('div.b', el('div.mgrid', el('label.f', el('span', 'Block'), block), el('label.f', el('span', 'Team'), team), el('label.f', el('span', 'What'), kind), el('label.f', el('span', 'Course'), course), el('label.f', el('span', 'Spread'), spread)),
        note, el('div', { style: 'margin-top:6px' }, outcome),
        el('div', { style: 'margin-top:8px' }, el('button.btn.sm', { type: 'button', onclick: () => guard(async () => { await API.logModeration(block.value, team.value || null, kind.value, course.value, spread.value, note.value, outcome.value); note.value = ''; outcome.value = ''; spread.value = ''; toast('Recorded.'); draw(); }) }, 'Record it'))),
      list);
  }
  function hoursCard() {
    const on = el('input', { type: 'date', value: today() }), hrs = el('input', { type: 'number', step: '0.25', min: '0.25', max: '12', placeholder: 'hours', style: 'width:90px' });
    const what = el('input', { type: 'text', maxlength: '200', placeholder: 'what it was: approvals, the merge, a weekly check…' });
    const b = el('div.b.flush'), tag = el('span.tag', '');
    const draw = () => API.hoursLog().then(rows => { clear(b); const tot = (rows || []).reduce((a, r) => a + Number(r.hours || 0), 0);
      tag.textContent = tot ? tot + ' h logged · the handbook plans for 48' : 'nothing logged yet';
      if (!rows || !rows.length) { b.append(el('div.empty', 'Keep a simple log: the Academic Council prices the role in January on what you log here.')); return; }
      rows.slice(0, 30).forEach(r => b.append(el('div.notice', el('p', el('b', r.hours + ' h'), ' · ' + r.what), el('div.meta', shortDay(r.on_date)),
        el('button.btn.ghost.sm', { type: 'button', onclick: () => guard(async () => { await API.deleteHours(r.id); draw(); }) }, 'Remove')))); }).catch(() => {});
    draw();
    return el('div.card', { style: 'margin-top:14px' }, el('div.h', el('h3', 'Your hours'), tag),
      el('div.b', el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, on, hrs, what,
        el('button.btn.sm', { type: 'button', onclick: () => guard(async () => { await API.logHours(on.value, hrs.value, what.value); hrs.value = ''; what.value = ''; toast('Logged.'); draw(); }) }, 'Log'))), b);
  }
  /* the student's dates as a calendar file: every hand-in, the Review, the vivas */
  function calendarFile(types) {
    const ses = (D.sessions || []).map(sessionRow);
    const g = GUIDE(); const review = g && g.programme.calendar.find(c => /Karachi Review/i.test(c.session || ''));
    const ev = [];
    types.forEach(t => ev.push([t.due_on, t.label + ' due — Greenwich Works', 'Upload it in the portal by midnight, Karachi time.']));
    const s14 = ses.find(x => /viva/i.test(x.what || '')) || ses.find(x => x.label === 'Session 14'); if (s14) ev.push([s14.starts, 'Vivas begin — Greenwich Works', 'Three minutes, in each course’s own class.']);
    if (review) { const d = whenDate(review.dates); if (d) ev.push([d, 'The Karachi Review — Greenwich Works', 'Your team exhibits at its own table, all day.']); }
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Greenwich Works//portal//EN', 'CALSCALE:GREGORIAN'].concat(...ev.filter(e => e[0]).map(([d, t, desc]) => {
      const ymd = String(d).replace(/-/g, ''); const next = addDays(String(d).slice(0, 10), 1).replace(/-/g, '');
      return ['BEGIN:VEVENT', 'UID:gw-' + ymd + '-' + t.replace(/[^a-z0-9]/gi, '').slice(0, 24) + '@greenwich.edu.pk', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
              'DTSTART;VALUE=DATE:' + ymd, 'DTEND;VALUE=DATE:' + next, 'SUMMARY:' + t.replace(/,/g, '\\,'), 'DESCRIPTION:' + desc.replace(/,/g, '\\,'), 'END:VEVENT']; }), ['END:VCALENDAR']).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'greenwich-works-dates.ics'; a.click(); URL.revokeObjectURL(a.href);
    toast('Downloaded. Open it and your phone adds every date.');
  }
  /* print one page: the Folio's sections for a block */
  function printSections(block, rows) {
    const esc = t => String(t == null ? '' : t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const w = window.open('', '_blank'); if (!w) { toast('Allow the pop-up to print.', 'err'); return; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>The Folio’s sections · ' + esc(block) + '</title>'
      + '<style>body{font:14px/1.5 Archivo,"Helvetica Neue",Arial,sans-serif;color:#1c1a17;margin:28px;max-width:720px}h1{font-size:22px;margin:0 0 4px}.k{font:11px/1 "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#14524b;margin-bottom:14px}'
      + 'ol{padding-left:22px}li{margin:0 0 12px}li b{display:block;font-size:15px}li i{display:block;font-style:normal;font-family:"IBM Plex Mono",monospace;font-size:11px;color:#14524b;margin-top:2px}.f{margin-top:24px;font-size:11px;color:#8a8178;border-top:1px solid #ddd;padding-top:8px}</style></head><body>'
      + '<div class="k">Greenwich Works · the merge page · Session 7</div><h1>' + esc(block) + '</h1><p>One document, these sections. The Folio is 3,000 words a member however many courses mark it.</p><ol>'
      + rows.map(r => '<li><b>' + esc(r.title) + '</b>' + (r.what_goes_in ? esc(r.what_goes_in) : '') + (r.courses && r.courses.length ? '<i>marked by ' + esc(r.courses.join(', ')) + '</i>' : '') + '</li>').join('')
      + '</ol><div class="f">Greenwich University · Greenwich Works · Fall 2026–27 · printed ' + new Date().toLocaleDateString('en-GB') + '</div></body></html>');
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  }
  /* badges on the bar: a new notice on Home for a student; what waits on Teams for a convener */
  function setPip(id, n) {
    document.querySelectorAll('.nav a[href="#' + id + '"], .tabbar a[href="#' + id + '"]').forEach(a => {
      const old = a.querySelector('.pip'); if (old) old.remove();
      if (n > 0) a.append(el('span.pip', String(n)));
    });
  }
  function refreshPips() {
    if (!D || !D.profile) return;
    const role = D.profile.role;
    if (role === 'student') {
      API.notices().then(rows => {
        let seen = ''; try { seen = localStorage.getItem('gw.notices.seen') || ''; } catch (e) {}
        const onHome = (location.hash.replace('#', '') || 'home') === 'home';
        const newest = (rows || []).reduce((m, r) => r.posted_at > m ? r.posted_at : m, '');
        if (onHome) { try { if (newest) localStorage.setItem('gw.notices.seen', newest); } catch (e) {} setPip('home', 0); return; }
        setPip('home', (rows || []).filter(r => r.posted_at > seen).length);
      }).catch(() => {});
    } else if (role === 'convener' || role === 'office') {
      API.board().then(rows => setPip('teams', (rows || []).filter(r => (r.stuck || []).length || (r.todo || []).length).length)).catch(() => {});
    }
  }

  /* Where each step of the tour points, per role: the first selector that is visible
     on the screen wins, so a phone points at the bottom bar and a laptop at the rail.
     The step text is guide.js's; only the pointing is here. (stage 3, register BD.8) */
  const TOUR_TARGETS = {
    student:  [['.now'], ['.topbar .out:not(.helpbtn)', '.tabbar .more'], ['a[href="#handins"]'], ['a[href="#team"]'], ['a[href="#guide"]', '.tabbar .more']],
    teacher:  [['a[href="#marks"]'], ['.topbar .out:not(.helpbtn)', '.tabbar .more'], ['a[href="#marks"]'], ['.now.staff .tiles'], ['a[href="#guide"]', '.tabbar .more']],
    convener: [['a[href="#teams"]'], ['.topbar .out:not(.helpbtn)', '.tabbar .more'], ['a[href="#gates"]'], ['a[href="#moderation"]', '.tabbar .more'], ['a[href="#guide"]', '.tabbar .more']],
    office:   [['a[href="#office"]', '.tabbar .more'], ['.topbar .out:not(.helpbtn)', '.tabbar .more'], ['a[href="#office"]', '.tabbar .more'], ['a[href="#gates"]'], ['a[href="#guide"]', '.tabbar .more']]
  };
  const RB_STEP = { title: 'I am on every screen',
    body: 'Tap the ? in the top corner whenever you are stuck. I open already showing what you have to do next, I answer '
        + 'questions in plain words from the rules of the programme, and when the rules are silent I tell you whom to ask. '
        + 'I never file, book or submit anything for you.' };
  function walkthrough(force) {
    const g = GUIDE(); if (!g) return;
    if (!force && tourSeen()) return;
    const base = g.roles[roleKey()].walkthrough;
    if (!base || !base.length) return;
    const steps = base.concat([RB_STEP]);
    const targets = (TOUR_TARGETS[roleKey()] || []).concat([['.topbar .helpbtn']]);
    let i = 0, target = null;
    const bg = el('div.wt-bg.coach'), spot = el('div.wt-spot'), card = el('div.wt.coach');
    const top = el('div.top'), body = el('div.b'), dots = el('div.dots');
    const back = el('button.btn.ghost.sm', { type: 'button', onclick: () => { if (i > 0) { i--; paint(); } } }, 'Back');
    const next = el('button.btn.sm.wt-next', { type: 'button' });
    const close = () => { markSeen(); bg.remove(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.removeEventListener('hashchange', onHash); };
    const onHash = () => setTimeout(place, 80);
    next.addEventListener('click', () => {
      if (i < steps.length - 1) { i++; paint(); return; }
      close(); helperPanel();                       /* the last step ends inside Rashid Bhai, not on a "finish" button */
    });
    function find() {
      for (const sel of (targets[i] || [])) {
        for (const n of document.querySelectorAll(sel)) {
          const r = n.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return n;
        }
      }
      return null;
    }
    function place() {
      if (!bg.isConnected) return;
      target = find();
      const phone = window.innerWidth <= 560;
      if (target) {
        const r0 = target.getBoundingClientRect();
        if (r0.top < 60 || r0.bottom > window.innerHeight - (phone ? 300 : 40)) {
          target.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
        const r = target.getBoundingClientRect(), pad = 8;
        spot.hidden = false; bg.classList.remove('nospot');
        spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px';
        spot.style.width = (r.width + 2 * pad) + 'px'; spot.style.height = (r.height + 2 * pad) + 'px';
        if (!phone) {
          const cw = Math.min(400, window.innerWidth - 24), ch = card.offsetHeight || 260;
          let left = Math.max(12, Math.min(window.innerWidth - cw - 12, r.left + r.width / 2 - cw / 2));
          let topY = r.bottom + 14;
          if (topY + ch > window.innerHeight - 12) topY = Math.max(12, r.top - ch - 14);
          card.style.left = left + 'px'; card.style.top = topY + 'px'; card.style.bottom = 'auto'; card.style.width = cw + 'px';
          card.classList.remove('centered');
        }
      } else {
        spot.hidden = true; bg.classList.add('nospot');
        if (!phone) { card.classList.add('centered'); card.style.left = ''; card.style.top = ''; card.style.width = ''; }
      }
      if (phone) { card.classList.remove('centered'); card.style.left = ''; card.style.top = ''; card.style.width = ''; }
    }
    function paint() {
      const st = steps[i], last = i === steps.length - 1;
      clear(top).append(el('span.rb-face', 'RB'),
        el('div', el('div.k', 'Rashid Bhai shows you round · ' + (i + 1) + ' of ' + steps.length), el('h3', st.title)));
      clear(body).append(firstSentence(st.body),
        i < steps.length - 1 && targets[i] && targets[i].length
          ? el('p.try', 'The bright part of the screen is the thing I mean. You can tap it now; I will still be here.')
          : null);
      clear(dots).append(...steps.map((_, n) => el('i', { class: n === i ? 'on' : '' })));
      back.style.visibility = i ? 'visible' : 'hidden';
      next.textContent = last ? 'Ask Rashid Bhai' : 'Next';
      place();
    }
    card.append(top, body, el('div.f', dots, el('button.skip', { type: 'button', onclick: close }, 'Skip'), back, next));
    bg.append(spot, card);
    document.addEventListener('keydown', function esc(e) {
      if (!bg.isConnected) { document.removeEventListener('keydown', esc); return; }
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next.click();
      if (e.key === 'ArrowLeft') back.click();
    });
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true); window.addEventListener('hashchange', onHash);
    document.body.append(bg);
    paint();
    next.focus();
  }

  /* Rashid Bhai on the sign-in screen: the answer set, nothing personal, before anyone signs in.
     It uses the same index and matcher as the panel, in the student's role. */
  function askBox(role) {
    const box = el('input', { type: 'text', maxlength: '200', 'aria-label': 'Ask Rashid Bhai a question',
      placeholder: 'Ask me anything — “when is my Folio due”', autocomplete: 'off' });
    const out = el('div.ab-out');
    const idx = helperIndex(role);
    function ask() {
      const q = box.value.trim(); if (!q) return;
      const res = helperMatch(q, idx);
      clear(out);
      if (!res.length) { out.append(el('p', el('b', 'I do not know that one. '), 'I answer from the rules of the programme. Ask at the front desk, or your convener once you are in.')); return; }
      const c = res[0].c;
      out.append(el('h4', c.kind === 'term' ? c.row.e.t : c.row.ask[0].charAt(0).toUpperCase() + c.row.ask[0].slice(1)),
        el('p', c.kind === 'term' ? c.row.e.b : c.row.answer),
        c.kind === 'answer' ? el('div.src', 'Register ' + c.row.source) : null);
      const more = res.slice(1, 4);
      if (more.length) out.append(el('div.also', 'Or did you mean: ', ...more.map(r => el('button', { type: 'button', onclick: () => { box.value = r.c.title; ask(); } }, r.c.title))));
    }
    const form = el('form.askbox', { onsubmit: e => { e.preventDefault(); ask(); } },
      el('div.ab-h', el('span.rb-face', 'RB'), el('div', el('b', 'Rashid Bhai'), el('span', 'I answer questions before you sign in, and everything else after.'))),
      el('div.ab-ask', box, el('button.btn.sm', { type: 'submit' }, 'Ask')), out);
    return form;
  }

  /* ================================================================== charts
     Six pictures, drawn with divs. No chart library: everything here is a
     handful of nested elements whose widths and heights are percentages, so
     it prints, it scales, it works with the stylesheet the rest of the app
     uses, and there is nothing to keep up to date.

     The numbers all come from views in the database (see db/10_hardening.sql).
     The browser used to work them out itself — the gates screen downloaded
     every hand-in in the University and searched it a thousand times on every
     render — which on a Karachi mobile connection was the difference between
     a screen and a wait.                                                    */

  const pct = (a, b) => (!b ? 0 : Math.round(100 * a / b));

  function legend(items) {
    return el('div.legend', ...items.map(it =>
      el('span', el('i', { class: it.cls || '', style: it.color ? 'background:' + it.color : null }),
         it.label)));
  }

  /* Where the cohort has stalled. The steepest drop is the week's work. */
  function funnelChart(rows, note) {
    if (!rows || !rows.length) return el('div.empty', 'Nothing to count yet — the funnel fills as teams file.');
    const t = rows.reduce((a, r) => a + (+r.teams || 0), 0);
    const steps = [
      ['Teams', t, ''],
      ['Question and patch claimed', rows.reduce((a, r) => a + (+r.with_project || 0), 0), ''],
      ['Ethics screen filed', rows.reduce((a, r) => a + (+r.ethics || 0), 0), 'ethics'],
      ['One-page plan filed', rows.reduce((a, r) => a + (+r.plan || 0), 0), 'plan'],
      ['Charter filed', rows.reduce((a, r) => a + (+r.charter || 0), 0), 'charter'],
      ['Folio filed', rows.reduce((a, r) => a + (+r.folio || 0), 0), 'folio']
    ];
    /* the tone is about the date, not the number: a step nobody has reached
       because it is not due for six weeks is not a problem */
    const due = k => { const ty = (D.handinTypes || []).map(typeRow).find(x => x.key === k);
                       return ty ? daysTo(ty.due_on) : null; };
    return el('div',
      el('div.fnl', ...steps.map(([lab, n, key]) => {
        const d = key ? due(key) : null;
        const cls = (d == null || n === t) ? '' : d < 0 ? '.d' : d <= 14 ? '.w' : '';
        return el('div.row',
          el('div.lab', lab),
          el('div.track', el('i' + cls, { style: 'width:' + pct(n, t) + '%' })),
          el('div.val', n + ' / ' + t));
      })),
      legend([{ cls: 'ok', label: 'on track' }, { cls: 'due', label: 'behind, still inside the window' },
              { cls: 'late', label: 'past the date' }]),
      note ? el('div.hint', { style: 'margin-top:8px' }, note) : null);
  }

  /* Every block on one screen, instead of one row of ticks per team.
     Clicking a row opens that block in the gates grid. */
  function blockStrip(rows, onPick) {
    if (!rows || !rows.length) return el('div.empty', 'No blocks to show.');
    const types = [];
    rows.forEach(r => { if (!types.some(t => t.key === r.type_key))
      types.push({ key: r.type_key, label: r.label, sort: r.sort }); });
    types.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const blocks = [];
    rows.forEach(r => { if (blocks.indexOf(r.block) < 0) blocks.push(r.block); });
    blocks.sort();
    const at = (b, k) => rows.find(r => r.block === b && r.type_key === k);
    /* four bands, because a cell three millimetres wide cannot carry a number */
    const band = p => p == null || p <= 0 ? 0 : p >= 75 ? 3 : p >= 34 ? 2 : 1;
    return el('div',
      el('div.scroll', { style: 'max-height:none' },
        el('table.strip',
          el('thead', el('tr', el('th', ''), ...types.map(t => el('th', SHORT[t.key] || t.label)))),
          el('tbody', ...blocks.map(b => el('tr', { class: onPick ? 'pick' : '',
              onclick: onPick ? () => onPick(b) : null },
            el('td.nm', { title: b }, b),
            ...types.map(t => {
              const r = at(b, t.key);
              const p = r ? r.pct : null;
              return el('td.c', { 'data-l': band(p),
                title: b + ' · ' + (r ? r.label : t.label) + ' · '
                       + (r ? r.filed + ' of ' + r.due + ' filed' : 'nothing due') },
                r && r.due ? el('span.nn', String(r.filed) + '/' + String(r.due)) : null);
            })))))),
      legend([{ cls: 'none', label: 'none' }, { cls: 'few', label: 'a few' },
              { cls: 'most', label: 'most' }, { cls: 'all', label: 'all filed' }]));
  }

  /* The student's term on one line: what is filed, what is next, where today
     sits. It replaces a tile, a table and a to-do list that all said the same
     thing, and it is the only one of the three that shows how much of the
     term is left. */
  function spine(types) {
    if (!types.length) return el('div.empty', 'Nothing is due yet.');
    const rows = types.slice().sort((a, b) => a.due_on < b.due_on ? -1 : 1);
    const first = dayDate(rows[0].due_on).getTime();
    const last = dayDate(rows[rows.length - 1].due_on).getTime();
    const now = dayDate(today()).getTime();
    const at = last > first ? Math.max(0, Math.min(100, 100 * (now - first) / (last - first))) : 0;
    const nextDue = rows.filter(r => !latest(r.key)).sort((a, b) => a.due_on < b.due_on ? -1 : 1)[0];
    return el('div',
      el('div.spine',
        ...rows.map(r => {
          const filed = latest(r.key), d = daysTo(r.due_on);
          const cls = filed ? '.f' : d < 0 ? '.d' : (nextDue && nextDue.key === r.key) ? '.w' : '';
          return el('div.st' + cls,
            { title: r.label + ' · ' + pretty(r.due_on)
                     + (filed ? ' · filed' : d < 0 ? ' · ' + (-d) + ' days past' : ' · ' + d + ' days') },
            el('div.dot'), el('b', X(r.key, SHORT[r.key] || r.label)), el('span', pretty(r.due_on)));
        }),
        el('div.now', { style: 'left:' + at.toFixed(1) + '%' })),
      legend([{ cls: 'ok', label: 'filed' }, { cls: 'due', label: 'due next' },
              { cls: 'late', label: 'past the date' }, { cls: 'none', label: 'not yet open' }]));
  }

  /* A teacher's own column against everybody marking the same teams. Somebody
     marking a mark and a half low sees it in November and can ask why, rather
     than being told in December that they are the outlier. */
  function histChart(rows, mine) {
    if (!rows || !rows.length) return el('div.empty', 'No marks entered anywhere yet.');
    const MAX = 20;
    const bin = list => { const a = new Array(MAX + 1).fill(0);
      list.forEach(r => { const m = +r.mark; if (m >= 0 && m <= MAX) a[m] += (+r.n || 0); }); return a; };
    const all = bin(rows);
    const own = bin(rows.filter(r => mine && mine.indexOf(r.course) >= 0));
    const top = Math.max(1, ...all, ...own);
    return el('div',
      el('div.hist', ...all.map((_, i) =>
        el('i', { title: i + ' of 20 — ' + own[i] + ' yours, ' + all[i] + ' in all' },
          el('u', { style: 'height:' + pct(own[i], top) + '%' }),
          el('s', { style: 'bottom:' + pct(all[i], top) + '%' })))),
      el('div.hax', ...all.map((_, i) => el('i', i % 2 === 0 ? String(i) : ''))),
      legend([{ cls: 'ok', label: 'your marks' }, { cls: 'due', label: 'the rule on each bar: every course marking these teams' }]));
  }

  /* Moderation, scannable. One line per team from its lowest mark to its
     highest, a tick at the mean, widest first, with the four-mark trigger
     drawn as a rule. The eye finds the teams that need a second look before
     the page has finished loading; a table sorted by a number does not. */
  function spreadStrip(rows, onPick) {
    if (!rows || !rows.length) return el('div.empty', 'Nothing marked yet. This fills from Session 13.');
    const MAX = 20;
    const list = rows.slice().sort((a, b) => (b.spread || 0) - (a.spread || 0)).slice(0, 40);
    return el('div',
      el('div.spr', ...list.map(r => {
        const lo = +r.low, hi = +r.high, mn = +r.mean, over = (+r.spread) >= 4;
        return el('div.row', { class: onPick ? 'pick' : '', onclick: onPick ? () => onPick(r) : null },
          el('div.lab', r.team_id),
          el('div.tr',
            el('span.bar' + (over ? '.x' : ''),
               { style: 'left:' + pct(lo, MAX) + '%;width:' + pct(Math.max(hi - lo, 0.3), MAX) + '%' }),
            el('span.mn', { style: 'left:' + pct(mn, MAX) + '%' })),
          el('div.val', lo + ' – ' + hi));
      })),
      legend([{ cls: 'late', label: 'four marks apart or more' },
              { cls: 'ok', label: 'within it' },
              { cls: 'none', label: 'the tick is the mean' }]),
      rows.length > 40 ? el('div.hint', { style: 'margin-top:8px' },
        'The forty widest of ' + rows.length + '. The rest are inside the trigger.') : null);
  }

  /* Not statistics. Each of these, at some point this term, is the number
     that makes somebody act: reprint the slips, chase the staff, raise the
     storage tier, place the unplaced. */
  function gaugesFor(g) {
    if (!g) return el('div.empty', 'These are the office’s.');
    const GB = 1024 * 1024 * 1024;
    const store = pct(g.storage_bytes, g.storage_limit || GB);
    const items = [
      { n: g.claimed + ' / ' + g.roster, p: pct(g.claimed, g.roster), cls: '',
        cap: 'accounts claimed', go: 'office', key: 'g_accounts' },
      { n: g.staff_pending + ' of ' + g.staff, p: pct(g.staff_pending, g.staff),
        cls: g.staff_pending ? '.w' : '', cap: 'staff who have not yet chosen their own password', key: 'g_staff' },
      { n: (g.storage_bytes / GB).toFixed(2) + ' GB', p: store,
        cls: store >= 80 ? '.d' : store >= 60 ? '.w' : '',
        cap: 'of the ' + ((g.storage_limit || GB) / GB).toFixed(0) + ' GB plan' + (store >= 70 ? ' — raise the tier' : ''), key: 'g_storage' },
      { n: String(g.unplaced), p: pct(g.unplaced, g.roster), cls: g.unplaced ? '.w' : '',
        cap: 'undergraduates with no team'
           + (g.not_registered ? ' (' + g.not_registered + ' not registered)' : ''), key: 'g_unplaced' },
      g.courses_no_marker == null ? null
      : { n: String(g.courses_no_marker), p: g.courses_no_marker ? 100 : 0,
          cls: g.courses_no_marker ? '.d' : '',
          cap: 'courses that mark a Folio and have no teacher with an account', key: 'no_marker' },
      g.individual_paths_no_marker == null ? null
      : { n: String(g.individual_paths_no_marker), p: g.individual_paths_no_marker ? 100 : 0,
          cls: g.individual_paths_no_marker ? '.w' : '',
          cap: 'courses setting a lens note, a viva out of 30 or a project with no teacher with an account', key: 'no_marker' },
      g.courses_closed == null ? null
      : { n: String(g.courses_closed), p: 0, cls: '', cap: 'courses whose marking the office has closed', key: 'closing' }
    ].filter(Boolean);
    return el('div.gauge', ...items.map(it =>
      el('div.g', el('div.ring', el('i' + it.cls, { style: 'width:' + it.p + '%' })),
         el('b', it.n), el('span', it.key ? X(it.key, it.cap) : it.cap))));
  }

  /* Hand-ins per day into the deadline: the only warning anybody gets that
     four hundred teams intend to upload on the same Saturday afternoon. */
  function submissionsChart(rows) {
    if (!rows || !rows.length) return el('div.empty', 'Nothing filed yet.');
    const byDay = {};
    rows.forEach(r => { byDay[r.day] = (byDay[r.day] || 0) + (+r.n || 0); });
    const days = Object.keys(byDay).sort().slice(-21);
    const top = Math.max(1, ...days.map(d => byDay[d]));
    return el('div',
      el('div.hist', ...days.map(d =>
        el('i', { title: pretty(d) + ' — ' + byDay[d] + ' filed' },
          el('u', { style: 'height:' + pct(byDay[d], top) + '%' })))),
      el('div.hax', ...days.map((d, i) =>
        el('i', i === 0 || i === days.length - 1 || i === Math.floor(days.length / 2)
                ? shortDay(d)
                : ''))));
  }

  /* Accounts claimed per day against the register. On the day after the slips
     go out this says whether they worked, while there is still time to
     reprint. */
  function claimChart(rows, total) {
    if (!rows || !rows.length) return el('div.empty', 'No accounts claimed yet.');
    const days = rows.slice().sort((a, b) => a.day < b.day ? -1 : 1);
    let run = 0;
    const cum = days.map(r => ({ day: r.day, n: (run += (+r.n || 0)) }));
    const top = Math.max(1, total || run);
    return el('div',
      el('div.hist', ...cum.map(c =>
        el('i', { title: pretty(c.day) + ' — ' + c.n + ' of ' + top },
          el('u', { style: 'height:' + pct(c.n, top) + '%' })))),
      el('div.hax', ...cum.map((c, i) =>
        el('i', i === 0 || i === cum.length - 1
                ? shortDay(c.day)
                : ''))),
      el('div.hint', { style: 'margin-top:6px' },
        run + ' of ' + top + ' claimed · ' + pct(run, top) + '%'));
  }

  /* ------------------------------------------- postgraduate programmes */
  /* Register AJ, AP.5, AQ: Masters, MPhil, PhD and B.Ed students are outside
     Greenwich Works.  No team, no project, nothing to hand in, no individual
     postgraduate project (withdrawn, AL).  They get this screen and no tabs. */
  function plainView() {
    const me = D.me || {};
    return el('div',
      el('div.page-h', el('div.eyebrow', CFG.TERM),
        el('h1', hasName(me.name, me.roll) ? 'Hello, ' + String(me.name).trim().split(/\s+/)[0] : 'Hello'),
        el('p', 'Your courses run as ordinary classes. You have no team and no project.')),
      el('div#flash'),
      el('div.card',
        el('div.h', el('h3', 'What this means for you')),
        el('div.b',
          el('p', { style: 'margin:0 0 12px;font-size:14px;line-height:1.6' },
            'Greenwich Works — the teams, the projects and the Folio — is for the undergraduate programmes. '
            + 'Your programme runs as it always has: your classes meet at the times on your timetable, and each '
            + 'course is assessed by its own teacher on the University’s ordinary scheme.'),
          el('p', { style: 'margin:0 0 14px;font-size:14px;line-height:1.6;color:var(--text-2)' },
            'There is nothing for you to hand in or book here. If you think this is wrong — for example you are '
            + 'an undergraduate — go to the front desk with your roll number and your timetable.'),
          el('div.kv', el('div.k', 'Front desk'), el('div.v', CFG.SUPPORT)))),
      footnote());
  }

  /* ---------------------------------------------------------- routing */
  const HOW = { id: 'guide', label: 'How this works' };
  const STUDENT = [{ id: 'home', label: 'Home' }, { id: 'handins', label: 'Hand-ins' },
                   { id: 'diary', label: 'Book a session' }, { id: 'team', label: 'My team' }, HOW];
  const STAFF = [{ id: 'home', label: 'Home' }, { id: 'teams', label: 'Teams' }, { id: 'gates', label: 'The gates' },
                 { id: 'marks', label: 'Marking' }, { id: 'moderation', label: 'Moderation' },
                 { id: 'office', label: 'Everyone' }, { id: 'trackers', label: 'Trackers' }, { id: 'review', label: 'The Review' }, HOW];
  const OFFICE = STAFF.slice(0, -1).concat([{ id: 'desk', label: 'The desk' }, { id: 'admin', label: 'Settings' }, HOW]);
  const TEACHER = [{ id: 'home', label: 'Home' }, { id: 'marks', label: 'Marking' }, { id: 'viva', label: 'Viva day' }, { id: 'review', label: 'The Review' }, HOW];

  function render() {
    if (!D) return;
    if (D.profile.must_change) {
      const root = clear($('#app'));
      root.append(chrome([], null), el('main', passwordView(true)));
      paintToast(); window.scrollTo(0, 0); return;
    }
    if ((location.hash || '').replace('#', '') === 'password') {
      const root = clear($('#app'));
      root.append(chrome([], null), el('main', passwordView(false)));
      paintToast(); window.scrollTo(0, 0); return;
    }
    const staff = D.profile.role !== 'student';
    if (!staff && isPG()) {
      const root = clear($('#app'));
      root.append(chrome([], null), el('main', plainView()));
      paintToast(); window.scrollTo(0, 0); return;
    }
    const tabs = !staff ? STUDENT : (D.profile.role === 'teacher' ? TEACHER : D.profile.role === 'office' ? OFFICE : STAFF);
    /* '#guide/marks' is still the guide tab — the part after the slash picks
       the section inside it, so it must not be read as an unknown tab. */
    let id = (location.hash || '').replace('#', '').split('/')[0] || tabs[0].id;
    if (!tabs.some(t => t.id === id)) id = tabs[0].id;
    const open = (D.reports || []).filter(r => r.state === 'open').length;
    const withPip = tabs.map(t => t.id === 'gates' && open ? Object.assign({}, t, { pip: open }) : t);
    const view = { home: staff ? dashView : homeView, handins: handinsView, diary: diaryView,
                   team: teamView, gates: gatesView, office: officeView, marks: marksView,
                   moderation: moderationView, guide: guideView, teams: teamsView, admin: adminView,
                   viva: vivaView, trackers: trackersView, desk: deskView, review: reviewView }[id];
    const root = clear($('#app'));
    root.append(chrome(withPip, id), el('main', view()));
    paintToast();
    window.scrollTo(0, 0);
    setTimeout(() => { try { walkthrough(false); } catch (e) { console.error('[gw]', e); } }, 350);
  }
  async function refresh() { helperCache = null; D = await API.bootstrap(); render(); }
  /* If the first load fails there is no page yet, so there is nowhere for a
     toast to go and the reader was left on "Loading…" for ever.  Say what
     happened, offer to try again, and offer the way out. */
  function failCard(e) {
    console.error('[gw] start-up failed', e);
    const why = e && e.friendly ? e.message
      : 'The portal could not load your page. It may be your connection, or the database may be busy.';
    clear($('#app')).append(el('div.wrap', { style: 'padding:60px 16px' },
      el('div.card', { style: 'max-width:520px;margin:0 auto' },
        el('div.h', el('h3', 'The portal did not load')),
        el('div.b',
          el('div.msg.err', why),
          el('p', { style: 'margin:12px 0;font-size:13.5px;color:var(--text-2);line-height:1.55' },
            'Nothing you have handed in is affected. Try again; if it fails twice, tell the front desk — '
            + CFG.SUPPORT + '.'),
          el('div', { style: 'display:flex;gap:9px;flex-wrap:wrap' },
            el('button.btn', { onclick: () => { clear($('#app')).append(
              el('div.empty', { style: 'padding:80px 20px' }, 'Loading…')); start(); } }, 'Try again'),
            el('button.btn.ghost', { onclick: async () => {
              try { await API.signOut(); } catch (x) { /* already out */ }
              D = null; clear($('#app')).append(loginView()); } }, 'Sign out'))))));
  }
  async function start() {
    helperCache = null;
    try {
      const ses = await API.session();
      if (!ses) { D = null; clear($('#app')).append(loginView()); return; }
      D = await API.bootstrap();
      if (!D || !D.profile) { D = null; clear($('#app')).append(loginView()); return; }
    } catch (e) { failCard(e); return; }
    try { render(); } catch (e) { failCard(e); }
  }
  window.addEventListener('hashchange', () => { pendingToast = null; render(); setTimeout(refreshPips, 50); });
  setTimeout(refreshPips, 800);
  document.addEventListener('DOMContentLoaded', start);
  window.GW = { refresh, start };
})();
