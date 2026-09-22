/* Greenwich Works — the portal.  Data layer.
   One interface, two implementations: Supabase for the real thing, and an
   in-browser store for demo mode.  Every screen talks only to `API`.

   The two must answer the same question with the same shape.  Demo mode is
   what the office shows people, and what the portal falls back to if Supabase
   is down on the day, so a field the live adapter returns and the demo one
   does not is a screen that works in the rehearsal and breaks in the hall.
   Anything shared between the two — the late penalty, the mark validation,
   the date arithmetic — lives above both of them and is written once. */
(function () {
  'use strict';
  const CFG = window.GW_CONFIG;

  const err = m => { const e = new Error(m); e.friendly = true; return e; };

  /* What Supabase says, turned into something a student can act on.  The
     database's own refusals (raised with P0001) are already written for the
     reader and go through as they are; everything else used to reach the
     screen raw — "JWT expired", "new row violates row-level security policy". */
  function friendly(error) {
    const raw = String((error && (error.message || error.error_description || error.msg)) || '');
    const code = String((error && (error.code || error.error_code || error.status)) || '');
    const m = raw.toLowerCase();
    let msg;
    if (code === 'P0001' && raw) msg = raw;
    else if (/invalid login credentials/.test(m)) msg = 'That roll number (or handle) and password do not match. Check both and try again.';
    else if (/already registered|already been registered|user_already_exists/.test(m + code)) msg = 'This account has already been started.';
    else if (/should be different from the old password|same_password/.test(m + code)) msg = 'That is the password you already have. Choose a different one.';
    else if (/password should be|weak_password|at least \d+ characters/.test(m + code)) msg = 'That password is too short or too simple. Use at least eight characters.';
    else if (/rate limit|too many requests|over_request_rate_limit|over_email_send_rate_limit/.test(m + code) || code === '429')
      msg = 'Too many people are signing in from this network at once. Wait a minute and try again.';
    else if (/jwt expired|invalid jwt|session.*(missing|expired)|refresh token/.test(m)) msg = 'You have been signed out because the session ran out. Sign in again.';
    else if (/failed to fetch|networkerror|load failed|network request failed/.test(m)) msg = 'The portal cannot reach the database. Check your connection and try again.';
    else if (/row-level security|permission denied|not authorized|42501/.test(m + code)) msg = 'That is not yours to do. If you think it should be, tell the front desk.';
    else if (/mime type|not supported/.test(m)) msg = 'That kind of file is not accepted. Send a PDF, Word, PowerPoint, spreadsheet, zip or photograph.';
    else if (/exceeded the maximum allowed size|payload too large|entity too large/.test(m)) msg = 'That file is larger than 60 MB. Split it, or compress the images.';
    else if (/resource already exists|duplicate/.test(m)) msg = 'That has already been sent. Reload the page and look again before sending it twice.';
    else msg = 'Something went wrong on our side. Try again; if it happens twice, tell the front desk what you were doing.';
    if (msg !== raw) console.error('[gw] database said:', code, raw);
    return err(msg);
  }
  const today = () => new Date();
  const iso = d => d.toISOString().slice(0, 10);

  const MB = 1024 * 1024;
  const MAX_UPLOAD = 60 * MB;              // the bucket's own limit, said early
  const STORAGE_LIMIT = 1024 * MB;         // the free tier, which is the worry
  const LAST_DAY = '2026-12-15';           // the Karachi Review; nothing after it
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no I, O, 0, 1

  // Every date in this programme is a Karachi date.  The browser may be
  // anywhere, and a Folio filed at 01:00 on the 13th in London is the 12th
  // here, which is the difference between on time and five marks.
  const KDAY = new Intl.DateTimeFormat('en-CA',
    { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
  const KTIME = new Intl.DateTimeFormat('en-GB',
    { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false });
  const kDay = t => KDAY.format(t instanceof Date ? t : new Date(t));
  const kTime = t => KTIME.format(t instanceof Date ? t : new Date(t));
  const daysBetween = (a, b) =>
    Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5);
  // Calendar arithmetic on 'YYYY-MM-DD' strings, done in UTC so that the
  // reader's own timezone never moves a day.  The old code built a LOCAL
  // midnight and printed it with toISOString(): in Karachi (UTC+5) that is
  // 19:00 the evening before, so every day in the diary came out one early.
  const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  // A Karachi wall-clock day and time as an instant.  Karachi has no summer time.
  const kInstant = (day, time) => new Date(day + 'T' + (time || '00:00') + ':00+05:00');

  // Five of the twenty a week, capped at twenty.  This is submit_handin()'s
  // arithmetic, repeated here only so demo mode shows the same number the
  // database would have written; the live adapter never computes it.
  function lateness(dueOn, when, cap, rule) {
    if (!dueOn) return { days_late: 0, penalty: 0 };
    const late = Math.max(0, daysBetween(kDay(when || today()), dueOn));
    const weeks = rule === 'full' ? Math.floor(late / 7) : Math.ceil(late / 7);
    return { days_late: late, penalty: late <= 0 ? 0 : Math.min(cap || 20, weeks * 5) };
  }
  /* the fixed rubric of an individual mark: Stage 3's save_lens_mark() / save_pc_* bounds */
  const LENS_MAX = { substance: 8, evidence: 4, integration: 3, presentation: 3, revision: 2, viva: 10 };
  const ORAL_MAX = { command: 15, defends: 10, unexpected: 10, presents: 5 };
  const ORAL_LABEL = { command: 'Command of the subject', defends: 'Defends the choices',
                       unexpected: 'Answers the unexpected', presents: 'Presents clearly' };
  function checkInts(obj, max, labels) {
    const out = {};
    for (const k in max) {
      const n = whole(obj[k]);
      if (isNaN(n) || n < 0 || n > max[k]) throw err((labels && labels[k] || (k[0].toUpperCase() + k.slice(1))) + ' runs from 0 to ' + max[k] + '.');
      out[k] = n;
    }
    return out;
  }

  const fakeCode = () => {
    let s = '';
    for (let i = 0; i < 6; i++) {
      s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      if (i === 2) s += '-';
    }
    return s;
  };

  // A deterministic 0…1 from a string.  Demo mode invents its dashboard
  // numbers, and they have to be the same numbers on every reload and on
  // every laptop, or a demonstration looks like a bug.
  function hash01(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100000) / 100000;
  }

  /* ---- marks: one validation, used by both adapters -------------------- */
  const RUBRIC_MAX = { substance: 8, evidence: 4, integration: 3, presentation: 3, revision: 2 };
  const blank = v => v === '' || v == null;
  const whole = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : NaN; };

  // save_marks() bounds every number it is handed, but `null not between 0 and 8`
  // is null rather than false, so the database accepts and stores a blank line.
  // That is what makes "save without submitting" possible, and it is the only
  // reading of the SQL that lets a teacher stop half way down a team.  The full
  // check is therefore the app's, and it runs only when the marks are submitted.
  // The two rules the database enforces whatever happens — the ranges, and a
  // reason for any adjustment — are checked here on every save.
  function checkMarks(rubric, members, submit) {
    const R = {};
    for (const k in RUBRIC_MAX) {
      const bad = () => err('The ' + k + ' mark must be between 0 and ' + RUBRIC_MAX[k] + '.');
      if (blank(rubric[k])) { if (submit) throw bad(); R[k] = null; continue; }
      const n = whole(rubric[k]);
      if (isNaN(n) || n < 0 || n > RUBRIC_MAX[k]) throw bad();
      R[k] = n;
    }
    const M = (members || []).map(m => {
      const adj = blank(m.adjustment) ? 0 : whole(m.adjustment);
      if (isNaN(adj) || adj < -3 || adj > 3) throw err('The individual adjustment runs from −3 to +3.');
      const comment = (m.comment || '').trim();
      if (adj !== 0 && !comment)
        throw err('An adjustment of ' + adj + ' for ' + m.roll +
                  ' needs a one-line reason — the viva, or the charter.');
      const ten = key => {
        if (blank(m[key])) {
          if (submit) throw err('The viva runs from 0 to 10.');
          return null;
        }
        const n = whole(m[key]);
        if (isNaN(n) || n < 0 || n > 10) throw err('The viva runs from 0 to 10.');
        return n;
      };
      /* participation is no longer a mark (AG.2): always sent empty */
      return { roll: m.roll, adjustment: adj, viva: ten('viva'),
               participation: null, comment: comment || null };
    });
    return { rubric: R, members: M };
  }

  const folio20 = m => (m.substance || 0) + (m.evidence || 0) + (m.integration || 0)
                     + (m.presentation || 0) + (m.revision || 0);
  const total40 = m => Math.max(0, Math.min(30, folio20(m)          // the project 30 (AG.2)
                     + (m.adjustment || 0) + (m.viva || 0)));

  /* ============================================================ DEMO ==== */
  function DemoAPI() {
    const S = JSON.parse(JSON.stringify(window.GW_DEMO));
    const KEY = 'gw-portal-demo-v2';       /* v2: Stage 3 added tables; an old v1 store is left alone */
    let state = { session: null, handins: [], bookings: [], reports: [], teams: {},
                  claimed: {}, tries: {}, marks: [],
                  /* Stage 3 */ settings: {}, lens_marks: [], pc_marks: [], supervision: [], closed: [],
                  waivers: [], checks: [], defences: {}, exceptions: [], choices: {}, audit: [] };
    try { const raw = localStorage.getItem(KEY); if (raw) state = Object.assign(state, JSON.parse(raw)); } catch (e) {}
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
    let dashCache = null;
    /* BUG, found by the headless run of 21 September: ids were the prefix plus
       the millisecond, so two rows made in the same millisecond took the SAME
       one — a team that filed its ethics sheet and its field plan back to back
       had two hand-ins carrying one id, and acceptHandin() acted on whichever
       came first.  One counter, and no two rows the same. */
    let seq = 0;
    const newId = pre => pre + Date.now().toString(36) + '-' + (++seq);

    // slots, generated the same way the database does
    const slots = [];
    (function () {
      const B = S.booking, [h0] = B.day_start.split(':').map(Number), [h1] = B.day_end.split(':').map(Number);
      let id = 1;
      for (let d = B.first_day; d <= B.last_day; d = addDays(d, 1)) {
        for (let h = h0; h < h1; h++) for (let m = 0; m < 60; m += B.slot_minutes)
          slots.push({ id: id++, day: d, time: String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') });
      }
    })();

    // One invented postgraduate-programme student, so the "ordinary classes, no
    // team, no project" screen can be shown.  Last in the list, never the default.
    const PG_ROLL = 'DM00 00001';
    S.students[PG_ROLL] = { roll: PG_ROLL, name: 'Demo Postgraduate', major: '', prog: 'MS', dept: 'Demo',
      track: '', team: null, block: null, courses: [], marking: [], lens: [],
      status: 'postgraduate — no team' };

    const team = id => Object.assign({}, S.teams[id], state.teams[id] || {});
    const meRoll = () => state.session && state.session.roll;
    const nameOfRoll = roll => (S.students[roll] || {}).name || roll || '';
    const typeRows = () => S.handins.map((t, i) => ({ key: t[0], label: t[1], scope: t[2],
                                                      due_on: t[3], applies: t[6], sort: i + 1 }));
    const typeOf = key => typeRows().find(t => t.key === key) || {};

    // The teams this account may see, which is what the SQL now leaves visible:
    // the office everything, a convener their blocks, a teacher the teams one of
    // their own courses marks, a student their own team.  The demo used to scope
    // every staff role by block, which showed a teacher 23 blocks of students
    // that roster_read no longer lets them read.
    function visibleTeams() {
      const ses = state.session || {};
      const all = Object.keys(S.teams).map(team);
      if (ses.role === 'office') return all;
      if (ses.role === 'convener') return all.filter(t => (ses.blocks || []).includes(t.block));
      if (ses.role === 'teacher') return all.filter(t => (t.marking || [])
        .some(c => (ses.courses || []).includes(c)));
      const st = S.students[meRoll()];
      return st ? all.filter(t => t.id === st.team) : [];
    }

    // days_late and penalty are columns now, written by the database at upload.
    // Rows already in this browser predate them, so they are worked out on read.
    const setting = k => (state.settings[k] != null ? state.settings[k] : (S.settings || {})[k]);
    const capOf = key => key === 'pcproj' ? 30 : 20;
    const hand = h => {
      const l = lateness(typeOf(h.type_key).due_on, h.submitted_at, capOf(h.type_key), setting('late_week_rule'));
      return Object.assign({ days_late: l.days_late, penalty: l.penalty }, h,
        { by: h.by || nameOfRoll(h.roll) || 'A team member' });
    };
    /* who owes what: [roll, course, regime, pos] from make_demo.py */
    const paths = () => (S.student_courses || []).map(x => ({ roll: x[0], course: x[1], regime: x[2], pos: x[3] }));
    const regimeOf = (roll, course) => (paths().find(x => x.roll === roll && x.course === course) || {}).regime;
    const courseRow = code => S.courses.find(c => c.code === code) || { code, title: code, teachers: [] };
    const kToday = () => kDay(today());
    const isClosed = c => state.closed.indexOf(c) >= 0;
    const log = (action, detail) => { state.audit.push({ at: new Date().toISOString(), action, detail, by: (state.session || {}).name }); };
    /* 22 Sep, register BF: the trackers' rows — a row with an id updates, without one inserts; returns the id */
    const upsertRow = (list, row, keys, action) => {
      const clean = {}; keys.forEach(k => { const v = row[k]; clean[k] = v === '' ? null : (v === true || v === false ? v : v == null ? null : String(v)); });
      if (typeof clean.wave !== 'undefined' && clean.wave != null) clean.wave = Number(clean.wave);
      let id = row.id ? Number(row.id) : null;
      if (id) { const i = list.findIndex(x => x.id === id); if (i < 0) throw err('No such row.'); list[i] = Object.assign({}, list[i], clean, { updated_at: new Date().toISOString() }); }
      else { id = Date.now() + Math.floor(Math.random() * 1000); list.push(Object.assign({ id, updated_at: new Date().toISOString() }, clean)); }
      log(action, { id }); save(); return id;
    };
    const mayMark = (course, roll, regimes) => {
      const who = state.session || {};
      if (!(who.courses || []).includes(course)) throw err('You do not mark ' + course + '. Only the course teacher enters its marks.');
      if (isClosed(course)) throw err('Marking for ' + course + ' is closed. The office can reopen it, with a reason.');
      const r = regimeOf(roll, course);
      if (!r) throw err('That student is not enrolled in ' + course + '.');
      if (regimes.indexOf(r) < 0) throw err('That is not how ' + course + ' marks this student: the register has them as "' + r + '".');
      return r;
    };
    const weeks = () => { const a = +setting('supervision_first_n'), b = +setting('supervision_last_n');
      return (S.sessions || []).filter(x => x[0] >= a && x[0] <= b && /^session/i.test(x[3] || '')).map(x => x[0]); };
    const supervision = (course, roll) => {
      const w = weeks();
      const rows = state.supervision.filter(x => x.course === course && x.roll === roll && w.indexOf(x.session_n) >= 0);
      const held = rows.filter(x => x.held).length, confirmed = rows.filter(x => x.held && x.confirmed).length;
      const pct = w.length ? Math.floor(100 * held / w.length) : 0;
      const signed = held > 0 && confirmed === held;
      const excepted = state.exceptions.some(x => x.course === course && x.roll === roll);
      return { expected: w.length, held, confirmed, pct, signed, excepted,
               may_sit: excepted || (w.length > 0 && pct >= +setting('supervision_pct') && signed) };
    };
    const runsTeam = tid => { const ses = state.session || {}; const t = S.teams[tid];
      return !!t && (ses.role === 'office' || (ses.role === 'convener' && (ses.blocks || []).includes(t.block))); };
    const isConv = () => ['convener', 'office'].indexOf((state.session || {}).role) >= 0;
    const waived = (kind, target, course) => state.waivers.some(w => !w.withdrawn_at && w.kind === kind
      && (kind === 'folio' ? w.team_id === target : w.roll === target) && (kind !== 'lens' || w.course === course));
    const latestOf = (key, owner, course) => state.handins.filter(h => h.type_key === key
      && (key === 'lens' || key === 'pcproj' ? h.roll === owner : h.team_id === owner)
      && (key !== 'lens' || h.course === course)).sort((a, b) => b.version - a.version)[0];
    const netOf = (key, owner, course, cap, raw20, extra) => {
      const h = latestOf(key, owner, course);
      const l = h ? lateness(typeOf(key).due_on, h.submitted_at, cap, setting('late_week_rule')) : { days_late: null, penalty: 0 };
      const w = waived(key === 'folio' ? 'folio' : key === 'lens' ? 'lens' : 'pcproj', owner, course);
      const pen = w ? 0 : l.penalty;
      return { days_late: l.days_late, penalty_due: l.penalty, waived: w, penalty: pen,
               raw_30: raw20 + extra, net_30: Math.max(0, raw20 - pen) + extra };
    };
    /* the menu → full projects → choice sequence, by the settings' dates */
    const stage = () => { const t = kToday();
      return t >= setting('choice_from') ? 'choice' : t >= setting('full_from') ? 'full' : t >= setting('menu_from') ? 'menu' : 'before'; };
    const projectRows = forStaff => (S.projects || []).filter(p => !p.reserve || forStaff).map(p => {
      const full = forStaff || stage() === 'full' || stage() === 'choice';
      return Object.assign({ id: p.id, block: p.block, lane: p.lane, title: p.title, problem: p.problem,
        authority: p.authority, reserve: !!p.reserve, full },
        full ? { work: p.work, made: p.made, skill: p.skill, tier3_expected: !!p.tier3_expected } : {});
    });
    const bkg = b => Object.assign({}, b,
      { day: b.day, time: b.time, starts_at: b.starts_at || (b.day + 'T' + b.time + ':00+05:00') });

    return {
      mode: 'demo',
      demoRoster: () => Object.values(S.students).map(s => ({ roll: s.roll, name: s.name, team: s.team })),
      demoPostgraduate: () => PG_ROLL,

      async session() { return state.session; },

      async signIn(roll, password) {
        const s = S.students[roll.trim().toUpperCase()] || Object.values(S.students).find(x => x.roll.replace(/\s/g, '') === roll.replace(/\s/g, '').toUpperCase());
        if (!s) throw err('That roll number is not on the register.');
        if (!state.claimed[s.roll]) throw err('This account has not been set up yet. Use “First time here”.');
        if (state.claimed[s.roll] !== password) throw err('Wrong password.');
        state.session = { roll: s.roll, name: s.name, role: 'student' }; save(); return state.session;
      },
      async claim(roll, code, password) {
        const s = S.students[roll.trim().toUpperCase()] || Object.values(S.students).find(x => x.roll.replace(/\s/g, '') === roll.replace(/\s/g, '').toUpperCase());
        if (!s) throw err('That roll number is not on the register. Ask the front desk.');
        if (state.claimed[s.roll])
          throw err('This account has already been set up. Sign in, or ask the front desk to reset it.');
        // the same eight tries in a rolling hour verify_claim() counts, so a
        // demonstration of the lock-out behaves the way the real one does
        const t = state.tries[s.roll] || { n: 0, at: 0 };
        if (t.n >= 8 && Date.now() - t.at < 36e5)
          throw err('Too many attempts on this roll number. Try again in an hour, or ask the front desk.');
        if (code.replace(/[^A-Za-z0-9]/g, '').toUpperCase() !== 'DEMO') {
          const n = (Date.now() - t.at > 36e5) ? 1 : t.n + 1;
          state.tries[s.roll] = { n, at: Date.now() }; save();
          const left = Math.max(0, 8 - n);
          throw err(left > 0
            ? 'That code does not match this roll number. ' + left + ' more attempts. In demo mode the code is the word DEMO.'
            : 'That code does not match, and this roll number is now locked for an hour.');
        }
        state.claimed[s.roll] = password;
        delete state.tries[s.roll];
        state.session = { roll: s.roll, name: s.name, role: 'student' }; save(); return state.session;
      },
      async signInAs(role) {   // demo only: look at the staff views
        const anyTeam = Object.values(S.teams)[0] || { marking: [] };
        state.session = { roll: null,
          name: role === 'office' ? 'Front desk' : role === 'teacher' ? 'Teacher of record' : 'Block convener',
          role, blocks: Object.keys(S.blocks),
          courses: role === 'teacher' ? (S.teacher_courses || (anyTeam.marking || []).slice(0, 3)) : [] };
        dashCache = null; save(); return state.session;
      },
      async signOut() { state.session = null; dashCache = null; save(); },

      async changePassword(next) {
        const ses = state.session; if (!ses) throw err('Not signed in.');
        if (ses.roll) state.claimed[ses.roll] = next;
        ses.must_change = false; save(); return ses;
      },

      async bootstrap() {
        dashCache = null;                       // one dash() per render, like live
        const ses = state.session; if (!ses) return null;
        const allSettings = Object.assign({}, S.settings || {}, state.settings);
        const out = { profile: ses, term: S.term, sessions: S.sessions, handinTypes: S.handins,
                      booking: S.booking, blocks: S.blocks, courses: S.courses,
                      settings: allSettings, stage: stage(), closed: state.closed.slice(),
                      choices: Object.keys(state.choices).map(c => ({ course: c, midterm: state.choices[c] })) };
        if (ses.role === 'student') {
          const st = S.students[ses.roll];
          if (!st) return null;
          const mine = paths().filter(x => x.roll === st.roll).sort((a, b) => a.pos - b.pos);
          out.me = Object.assign({}, st, { team_id: st.team,
            lens_courses: mine.filter(x => x.regime === 'lens').map(x => x.course),
            project_courses: mine.filter(x => x.regime === 'project').map(x => x.course) });
          out.myCourses = mine.map(x => Object.assign({ title: courseRow(x.course).title, teachers: courseRow(x.course).teachers }, x));
          out.projects = st.block ? projectRows(false).filter(p => p.block === st.block) : [];
          out.team = st.team ? team(st.team) : null;
          out.mates = out.team ? out.team.members.map(r => S.students[r]) : [];
          out.handins = state.handins.filter(h => h.team_id === st.team || h.roll === st.roll).map(hand);
          out.bookings = state.bookings.filter(b => (b.team_id === st.team || b.roll === st.roll) && b.state === 'booked').map(bkg);
          out.supervision = state.supervision.filter(x => x.roll === st.roll);
          out.defence = state.defences[st.roll] || null;
        } else {
          out.projects = projectRows(true);
          const teams = visibleTeams();
          const ids = teams.map(t => t.id);
          out.myBlocks = ses.role === 'office' ? Object.keys(S.blocks)
                                               : [...new Set(teams.map(t => t.block))];
          out.teams = teams;
          out.roster = Object.values(S.students).filter(s => ids.indexOf(s.team) >= 0)
            .map(s => ({ roll: s.roll, name: s.name, team_id: s.team, block: s.block,
                         status: s.status, claimed_at: state.claimed[s.roll] ? '2026-09-09' : null }));
          out.handins = state.handins
            .filter(h => ids.indexOf(h.team_id) >= 0 || ids.indexOf((S.students[h.roll] || {}).team) >= 0)
            .map(hand);
          out.bookings = state.bookings.filter(b => b.state === 'booked').map(bkg);
          out.reports = state.reports;
        }
        return out;
      },

      async slotsFor(day) {
        const taken = new Set(state.bookings.filter(b => b.state === 'booked').map(b => b.slot_id));
        return slots.filter(s => s.day === day).map(s => Object.assign({}, s, {
          taken: taken.has(s.id),
          bookable: kInstant(s.day, s.time) > new Date(Date.now() + 864e5),
          mine: state.bookings.some(b => b.slot_id === s.id && b.state === 'booked' &&
                 (b.roll === meRoll() || b.team_id === (S.students[meRoll()] || {}).team))
        }));
      },
      async slotCounts(days) {
        const taken = new Set(state.bookings.filter(b => b.state === 'booked').map(b => b.slot_id));
        return days.map(d => {
          const all = slots.filter(s => s.day === d);
          const ahead = new Date(Date.now() + 864e5);
          return { day: d, total: all.length,
                   free: all.filter(s => !taken.has(s.id) && kInstant(s.day, s.time) > ahead).length };
        });
      },
      async book(slotId, win, what) {
        const st = S.students[meRoll()]; if (!st) throw err('Only students book sessions.');
        const w = S.booking.windows.find(x => x.key === win);
        const slot = slots.find(s => s.id === slotId);
        if (!slot) throw err('That slot is not open.');
        if (kInstant(slot.day, slot.time) < new Date(Date.now() + 864e5))
          throw err('Sessions are booked at least a day ahead.');
        if (slot.day < w.opens || slot.day > w.closes) throw err('That slot is outside the ' + w.label + ' window.');
        if (state.bookings.some(b => b.slot_id === slotId && b.state === 'booked')) throw err('Somebody took that slot a moment ago.');
        if (!what.trim()) throw err('Say in one sentence what is stuck.');
        const scope = w.who;
        if (scope === 'team' && state.bookings.some(b => b.team_id === st.team && b.window_key === win && b.state === 'booked'))
          throw err('Your team already holds a slot in this window. Cancel it first.');
        if (scope === 'student' && state.bookings.some(b => b.roll === st.roll && b.window_key === 'ind' && b.state === 'booked'))
          throw err('You already hold an individual slot. Cancel it first.');
        state.bookings.push({ id: newId('b'), slot_id: slotId, day: slot.day, time: slot.time,
          starts_at: slot.day + 'T' + slot.time + ':00+05:00',
          team_id: scope === 'team' ? st.team : null, roll: scope === 'team' ? null : st.roll,
          window_key: win, what_is_stuck: what.trim(), state: 'booked', by: st.name });
        save();
      },
      async cancelBooking(id) {
        const b = state.bookings.find(x => x.id === id); if (!b) throw err('No such booking.');
        const ses = state.session || {}, st = S.students[meRoll()] || {};
        if (!(ses.role === 'office' || (b.roll && b.roll === st.roll) || (b.team_id && b.team_id === st.team)))
          throw err('Not yours to cancel.');
        b.state = 'cancelled'; save();
      },
      async submitHandin(typeKey, file, note) {
        const st = S.students[meRoll()]; if (!st) throw err('Only students hand in.');
        const t = typeOf(typeKey);
        if (!t.key) throw err('Unknown hand-in.');
        // the three refusals submit_handin() makes, in the same words
        if (kDay(today()) > LAST_DAY)
          throw err('Nothing is accepted after the Karachi Review on 15 December. Speak to your convener.');
        if (file && file.size > MAX_UPLOAD)
          throw err('That file is larger than 60 MB. Split it, or compress the images.');
        if (kDay(today()) > (setting('last_acceptance_date') || LAST_DAY))
          throw err('Nothing is accepted after the Karachi Review on 15 December. Speak to your convener.');
        const individual = t.scope === 'individual';
        // Stage 3: a lens note is filed PER COURSE; the project for the courses studied as a
        // project is ONE joined file (register AL.5).  The same refusals as submit_handin().
        let course = null;
        if (typeKey === 'lens') {
          course = arguments[3] || null;
          const r = course ? regimeOf(st.roll, course) : null;
          if (!course || !r) throw err('You are not enrolled in that course.');
          if (r === 'viva30') throw err(course + ' sets you no written piece: you already write two lens notes, so it marks your viva out of 30.');
          if (r !== 'lens') throw err(course + ' does not set you a lens note.');
        } else if (t.applies === 'project_course') {
          if (!paths().some(x => x.roll === st.roll && x.regime === 'project')) throw err('You study no course as a project.');
        }
        const owner = individual ? { roll: st.roll, team_id: null, course } : { team_id: st.team, roll: null, course: null };
        const prev = state.handins.filter(h => h.type_key === typeKey &&
                       (individual ? (h.roll === st.roll && (h.course || null) === course) : h.team_id === st.team));
        const at = new Date().toISOString();
        const l = lateness(t.due_on, at, capOf(typeKey), setting('late_week_rule'));
        state.handins.push(Object.assign({ id: newId('h'), type_key: typeKey,
          file_name: file ? file.name : 'link', file_size: file ? file.size : 0, note: note || '',
          submitted_at: at, by: st.name, state: 'submitted', version: prev.length + 1,
          days_late: l.days_late, penalty: l.penalty }, owner));
        dashCache = null;
        save();
      },
      // demo mode has no storage behind it, and a link to nothing is worse than
      // no link: the caller shows the file name instead.
      async fileUrl() { return null; },
      async patchesTaken(projectId, custom) {
        const key = t => (t.project_id && t.project_id === projectId)
          || (!projectId && custom && (t.project_custom || '').toLowerCase() === custom.toLowerCase());
        return Object.keys(S.teams).map(id => Object.assign({ id }, S.teams[id], state.teams[id] || {}))
          .filter(t => key(t) && t.patch && t.project_state !== 'returned')
          .map(t => ({ team_id: t.id, patch: t.patch }));
      },
      async claimProject(projectId, custom, patch, fieldwork) {
        const st = S.students[meRoll()]; if (!st) throw err('Only students choose a project.');
        if (!projectId && !(custom || '').trim())
          throw err('Choose a project from your block’s list, or describe your own.');
        const pt = (patch || '').trim();
        if (!pt) throw err('Name your site or area — where, or on whom, your team will work. At most two teams take one project, and only on different sites.');
        if (pt.length < 3) throw err('Say a little more about the site or area than that.');
        const cur = team(st.team);
        if (stage() !== 'choice') throw err('Teams make their final choice at Session 6, with their convener. Your convener will tell you when.');
        if (cur.project_state === 'approved') throw err('Your convener has approved your project. Only your convener can reopen the choice.');
        if (projectId) {
          const pr = S.projects.find(p => p.id === projectId);
          if (!pr || pr.block !== cur.block) throw err('That project belongs to another block.');
          if (pr.reserve) throw err('That project is on the reserve list and is not offered this term.');
          const others = Object.keys(S.teams).map(team).filter(t => t.id !== st.team && t.project_id === projectId && t.project_state !== 'returned');
          if (others.length >= +(setting('max_teams_per_project') || 2))
            throw err('Two teams have already taken that project. At most two teams take one project — choose another.');
        }
        if (cur.fieldwork && !fieldwork && (cur.ethics_tier != null ||
            state.handins.some(h => h.team_id === st.team && (h.type_key === 'ethics' || h.type_key === 'field'))))
          throw err('Your team is on record as doing fieldwork. Only your convener can take that off.');
        const taken = await this.patchesTaken(projectId, custom);
        if (taken.some(x => x.team_id !== st.team && x.patch.trim().toLowerCase() === pt.toLowerCase()))
          throw err('Another team on this project has already taken that site or area. Choose a different one — the list on screen shows what is gone.');
        state.teams[st.team] = Object.assign({}, state.teams[st.team] || {}, {
          project_id: projectId || null, project_custom: (custom || '').trim() || null,
          patch: pt, fieldwork: !!fieldwork, project_state: 'chosen', project_note: null,
          project_decided_by: null, project_decided_at: null }); log('project', { team: st.team }); save();
      },
      async report(aboutRoll, body) {
        const st = S.students[meRoll()];
        state.reports.push({ id: newId('r'), team_id: st.team, about_roll: aboutRoll,
          by_roll: st.roll, body, state: 'open', created_at: new Date().toISOString() });
        save();
      },
      async resolveReport(id, outcome) {
        const r = state.reports.find(x => x.id === id); if (r) { r.state = 'resolved'; r.outcome = outcome; save(); }
      },
      // the office reissues a claim code.  The demo makes one up in the shape
      // the slips are printed in, and un-claims the account so it can be shown
      // being set up again.
      async resetClaim(roll) {
        const ses = state.session || {};
        if (ses.role !== 'office') throw err('Only the office resets accounts.');
        const s = S.students[(roll || '').trim().toUpperCase()];
        if (!s) throw err('Unknown roll number.');
        delete state.claimed[s.roll]; delete state.tries[s.roll]; save();
        return { code: fakeCode() };
      },

      /* ---- marking ------------------------------------------------- */
      async myMarkingCourses() {
        const ses = state.session || {};
        const mine = visibleTeams();
        const codes = ses.role === 'teacher' ? (ses.courses || [])
          : [...new Set(mine.flatMap(t => t.marking || []))];
        return codes.map(code => {
          const teams = mine.filter(t => (t.marking || []).includes(code));
          const done = teams.filter(t => state.marks.some(m => m.course === code && m.team_id === t.id && m.submitted)).length;
          const co = S.courses.find(c => c.code === code) || {};
          // `course` is what the new views and my_marking_progress() call it;
          // `code` is what the marking screen has always read.  One row, both.
          return { course: code, code, title: co.title || code, teams: teams.length, done,
                   students: teams.reduce((a, t) => a + (t.members || [])
                     .filter(r => ((S.students[r] || {}).courses || []).includes(code)).length, 0) };
        }).filter(c => c.teams > 0).sort((a, b) => a.code < b.code ? -1 : 1)
        .concat(ses.role === 'teacher' ? (ses.courses || []).filter(code => !codes.includes(code) || !mine.some(t => (t.marking || []).includes(code)))
          .map(code => {
            const ps = paths().filter(x => x.course === code && ['lens', 'viva30', 'project'].indexOf(x.regime) >= 0);
            if (!ps.length) return null;
            const co = courseRow(code);
            const done = ps.filter(x => x.regime === 'project'
              ? state.pc_marks.some(m => m.course === code && m.roll === x.roll && m.project_submitted)
              : state.lens_marks.some(m => m.course === code && m.roll === x.roll && m.submitted)).length;
            return { course: code, code, title: co.title || code, teams: 0, done, students: ps.length,
                     lens: ps.filter(x => x.regime === 'lens').length, viva30: ps.filter(x => x.regime === 'viva30').length,
                     project: ps.filter(x => x.regime === 'project').length, regime: co.regime };
          }).filter(Boolean) : [])
        .map(c => Object.assign({ closed: isClosed(c.code), regime: courseRow(c.code).regime }, c));
      },
      // the same three lists a teacher gets from the database: who is on an individual path in this course
      async individualsFor(course) {
        const ps = paths().filter(x => x.course === course && ['lens', 'viva30', 'project'].indexOf(x.regime) >= 0);
        return ps.map(x => {
          const st = S.students[x.roll] || {};
          const lm = state.lens_marks.find(m => m.course === course && m.roll === x.roll) || null;
          const pm = state.pc_marks.find(m => m.course === course && m.roll === x.roll) || null;
          const h = x.regime === 'project' ? latestOf('pcproj', x.roll) : x.regime === 'lens' ? latestOf('lens', x.roll, course) : null;
          const row = { roll: x.roll, name: st.name, team_id: st.team, regime: x.regime, handin: h ? hand(h) : null,
                        lens: lm, pc: pm, closed: isClosed(course) };
          if (lm) row.net = lm.kind === 'lens' ? netOf('lens', x.roll, course, 20, folio20(lm), lm.viva || 0)
                                               : { raw_30: lm.viva30, net_30: lm.viva30, penalty: 0, waived: false };
          if (pm) row.net = netOf('pcproj', x.roll, null, 30, pm.project || 0, 0);
          if (x.regime === 'project') {
            row.supervision = supervision(course, x.roll);
            row.log = state.supervision.filter(y => y.course === course && y.roll === x.roll);
            row.defence = state.defences[x.roll] || null;
            row.exception = state.exceptions.find(y => y.course === course && y.roll === x.roll) || null;
            row.midterm = state.choices[course] || null;
          }
          return row;
        }).sort((a, b) => (a.regime + a.roll) < (b.regime + b.roll) ? -1 : 1);
      },
      async saveLensMark(course, roll, marks, submit) {
        const r = mayMark(course, roll, ['lens', 'viva30']);
        const at = new Date().toISOString();
        const was = state.lens_marks.find(m => m.course === course && m.roll === roll);
        let row;
        if (r === 'lens') {
          if (marks.viva30 != null && marks.viva30 !== '') throw err('This student writes a lens note for ' + course + ': it is marked 20 + 10, not as a viva out of 30.');
          row = Object.assign({ course, roll, kind: 'lens', viva30: null }, checkInts(marks, LENS_MAX, { viva: 'The viva' }));
        } else {
          if (['substance', 'evidence', 'integration', 'presentation', 'revision', 'viva'].some(k => marks[k] != null && marks[k] !== ''))
            throw err('This is the student\u2019s third lens course or later: ' + course + ' sets no written piece and marks the viva out of 30 (one number).');
          const v = whole(marks.viva30); if (isNaN(v) || v < 0 || v > 30) throw err('The viva out of 30 runs from 0 to 30.');
          row = { course, roll, kind: 'viva30', viva30: v, substance: null, evidence: null, integration: null, presentation: null, revision: null, viva: null };
        }
        Object.assign(row, { comment: (marks.comment || '').trim() || null, submitted: !!submit,
          submitted_at: submit ? at : (was ? was.submitted_at : null), marked_at: at });
        state.lens_marks = state.lens_marks.filter(m => !(m.course === course && m.roll === roll)).concat([row]);
        log(submit ? 'lens_mark_submit' : 'lens_mark_save', { course, roll, was, now: row }); dashCache = null; save();
        return r;
      },
      async savePcProject(course, roll, project, comment, submit) {
        mayMark(course, roll, ['project']);
        const n = whole(project); if (isNaN(n) || n < 0 || n > 30) throw err('The project runs from 0 to 30.');
        const was = state.pc_marks.find(m => m.course === course && m.roll === roll) || { course, roll };
        const row = Object.assign({}, was, { project: n, comment: (comment || '').trim() || null, project_submitted: !!submit, marked_at: new Date().toISOString() });
        state.pc_marks = state.pc_marks.filter(m => !(m.course === course && m.roll === roll)).concat([row]);
        log(submit ? 'pc_project_submit' : 'pc_project_save', { course, roll }); dashCache = null; save();
      },
      async savePcDefence(course, roll, scores, submit) {
        mayMark(course, roll, ['project']);
        const sup = supervision(course, roll);
        if (!sup.may_sit) throw err('The score page is locked: ' + sup.held + ' of ' + sup.expected + ' supervision hours are logged ('
          + sup.pct + ' per cent; the rule is ' + setting('supervision_pct') + ' per cent)'
          + (sup.held > 0 && !sup.signed ? ', and the student has not confirmed every hour' : '')
          + '. The office can record an exception, with a written reason.');
        const v = checkInts(scores, ORAL_MAX, ORAL_LABEL);
        const was = state.pc_marks.find(m => m.course === course && m.roll === roll) || { course, roll };
        const row = Object.assign({}, was, v, { oral_comment: (scores.comment || '').trim() || null, oral_submitted: !!submit, marked_at: new Date().toISOString() });
        state.pc_marks = state.pc_marks.filter(m => !(m.course === course && m.roll === roll)).concat([row]);
        log(submit ? 'pc_defence_submit' : 'pc_defence_save', { course, roll }); dashCache = null; save();
        return v.command + v.defends + v.unexpected + v.presents;
      },
      async logSupervision(course, roll, sessionN, held, note) {
        mayMark(course, roll, ['project']);
        if (weeks().indexOf(sessionN) < 0) throw err('That week is not one of the supervision weeks.');
        const ses = (S.sessions || []).find(x => x[0] === sessionN);
        if (ses && ses[1] > kToday()) throw err('That week has not begun. The log is filled week by week.');
        const was = state.supervision.find(x => x.course === course && x.roll === roll && x.session_n === sessionN);
        state.supervision = state.supervision.filter(x => !(x.course === course && x.roll === roll && x.session_n === sessionN));
        if (held != null) state.supervision.push({ course, roll, session_n: sessionN, held: !!held, note: (note || '').trim() || null,
          held_at: new Date().toISOString(), confirmed: was && was.held === !!held ? was.confirmed : false,
          confirmed_at: was && was.held === !!held ? was.confirmed_at : null });
        log('supervision_logged', { course, session: sessionN, held }); save();
      },
      async confirmSupervision(course, sessionN) {
        const st = S.students[meRoll()]; if (!st) throw err('Only the student confirms their own log.');
        const row = state.supervision.find(x => x.course === course && x.roll === st.roll && x.session_n === sessionN && x.held);
        if (!row) throw err('Your teacher has not logged that hour as held.');
        row.confirmed = true; row.confirmed_at = new Date().toISOString(); save();
      },
      async supervisionStatus(course, roll) { return supervision(course, roll); },
      async setMidterm(course, choice) {
        const who = state.session || {};
        if (!(who.courses || []).includes(course)) throw err('Only the course teacher chooses the mid-term for ' + course + '.');
        if (courseRow(course).regime !== 'project') throw err(course + ' is not studied as a project: its mid-term is the ordinary paper.');
        if (['paper', 'plan'].indexOf(choice) < 0) throw err('The mid-term is a written paper in mid-term week (paper), or the Session 8 plan with the first 1,500 words (plan).');
        if (isClosed(course)) throw err('Marking for ' + course + ' is closed.');
        state.choices[course] = choice; log('midterm_choice', { course, choice }); save();
      },
      async closeMarking(course, note) {
        if ((state.session || {}).role !== 'office') throw err('Only the office closes marking.');
        if (!isClosed(course)) state.closed.push(course); log('marking_closed', { course, note }); save();
      },
      async reopenMarking(course, reason) {
        if ((state.session || {}).role !== 'office') throw err('Only the office reopens marking.');
        if ((reason || '').trim().length < 10) throw err('Reopening a closed course needs a written reason.');
        state.closed = state.closed.filter(c => c !== course); log('marking_reopened', { course, reason }); save();
      },
      async setSetting(key, value) {
        if ((state.session || {}).role !== 'office') throw err('The office holds the settings.');
        if (!(key in (S.settings || {}))) throw err('There is no setting called ' + key + '.');
        value = String(value == null ? '' : value).trim();
        if (/(_from|_date)$/.test(key) && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw err('That value does not fit ' + key + ': a date is written 2026-10-05, a number as digits.');
        if (/_open$/.test(key) && ['yes', 'no'].indexOf(value) < 0) throw err(key + ' is yes or no.');
        if (key === 'late_week_rule' && ['started', 'full'].indexOf(value) < 0) throw err('late_week_rule is started or full.');
        if (key === 'marks_visible_to_students' && ['submitted', 'closed', 'never'].indexOf(value) < 0) throw err('marks_visible_to_students is submitted, closed or never.');
        state.settings[key] = value; log('setting_changed', { key, value }); dashCache = null; save();
      },
      async waivePenalty(kind, target, course, reason) {
        const ses = state.session || {};
        const tid = kind === 'folio' ? target : (S.students[target] || {}).team;
        if (!(ses.role === 'office' || (ses.role === 'convener' && runsTeam(tid)))) throw err('A late penalty is waived by the team\u2019s convener or the office.');
        if ((reason || '').trim().length < 10) throw err('A waiver needs a written reason.');
        if (kind === 'lens' && regimeOf(target, course) !== 'lens') throw err('That student writes no lens note for that course.');
        if (waived(kind, target, course)) throw err('That penalty is already waived.');
        const w = { id: newId('w'), kind, team_id: kind === 'folio' ? target : null, roll: kind !== 'folio' ? target : null,
                    course: kind === 'lens' ? course : null, reason: reason.trim(), by: ses.name, at: new Date().toISOString(), withdrawn_at: null };
        state.waivers.push(w); log('penalty_waived', w); save(); return w.id;
      },
      async withdrawWaiver(id) {
        const w = state.waivers.find(x => x.id === id && !x.withdrawn_at); if (!w) throw err('No such waiver.');
        const tid = w.team_id || (S.students[w.roll] || {}).team; const ses = state.session || {};
        if (!(ses.role === 'office' || (ses.role === 'convener' && runsTeam(tid)))) throw err('A waiver is withdrawn by the team\u2019s convener or the office.');
        w.withdrawn_at = new Date().toISOString(); log('penalty_waiver_withdrawn', { id }); save();
      },
      async waivers() { const ses = state.session || {};
        return state.waivers.filter(w => ses.role === 'office' || runsTeam(w.team_id || (S.students[w.roll] || {}).team)
          || (ses.role === 'teacher' && (w.course ? (ses.courses || []).includes(w.course) : true))); },
      async grantDefenceException(course, roll, reason) {
        if ((state.session || {}).role !== 'office') throw err('Only the office records an exception.');
        if ((reason || '').trim().length < 10) throw err('An exception needs a written reason.');
        if (regimeOf(roll, course) !== 'project') throw err('That student does not study ' + course + ' as a project.');
        state.exceptions = state.exceptions.filter(x => !(x.course === course && x.roll === roll))
          .concat([{ course, roll, reason: reason.trim(), by: (state.session || {}).name, at: new Date().toISOString() }]);
        log('defence_exception', { course, roll, reason }); save();
      },
      async setDefence(roll, chair, alumnus, when) {
        if ((state.session || {}).role !== 'office') throw err('Only the office records a defence.');
        if (!paths().some(x => x.roll === roll && x.regime === 'project')) throw err('That student studies no course as a project.');
        if ((chair || '').trim().length < 3) throw err('Name the chair the Dean has named.');
        const norm = x => String(x || '').toLowerCase().replace(/\b(dr|mr|mrs|ms|miss|prof|professor|engr)\b\.?/g, ' ').replace(/[^a-z]+/g, ' ').trim();
        const teachers = paths().filter(x => x.roll === roll && x.regime === 'project').flatMap(x => courseRow(x.course).teachers || []);
        if (teachers.some(t => norm(t) === norm(chair))) throw err('The chair does not score, so the chair cannot be the teacher of one of this student\u2019s courses.');
        state.defences[roll] = { roll, chair_name: chair.trim(), alumnus_name: (alumnus || '').trim() || null, scheduled_for: when || null, set_at: new Date().toISOString() };
        log('defence_set', { roll }); save();
      },
      async projectStudents() {      // the office: everybody who studies a course as a project, with their defence
        const rolls = [...new Set(paths().filter(x => x.regime === 'project').map(x => x.roll))];
        return rolls.map(r => ({ roll: r, name: nameOfRoll(r), team_id: (S.students[r] || {}).team,
          courses: paths().filter(x => x.roll === r && x.regime === 'project').map(x => x.course),
          defence: state.defences[r] || null,
          exceptions: state.exceptions.filter(x => x.roll === r) }));
      },
      /* ---- the project rules: the convener ---- */
      async decideProject(teamId, decision, note) {
        if (!(isConv() && runsTeam(teamId))) throw err('A team\u2019s choice is approved or returned by its convener.');
        const t = team(teamId);
        if (!t.project_id && !(t.project_custom || '').trim()) throw err('That team has not chosen a project.');
        if (decision === 'approve') {
          if (t.project_id) { const others = Object.keys(S.teams).map(team).filter(x => x.id !== teamId && x.project_id === t.project_id && x.project_state === 'approved');
            if (others.length >= +(setting('max_teams_per_project') || 2)) throw err('Two teams are already approved on that project.'); }
          state.teams[teamId] = Object.assign({}, state.teams[teamId] || {}, { project_state: 'approved', project_note: (note || '').trim() || null,
            project_decided_by: (state.session || {}).name, project_decided_at: new Date().toISOString() });
        } else if (decision === 'return') {
          if ((note || '').trim().length < 5) throw err('Say why the choice is returned \u2014 the team reads it.');
          state.teams[teamId] = Object.assign({}, state.teams[teamId] || {}, { project_state: 'returned', project_note: note.trim(),
            project_decided_by: (state.session || {}).name, project_decided_at: new Date().toISOString() });
        } else throw err('The decision is approve or return.');
        log('project_' + decision, { team: teamId }); save();
      },
      async setTeamName(name, teamId) {
        const st = S.students[meRoll()]; const tid = teamId || (st && st.team);
        if (!tid) throw err('You are not in a team yet.');
        if (!((st && st.team === tid) || (isConv() && runsTeam(tid)))) throw err('A team is named by its own members.');
        if (stage() !== 'choice') throw err('Teams name themselves at Session 6, when they make their final choice.');
        const v = String(name || '').trim().replace(/\s+/g, ' ');
        if (v.length < 3 || v.length > 40) throw err('A team name is 3 to 40 characters.');
        if (Object.keys(S.teams).some(id => id !== tid && (team(id).name || '').toLowerCase() === v.toLowerCase())) throw err('Another team already has that name.');
        state.teams[tid] = Object.assign({}, state.teams[tid] || {}, { name: v }); log('team_named', { team: tid }); save();
      },
      async sealPrediction(teamId, on) {
        if (!(isConv() && runsTeam(teamId))) throw err('The sealed prediction is recorded by the team\u2019s convener.');
        const t = team(teamId), d = on || kToday();
        if ((!t.project_id && !(t.project_custom || '').trim()) || t.project_state === 'returned') throw err('The team seals its prediction when it has made its final choice of project.');
        if (d > kToday()) throw err('That date has not come yet.');
        if (t.prediction_opened_on) throw err('That envelope has already been opened.');
        state.teams[teamId] = Object.assign({}, state.teams[teamId] || {}, { prediction_sealed_on: d, prediction_sealed_by: (state.session || {}).name });
        log('prediction_sealed', { team: teamId, on: d }); save();
      },
      async openPrediction(teamId, on) {
        if (!(isConv() && runsTeam(teamId))) throw err('The envelope is opened by the team\u2019s convener, at the team\u2019s first viva.');
        const t = team(teamId), d = on || kToday();
        if (!t.prediction_sealed_on) throw err('No sealed prediction is on record for that team.');
        if (d < t.prediction_sealed_on || d > kToday()) throw err('The opening date lies between the day it was sealed and today.');
        state.teams[teamId] = Object.assign({}, state.teams[teamId] || {}, { prediction_opened_on: d, prediction_opened_by: (state.session || {}).name });
        log('prediction_opened', { team: teamId, on: d }); save();
      },
      async setEthics(teamId, tier, status, on, note) {
        const ses = state.session || {};
        if (!(isConv() && runsTeam(teamId))) throw err('The ethics tier is set by the team\u2019s convener.');
        if (tier != null && [1, 2, 3].indexOf(+tier) < 0) throw err('The tier is 1 (self-certify), 2 (convener approves) or 3 (the panel).');
        if (status && ['filed', 'cleared', 'cleared_conditions', 'not_cleared'].indexOf(status) < 0) throw err('The status is filed, cleared, cleared_conditions or not_cleared.');
        if (status && tier == null) throw err('Set the tier first.');
        const d = on || kToday(); if (d > kToday()) throw err('That date has not come yet.');
        if (status === 'filed' && +tier !== 3) throw err('Only a Tier 3 project is filed with the panel.');
        if (+tier === 1 && status && status !== 'cleared') throw err('Tier 1 is self-certified: once you have countersigned the sheet it is cleared.');
        if (+tier === 3 && ['cleared', 'cleared_conditions', 'not_cleared'].indexOf(status) >= 0 && ses.role !== 'office')
          throw err('A Tier 3 project is decided by the ethics panel. The office records the panel\u2019s decision.');
        if (status === 'cleared_conditions' && (note || '').trim().length < 5) throw err('Write the conditions.');
        const t = team(teamId);
        if (+tier === 3 && ['cleared', 'cleared_conditions', 'not_cleared'].indexOf(status) >= 0 && t.ethics_status !== 'filed' && !t.ethics_filed_on)
          throw err('That team has not been filed with the panel yet.');
        const cur = Object.assign({}, state.teams[teamId] || {});
        if ((t.ethics_tier == null ? null : +t.ethics_tier) !== (tier == null ? null : +tier)) { cur.ethics_status = null; cur.ethics_filed_on = null; cur.ethics_decided_on = null; }
        Object.assign(cur, { ethics_tier: tier == null ? null : +tier, ethics_status: status || null,
          ethics_filed_on: status === 'filed' ? d : (+tier === 3 ? (cur.ethics_filed_on || t.ethics_filed_on) : null),
          ethics_decided_on: ['cleared', 'cleared_conditions', 'not_cleared'].indexOf(status) >= 0 ? d : null,
          ethics_note: (note || '').trim() || null, ethics_set_by: ses.name });
        state.teams[teamId] = cur; log('ethics_set', { team: teamId, tier, status }); save();
      },
      async acceptHandin(id, stateTo, note) {
        const h = state.handins.find(x => x.id === id); if (!h) throw err('No such hand-in.');
        if (!(isConv() && runsTeam(h.team_id))) throw err('That is not yours to do. If you think it should be, tell the front desk.');
        if (stateTo === 'accepted' && h.state !== 'accepted') {
          const t = team(h.team_id);
          if (h.type_key === 'field') {
            if (!t.ethics_tier || ['cleared', 'cleared_conditions'].indexOf(t.ethics_status) < 0) throw err('The field plan cannot be accepted yet: the team\u2019s ethics tier is not cleared.');
            if (!(setting('fieldwork_gate_open') === 'yes' && kToday() >= setting('fieldwork_gate_date')))
              throw err('The field plan cannot be accepted yet: the fieldwork gate is not open (the duty phone and the sign-out sheet must exist; the office opens it).');
          } else if (h.type_key === 'folio') {
            const missing = [['brief', 'the client brief'], ['handover', 'the handover page'], ['ai', 'the AI declaration']]
              .filter(([k]) => !latestOf(k, h.team_id)).map(x => x[1]);
            if (missing.length) throw err('The Folio cannot be accepted yet: ' + missing.join(', ') + ' not on file.');
          }
        }
        h.state = stateTo; h.review_note = (note || '').trim() || null; h.reviewed_at = new Date().toISOString(); h.reviewed_by_name = (state.session || {}).name;
        log('handin_' + stateTo, { id }); save();
      },
      async logWeeklyCheck(teamId, sessionN, answers, logLine) {
        if (!(isConv() && runsTeam(teamId))) throw err('The weekly check is the convener\u2019s.');
        const ses = (S.sessions || []).find(x => x[0] === sessionN);
        if (!ses || ses[1] > kToday()) throw err('That week has not begun.');
        const keys = ['on_plan', 'went_alone', 'incident', 'uneasy', 'consent_ok'];
        if (!keys.every(k => typeof answers[k] === 'boolean')) throw err('Five answers, each yes or no.');
        if ((logLine || '').length > 400) throw err('Two lines \u2014 400 characters at most.');
        if ((answers.went_alone || answers.incident || answers.uneasy || !answers.on_plan) && (logLine || '').trim().length < 5)
          throw err('That answer needs a line in the log: what happened, and what you did.');
        state.checks = state.checks.filter(c => !(c.team_id === teamId && c.session_n === sessionN))
          .concat([Object.assign({ team_id: teamId, session_n: sessionN, log: (logLine || '').trim() || null,
            by_name: (state.session || {}).name, at: new Date().toISOString() }, answers)]);
        log('weekly_check', { team: teamId, session: sessionN }); save();
      },
      async weeklyChecks() { return state.checks.filter(c => runsTeam(c.team_id)); },
      /* ---- 22 September, register BH: the sign-out sheet, form F2, the AI declaration, appeals, the Karachi Review (demo side) ---- */
      async signouts(teamId) { const ses = state.session || {};
        return (state.signouts || []).filter(r => (!teamId || r.team_id === teamId) && (runsTeam(r.team_id) || (S.students[meRoll()] || {}).team === r.team_id)).sort((a, b) => a.at < b.at ? 1 : -1); },
      async fileSignout(teamId, rolls, where, grade, dueIso, phone) { const ses = state.session || {}; const st = S.students[meRoll()];
        if (!((ses.role === 'student' && st && st.team === teamId) || ses.role === 'office')) throw err('A team signs itself out, or the desk signs it out.');
        if ((setting('fieldwork_gate_open') || 'no') !== 'yes' || kToday() < (setting('fieldwork_gate_date') || '2026-10-05')) throw err('The fieldwork gate is not open. No team leaves campus before the duty phone and the sign-out sheet exist.');
        const fp = latestOf('field', teamId); if (!fp || fp.state !== 'accepted') throw err('A team whose field plan is not on the desk does not sign out. Your convener accepts the plan first.');
        if (grade === 'R') throw err('A red site is signed out on paper, with the convener’s written approval and an escort.');
        if (grade !== 'G' && grade !== 'A') throw err('The grade is G or A, from the field plan.');
        const members = (S.teams[teamId] || {}).members || []; const rs = [...new Set(rolls || [])];
        if (!rs.length || rs.some(r => !members.includes(r))) throw err('Everyone going is written in by roll number, and everyone is in this team.');
        if (ses.role === 'student' && !rs.includes(st.roll)) throw err('Sign yourself out, with the others going.');
        if (rs.length < 2 || (grade === 'A' && rs.length < 3)) throw err('Never alone: two at least, and three anywhere graded amber.');
        const due = new Date(dueIso); if (kDay(due) !== kToday() || kTime(due) > '18:00' || due <= new Date()) throw err('Due is agreed before you leave, today, and is never after 6 pm.');
        if ((state.signouts || []).some(r => r.team_id === teamId && (r.state === 'filed' || r.state === 'out'))) throw err('This team is already signed out. Sign back in first.');
        const w = String(where || '').trim().toLowerCase();
        if ((state.incidents || []).some(i => i.site_closed && !i.site_reopened_on && (w.includes(i.location.toLowerCase()) || i.location.toLowerCase().includes(w)))) throw err('That site is on the closed list. It stays closed to every team until the Registrar reopens it.');
        state.signouts = state.signouts || []; const id = Date.now();
        state.signouts.push({ id, team_id: teamId, rolls: rs, where_to: String(where).trim(), grade, due_at: due.toISOString(), phone: (phone || '').trim() || null, state: 'filed',
          out_at: null, out_by: null, reported_back_at: null, back_at: null, back_by: null, note: null, filed_name: ses.name, at: new Date().toISOString() });
        log('file_signout', { team: teamId, id }); save(); return id; },
      async deskSignout(id, cardsSeen, numbersOk) { const ses = state.session || {};
        if (ses.role !== 'office') throw err('The desk signs a team out: heads counted.');
        if (!(cardsSeen && numbersOk)) throw err('Any one of the seven missing means the team does not go: identity cards and the letter seen, the duty number on every card.');
        const r = (state.signouts || []).find(x => x.id === Number(id) && x.state === 'filed'); if (!r) throw err('That line is not waiting at the desk.');
        r.state = 'out'; r.out_at = new Date().toISOString(); r.out_by = ses.name; log('desk_signout', { id }); save(); },
      async reportBack(id) { const st = S.students[meRoll()]; const r = (state.signouts || []).find(x => x.id === Number(id) && x.state === 'out');
        if (!r) throw err('That line is not out.'); if (!st || st.team !== r.team_id) throw err('The team sends its one message: back.');
        r.reported_back_at = r.reported_back_at || new Date().toISOString(); log('report_back', { id }); save(); },
      async signBack(id, note) { const ses = state.session || {}; if (ses.role !== 'office') throw err('The desk signs both ends: a team does not sign itself in.');
        const r = (state.signouts || []).find(x => x.id === Number(id) && (x.state === 'filed' || x.state === 'out')); if (!r) throw err('That line is not out.');
        r.state = 'back'; r.back_at = new Date().toISOString(); r.back_by = ses.name; if ((note || '').trim()) r.note = note.trim(); log('sign_back', { id }); save(); },
      async closeSignout(id, note) { const ses = state.session || {}; if (ses.role !== 'office') throw err('The desk closes a line, with the explanation.');
        if (String(note || '').trim().length < 3) throw err('Every line has a sign-in time or an explanation. Write the explanation.');
        const r = (state.signouts || []).find(x => x.id === Number(id) && (x.state === 'filed' || x.state === 'out')); if (!r) throw err('That line is not open.');
        r.state = 'closed'; r.note = note.trim(); log('close_signout', { id }); save(); },
      async incidents(teamId) { const st = S.students[meRoll()];
        return (state.incidents || []).filter(i => (!teamId || i.team_id === teamId) && (runsTeam(i.team_id) || (st && st.team === i.team_id))).sort((a, b) => a.at < b.at ? 1 : -1); },
      async fileIncident(teamId, kind, happenedIso, location, present, hurt, authority, authorityWho, what, action, reportedTo, signoutId) {
        const ses = state.session || {}; const st = S.students[meRoll()];
        if (!((st && st.team === teamId) || runsTeam(teamId))) throw err('The incident form is the team’s, its convener’s, or the desk’s.');
        if (!['incident', 'near_miss', 'refusal', 'authority', 'injury', 'theft', 'harassment', 'overdue'].includes(kind)) throw err('Say what kind it was.');
        const h = new Date(happenedIso); if (isNaN(h) || h > new Date(Date.now() + 3e5)) throw err('Say when it happened.');
        if (String(location || '').trim().length < 3) throw err('Say where: the street and the area.');
        if (String(what || '').trim().length < 10) throw err('Say what happened, in your own words.');
        const members = (S.teams[teamId] || {}).members || []; if ((present || []).some(r => !members.includes(r))) throw err('Who was present is written by roll number, from this team.');
        const conv = ses.role === 'convener' && runsTeam(teamId);
        state.incidents = state.incidents || []; const id = Date.now();
        state.incidents.push({ id, team_id: teamId, kind, happened_at: h.toISOString(), location: String(location).trim(), present: present || [], hurt: !!hurt, authority: !!authority,
          authority_who: (authorityWho || '').trim() || null, what: String(what).trim(), action: (action || '').trim() || null, reported_to: (reportedTo || '').trim() || null,
          signout_id: signoutId || null, filed_name: ses.name, filed_role: ses.role, at: new Date().toISOString(),
          convener_signed_by: conv ? ses.name : null, convener_signed_at: conv ? new Date().toISOString() : null,
          received_by: null, received_at: null, received_note: null, site_closed: false, site_closed_on: null, site_reopened_on: null });
        log('file_incident', { team: teamId, id, kind }); save(); return id; },
      async signIncident(id) { const ses = state.session || {}; const i = (state.incidents || []).find(x => x.id === Number(id)); if (!i) throw err('No such form.');
        if (!(ses.role === 'convener' && runsTeam(i.team_id))) throw err('The convener signs the incident form.');
        i.convener_signed_by = ses.name; i.convener_signed_at = new Date().toISOString(); log('sign_incident', { id }); save(); },
      async receiveIncident(id, siteClosed, note) { const ses = state.session || {}; if (ses.role !== 'office') throw err('The office records the Registrar’s receipt.');
        const i = (state.incidents || []).find(x => x.id === Number(id)); if (!i) throw err('No such form.');
        i.received_by = ses.name; i.received_at = new Date().toISOString(); i.received_note = (note || '').trim() || null; i.site_closed = !!siteClosed;
        i.site_closed_on = siteClosed ? (i.site_closed_on || kToday()) : null; if (siteClosed) i.site_reopened_on = null; log('receive_incident', { id, siteClosed }); save(); },
      async reopenSite(id) { const ses = state.session || {}; if (ses.role !== 'office') throw err('The Registrar reopens a site; the office records it.');
        const i = (state.incidents || []).find(x => x.id === Number(id) && x.site_closed && !x.site_reopened_on); if (!i) throw err('That site is not closed.');
        i.site_reopened_on = kToday(); log('reopen_site', { id }); save(); },
      async closedSites() { return (state.incidents || []).filter(i => i.site_closed && !i.site_reopened_on).map(i => ({ location: i.location, closed_on: i.site_closed_on })); },
      async aiDeclaration(teamId) { const ses = state.session || {}; const st = S.students[meRoll()]; const t = S.teams[teamId] || {};
        const may = runsTeam(teamId) || (st && st.team === teamId) || (ses.role === 'teacher' && (t.marking || []).some(c => (ses.courses || []).includes(c)));
        if (!may) return { decl: null, seen: [] };
        return { decl: (state.aidecl || {})[teamId] || null, seen: (state.aiseen || []).filter(x => x.team_id === teamId) }; },
      async signAiDeclaration(tools, teamWork, toolWrong, confirmed, signedName) { const ses = state.session || {}; const st = S.students[meRoll()];
        if (!st) throw err('Only a student signs the declaration.'); if (!st.team) throw err('You are not in a team yet.');
        if (kDay(today()) > (setting('last_acceptance_date') || LAST_DAY)) throw err('Nothing is accepted after the Karachi Review on 15 December. Speak to your convener.');
        if (!Array.isArray(tools) || tools.length < 1 || tools.length > 8) throw err('Name every tool you used, one to eight rows. If you used none, one row saying "none".');
        tools.forEach((r, i) => { if (String(r.tool || '').trim().length < 2 || String(r.used_for || '').trim().length < 3 || String(r.checked || '').trim().length < 3 || String(r.who || '').trim().length < 2)
          throw err('Row ' + (i + 1) + ': the tool, what you used it for, how you checked the output, and who on the team.'); });
        if (String(teamWork || '').trim().length < 20) throw err('What the team did itself: the decisions, the judgement, the work no tool produced. This is the part the viva examines.');
        if (String(toolWrong || '').trim().length < 10) throw err('Where a tool was wrong: at least one example. A team that reports none is either not checking or not saying.');
        if (!confirmed) throw err('The declaration is signed by ticking it: every tool named, every output checked, each of you able to defend the work, no real person’s data in any tool.');
        const norm = x => String(x || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (norm(signedName).length < 2 || (norm(st.name) && norm(signedName) !== norm(st.name))) throw err('Sign with your own name, as the register has it.');
        state.aidecl = state.aidecl || {}; const prev = state.aidecl[st.team];
        state.aidecl[st.team] = { team_id: st.team, tools, team_work: teamWork.trim(), tool_wrong: toolWrong.trim(), confirmed: true, signed_name: signedName.trim(), signed_roll: st.roll,
          signed_at: new Date().toISOString(), version: prev ? prev.version + 1 : 1 };
        const t = typeOf('ai'); const at = new Date().toISOString(); const l = lateness(t.due_on, at, 20, setting('late_week_rule'));
        const ver = state.handins.filter(h => h.type_key === 'ai' && h.team_id === st.team).length + 1;
        state.handins.push({ id: newId('h'), type_key: 'ai', team_id: st.team, roll: null, course: null, file_name: 'AI declaration — signed in the portal for the team', file_size: 0, file_path: null,
          note: 'form', submitted_at: at, by: st.name, state: 'submitted', version: ver, days_late: l.days_late, penalty: l.penalty });
        dashCache = null; log('sign_ai_declaration', { team: st.team, version: ver }); save(); return { team: st.team, version: ver }; },
      async seeAiDeclaration(teamId, course) { const ses = state.session || {};
        if (!(ses.role === 'office' || (ses.role === 'teacher' && (ses.courses || []).includes(course)))) throw err('The course teacher marks the declaration seen.');
        if (!((S.teams[teamId] || {}).marking || []).includes(course)) throw err('That course does not mark this team’s Folio.');
        if (!(state.aidecl || {})[teamId]) throw err('The team has not signed its declaration yet.');
        state.aiseen = (state.aiseen || []).filter(x => !(x.team_id === teamId && x.course === course)); state.aiseen.push({ team_id: teamId, course, by_name: ses.name, at: new Date().toISOString() });
        log('see_ai_declaration', { team: teamId, course }); save(); },
      async appeals(teamId) { const ses = state.session || {}; const st = S.students[meRoll()];
        return (state.appeals || []).filter(a => (!teamId || a.team_id === teamId) && (ses.role === 'office' || (st && a.roll === st.roll) || (a.team_id && runsTeam(a.team_id)))).sort((a, b) => a.at < b.at ? 1 : -1); },
      async fileAppeal(rulingOn, ruling, grounds) { const st = S.students[meRoll()]; if (!st) throw err('A student appeals in their own name.');
        const t = kToday(); if (!rulingOn || rulingOn > t) throw err('Give the date of the ruling.');
        if (daysBetween(t, rulingOn) > 7) throw err('An appeal is made within seven days of the ruling. Seven days have passed: speak to the front desk.');
        if (String(ruling || '').trim().length < 5) throw err('Say what was ruled, in a line.');
        if (String(grounds || '').trim().length < 20) throw err('Say why you disagree: your grounds, in writing.');
        state.appeals = state.appeals || []; const id = Date.now();
        state.appeals.push({ id, roll: st.roll, team_id: st.team || null, ruling_on: rulingOn, ruling: ruling.trim(), grounds: grounds.trim(), state: 'filed', convener_note: null, convener_by: null, convener_at: null,
          outcome: null, decision: null, decided_by: null, decided_on: null, at: new Date().toISOString() });
        log('file_appeal', { id }); save(); return id; },
      async answerAppeal(id, note) { const ses = state.session || {}; const a = (state.appeals || []).find(x => x.id === Number(id) && x.state === 'filed'); if (!a) throw err('That appeal is not open.');
        if (!(ses.role === 'convener' && a.team_id && runsTeam(a.team_id))) throw err('The convener whose ruling it is writes the account.');
        if (String(note || '').trim().length < 5) throw err('Write the account.'); a.convener_note = note.trim(); a.convener_by = ses.name; a.convener_at = new Date().toISOString(); log('answer_appeal', { id }); save(); },
      async decideAppeal(id, outcome, decision) { const ses = state.session || {}; if (ses.role !== 'office') throw err('The programme heads decide; the office records it.');
        if (!['upheld', 'overturned', 'varied'].includes(outcome)) throw err('The ruling is upheld, overturned or varied.');
        if (String(decision || '').trim().length < 5) throw err('Write the decision.');
        const a = (state.appeals || []).find(x => x.id === Number(id) && x.state === 'filed'); if (!a) throw err('That appeal is not open. A decision ends it.');
        a.state = 'decided'; a.outcome = outcome; a.decision = decision.trim(); a.decided_by = ses.name; a.decided_on = kToday(); log('decide_appeal', { id, outcome }); save(); },
      async staffList() { return [{ id: 'Teacher of record', name: 'Teacher of record', role: 'teacher', blocks: [] }, { id: 'Block convener', name: 'Block convener', role: 'convener', blocks: Object.keys(S.blocks) }, { id: 'Front desk', name: 'Front desk', role: 'office', blocks: [] }]; },
      async circuits() { const ses = state.session || {}; const all = state.circuits || [];
        if (ses.role === 'office') return all; if (ses.role === 'teacher') return all.filter(c => c.judge_name === ses.name);
        if (ses.role === 'convener') return all.filter(c => c.judge_name === ses.name || c.teams.some(t => (ses.blocks || []).includes((S.teams[t] || {}).block))); return []; },
      async setCircuit(id, name, judge, alumnus, teams) { const ses = state.session || {}; if (ses.role !== 'office') throw err('The office builds the circuits.');
        id = Number(id); if (!(id >= 1 && id <= 20)) throw err('A circuit is numbered 1 to 20.');
        const ts = teams || []; if (ts.some(t => !S.teams[t])) throw err('Every team on the circuit is a team on the register.');
        if ((state.circuits || []).some(c => c.id !== id && c.teams.some(t => ts.includes(t)))) throw err('A team stands on one circuit only.');
        let jn = null; if (judge) { const st = (await this.staffList()).find(x => x.id === judge); if (!st) throw err('The judge is a member of staff with an account.');
          if (ts.some(t => (st.blocks || []).includes((S.teams[t] || {}).block))) throw err('A judge is never on a circuit that takes in their own blocks.'); jn = st.name; }
        state.circuits = (state.circuits || []).filter(c => c.id !== id);
        state.circuits.push({ id, name: (name || '').trim() || 'Circuit ' + id, judge_user: judge || null, judge_name: jn, alumnus_name: (alumnus || '').trim() || null, teams: ts, at: new Date().toISOString() });
        state.circuits.sort((a, b) => a.id - b.id); log('set_circuit', { id, teams: ts.length }); save(); },
      async reviewScores(teamId) { const ses = state.session || {}; const rows = (state.rscores || []).filter(r => !teamId || r.team_id === teamId);
        return rows.filter(r => { const t = S.teams[r.team_id] || {};
          return runsTeam(r.team_id) || (state.circuits || []).some(c => c.judge_name === ses.name && c.teams.includes(r.team_id)) || (ses.role === 'teacher' && (t.marking || []).some(c => (ses.courses || []).includes(c))); }); },
      async scoreReview(teamId, works, claim, answered, outside, boxes, sentence) { const ses = state.session || {};
        if ((setting('review_open') || 'no') !== 'yes') throw err('The Review is not open for scoring. The office opens it on the day.');
        const c = (state.circuits || []).find(x => x.teams.includes(teamId));
        if (!(ses.role === 'office' || (c && c.judge_name === ses.name))) throw err('Only the pair walking this circuit scores this team.');
        const n = [works, claim, answered, outside].map(Number); const lim = [4, 3, 2, 1];
        if (n.some((v, i) => !Number.isInteger(v) || v < 0 || v > lim[i])) throw err('The sheet: does it work (0–4), is the claim supported (0–3), did they answer (0–2), would you take it outside (0–1).');
        state.rscores = (state.rscores || []).filter(r => r.team_id !== teamId);
        state.rscores.push({ team_id: teamId, circuit_id: c ? c.id : null, works: n[0], claim: n[1], answered: n[2], outside: n[3], total: n[0] + n[1] + n[2] + n[3], boxes: boxes || {}, sentence: (sentence || '').trim() || null, by_name: ses.name, at: new Date().toISOString() });
        log('score_review', { team: teamId, total: n[0] + n[1] + n[2] + n[3] }); save(); },
      async presence() { return (state.presence || []).filter(p => runsTeam(p.team_id)); },
      async markPresent(teamId, present) { const ses = state.session || {}; if (!(isConv() && runsTeam(teamId))) throw err('The team’s convener ticks it at its table.');
        state.presence = (state.presence || []).filter(p => p.team_id !== teamId); state.presence.push({ team_id: teamId, present: !!present, by_name: ses.name, at: new Date().toISOString() });
        log('mark_present', { team: teamId, present }); save(); },
      /* ---- 22 September, register BG: the scope, the draft review, the moderation record, the hours (demo side) ---- */
      async teamScope(teamId) { const ses = state.session || {}; const r = (state.scopes || {})[teamId];
        if (!r) return null; const st = S.students[meRoll()]; return runsTeam(teamId) || (st && st.team === teamId) ? r : null; },
      async agreeScope(teamId, scope, client) { const ses = state.session || {};
        if (!(isConv() && runsTeam(teamId))) throw err('The scope is agreed by the team’s convener, or by the office.');
        const t = String(scope || '').trim(); if (!t || t.length > 400) throw err('The scope is one line to four hundred characters.');
        state.scopes = state.scopes || {}; state.scopes[teamId] = { team_id: teamId, scope: t, client: (client || '').trim() || null, agreed_on: kToday(), by_name: ses.name, at: new Date().toISOString() };
        log('agree_scope', { team: teamId }); save(); },
      async draftReviews(teamId) { const ses = state.session || {}; const st = S.students[meRoll()];
        return (state.drafts || []).filter(d => (!teamId || d.team_id === teamId) && (runsTeam(d.team_id) || (st && st.team === d.team_id) || (ses.role === 'teacher' && (ses.courses || []).includes(d.course)))); },
      async reviewDraft(teamId, course, note) { const ses = state.session || {};
        if (!(ses.role === 'office' || (ses.role === 'teacher' && (ses.courses || []).includes(course)))) throw err('A draft is reviewed by the teacher of that course.');
        const t = S.teams[teamId]; if (!t || !(t.marking || []).includes(course)) throw err('That course does not mark this team’s Folio.');
        state.drafts = (state.drafts || []).filter(d => !(d.team_id === teamId && d.course === course));
        state.drafts.push({ team_id: teamId, course, note: (note || '').trim() || null, by_name: ses.name, at: new Date().toISOString() });
        log('review_draft', { team: teamId, course }); save(); },
      async moderationLog(block) { const ses = state.session || {};
        const ok = b => ses.role === 'office' || (ses.role === 'convener' && (ses.blocks || []).includes(b));
        return (state.modlog || []).filter(m => (!block || m.block === block) && ok(m.block)).sort((a, b) => a.at < b.at ? 1 : -1); },
      async logModeration(block, teamId, kind, course, spread, note, outcome) { const ses = state.session || {};
        if (!(ses.role === 'office' || (ses.role === 'convener' && (ses.blocks || []).includes(block)))) throw err('The moderation record is the block’s convener’s, or the office’s.');
        if (kind !== 'sample' && kind !== 'remark') throw err('A record is a sample or a re-mark.');
        if (teamId && !(S.teams[teamId] && S.teams[teamId].block === block)) throw err('That team is not in this block.');
        state.modlog = state.modlog || []; const id = Date.now();
        state.modlog.push({ id, block, team_id: teamId || null, kind, course: (course || '').trim() || null, spread: spread === '' || spread == null ? null : Number(spread), note: (note || '').trim() || null, outcome: (outcome || '').trim() || null, by_name: ses.name, at: new Date().toISOString() });
        log('log_moderation', { block, team: teamId, kind, id }); save(); return id; },
      async hoursLog() { const ses = state.session || {}; return (state.hours || []).filter(h => ses.role === 'office' || h.by_name === ses.name).sort((a, b) => a.on_date < b.on_date ? 1 : -1); },
      async logHours(on, hours, what) { const ses = state.session || {};
        if (!['convener', 'office'].includes(ses.role)) throw err('The hours log is a convener’s.');
        const h = Number(hours); if (!(h > 0 && h <= 12)) throw err('Hours run from a quarter to twelve in a day.');
        if (!String(what || '').trim()) throw err('Say what the hours were for.');
        state.hours = state.hours || []; const id = Date.now(); state.hours.push({ id, by_name: ses.name, on_date: on || kToday(), hours: h, what: String(what).trim().slice(0, 200), at: new Date().toISOString() });
        log('log_hours', { id, hours: h }); save(); return id; },
      async deleteHours(id) { const ses = state.session || {}; const row = (state.hours || []).find(h => h.id === Number(id));
        if (!row || !(ses.role === 'office' || row.by_name === ses.name)) throw err('Not yours to delete.');
        state.hours = state.hours.filter(h => h.id !== Number(id)); log('delete_hours', { id }); save(); },
      /* ---- 22 September, register BF: notices, the merge page, the trackers (demo side) ---- */
      async notices() {
        const ses = state.session || {}; const rows = state.notices || [];
        const byNew = (a, b) => a.posted_at < b.posted_at ? 1 : -1;
        if (ses.role === 'office') return rows.slice().sort(byNew);
        if (ses.role === 'convener') return rows.filter(n => (ses.blocks || []).includes(n.block)).sort(byNew);
        if (ses.role === 'student') { const st = S.students[meRoll()]; const t = st && S.teams[st.team];
          return t ? rows.filter(n => n.block === t.block).sort(byNew) : []; }
        return [];
      },
      async postNotice(block, body, until) {
        const ses = state.session || {};
        if (!(ses.role === 'office' || (ses.role === 'convener' && (ses.blocks || []).includes(block)))) throw err('A notice is posted by a convener of the block, or by the office.');
        const text = String(body || '').trim(); if (!text || text.length > 600) throw err('A notice is one to six hundred characters.');
        state.notices = state.notices || [];
        const id = Date.now(); state.notices.push({ id, block, body: text, until: until || null, by_name: ses.name, posted_at: new Date().toISOString() });
        log('post_notice', { block, id }); save(); return id;
      },
      async withdrawNotice(id) {
        const ses = state.session || {}; const n = (state.notices || []).find(x => x.id === id); if (!n) throw err('No such notice.');
        if (!(ses.role === 'office' || (ses.role === 'convener' && (ses.blocks || []).includes(n.block)))) throw err('A notice is withdrawn by a convener of the block, or by the office.');
        state.notices = state.notices.filter(x => x.id !== id); log('withdraw_notice', { block: n.block, id }); save();
      },
      async folioSections(block) {
        const ses = state.session || {}; const rows = ((state.sections || {})[block] || []).slice().sort((a, b) => a.n - b.n);
        if (ses.role === 'office' || (ses.role === 'convener' && (ses.blocks || []).includes(block))) return rows;
        if (ses.role === 'teacher') return rows.filter(r => (r.courses || []).some(c => (ses.courses || []).includes(c)));
        if (ses.role === 'student') { const st = S.students[meRoll()]; const t = st && S.teams[st.team]; return t && t.block === block ? rows : []; }
        return [];
      },
      async setFolioSections(block, sections) {
        const ses = state.session || {};
        if (!(ses.role === 'office' || (ses.role === 'convener' && (ses.blocks || []).includes(block)))) throw err('The merge page is written by a convener of the block, or by the office.');
        if (!Array.isArray(sections) || sections.length < 1 || sections.length > 9) throw err('The Folio has between one and nine sections.');
        const seen = {};
        sections.forEach(r => { const n = Number(r.n); if (!(n >= 1 && n <= 9)) throw err('Section numbers run from 1 to 9.'); if (seen[n]) throw err('Section ' + n + ' appears twice.'); seen[n] = 1;
          if (!String(r.title || '').trim()) throw err('Section ' + n + ' needs a title.'); });
        state.sections = state.sections || {};
        state.sections[block] = sections.map(r => ({ block, n: Number(r.n), title: String(r.title).trim().slice(0, 80), what_goes_in: String(r.what_goes_in || '').slice(0, 600),
          courses: (r.courses || []).slice(), set_by_name: ses.name, set_at: new Date().toISOString() }));
        log('set_folio_sections', { block, sections: sections.length }); save(); return sections.length;
      },
      async letters() { const ses = state.session || {}; return ses.role === 'office' || ses.role === 'convener' ? (state.letters || []).slice().sort((a, b) => a.wave - b.wave || (a.body_name < b.body_name ? -1 : 1)) : []; },
      async saveLetter(row) { const ses = state.session || {}; if (ses.role !== 'office') throw err('The letters are the office’s.');
        state.letters = state.letters || []; return upsertRow(state.letters, row, ['body_name', 'wave', 'recipient', 'sent_on', 'replied_on', 'note'], 'save_letter'); },
      async guests() { const ses = state.session || {}; return ['office', 'convener', 'teacher'].includes(ses.role) ? (state.guests || []).slice() : []; },
      async saveGuest(row) { const ses = state.session || {}; const b = row.id ? ((state.guests || []).find(x => x.id === Number(row.id)) || {}).block : row.block;
        if (!(ses.role === 'office' || (ses.role === 'convener' && (ses.blocks || []).includes(b)))) throw err('A guest is entered by a convener of the block, or by the office.');
        state.guests = state.guests || []; return upsertRow(state.guests, row, ['block', 'speaker', 'organisation', 'session_n', 'on_date', 'confirmed', 'note'], 'save_guest'); },
      async visits() { const ses = state.session || {}; return ['office', 'convener', 'teacher'].includes(ses.role) ? (state.visits || []).slice() : []; },
      async saveVisit(row) { const ses = state.session || {}; const b = row.id ? ((state.visits || []).find(x => x.id === Number(row.id)) || {}).block : row.block;
        if (!(ses.role === 'office' || (ses.role === 'convener' && (ses.blocks || []).includes(b)))) throw err('A visit is entered by a convener of the block, or by the office.');
        state.visits = state.visits || []; return upsertRow(state.visits, row, ['block', 'host', 'on_date', 'transport', 'confirmed', 'note'], 'save_visit'); },
      async alumni() { const ses = state.session || {}; return ses.role === 'office' ? (state.alumni || []).slice() : []; },
      async saveAlumnus(row) { const ses = state.session || {}; if (ses.role !== 'office') throw err('The alumni list is the office’s.');
        state.alumni = state.alumni || []; return upsertRow(state.alumni, row, ['name', 'organisation', 'invited_on', 'replied', 'coming_15dec', 'coming_19dec', 'pair_no', 'note'], 'save_alumnus'); },
      async deleteTracker(kind, id) { const ses = state.session || {}; const key = { letter: 'letters', alumnus: 'alumni', guest: 'guests', visit: 'visits' }[kind]; if (!key) throw err('Unknown list.');
        const row = (state[key] || []).find(x => x.id === Number(id));
        if (kind === 'letter' || kind === 'alumnus') { if (ses.role !== 'office') throw err('That list is the office’s.'); }
        else if (!(ses.role === 'office' || (ses.role === 'convener' && row && (ses.blocks || []).includes(row.block)))) throw err('Not yours to delete.');
        state[key] = (state[key] || []).filter(x => x.id !== Number(id)); log('delete_tracker', { kind, id }); save(); },
      async seedLetters() { const ses = state.session || {}; if (ses.role !== 'office') throw err('The letters are the office’s.');
        state.letters = state.letters || []; let n = 0;
        (S.projects || []).forEach(p => { let a = p.authority; if (typeof a === 'string') { try { a = JSON.parse(a.replace(/'/g, '"')); } catch (e) { a = [a]; } }
          (a || []).forEach(name => { const nm = String(name).trim(); if (nm && !state.letters.some(l => l.body_name === nm)) { state.letters.push({ id: Date.now() + n, body_name: nm, wave: 2 }); n++; } }); });
        log('seed_letters', { added: n }); save(); return n; },
      // convener_board: one row per team the caller may see, with what is stuck and what waits
      async board() {
        const t0 = kToday(), d = k => (typeOf(k) || {}).due_on || '9999';
        const choiceEnd = addDays(setting('choice_from') || '2026-10-12', 5);
        return visibleTeams().map(t => {
          const f = k => !!latestOf(k, t.id);
          const fld = latestOf('field', t.id);
          const checks = state.checks.filter(c => c.team_id === t.id).sort((a, b) => b.session_n - a.session_n);
          const last = checks[0];
          const pr = S.projects.find(p => p.id === t.project_id);
          const stuck = [
            t0 > choiceEnd && !t.project_id && !(t.project_custom || '').trim() ? 'no project chosen' : null,
            t.project_state === 'returned' ? 'choice returned \u2014 not chosen again' : null,
            t0 > choiceEnd && ['chosen', 'approved'].indexOf(t.project_state) >= 0 && !t.prediction_sealed_on ? 'prediction not sealed' : null,
            t0 > d('ethics') && !f('ethics') ? 'ethics sheet late' : null,
            t.ethics_tier === 3 && !t.ethics_status ? 'Tier 3 \u2014 not filed with the panel' : null,
            t.ethics_status === 'filed' && t.ethics_filed_on < addDays(t0, -7) ? 'panel decision overdue' : null,
            t.ethics_status === 'not_cleared' ? 'ethics not cleared' : null,
            t0 > d('plan') && !f('plan') ? 'plan late' : null,
            t0 > d('charter') && !f('charter') ? 'charter late' : null,
            t.fieldwork && t0 > d('field') && !f('field') ? 'field plan late' : null,
            t0 > d('folio') && !f('folio') ? 'Folio late' : null,
            checks.some(c => c.at > new Date(Date.now() - 14 * 864e5).toISOString() && (c.went_alone || c.incident || c.uneasy || !c.on_plan)) ? 'weekly check raised something' : null,
            t.fieldwork && fld && fld.state === 'accepted' && t0 <= d('folio') && (!last || last.at < new Date(Date.now() - 10 * 864e5).toISOString()) ? 'no weekly check for ten days' : null
          ].filter(Boolean);
          const todo = [
            t.project_state === 'chosen' ? 'approve or return the choice' : null,
            f('ethics') && t.ethics_tier == null ? 'set the ethics tier' : null,
            [1, 2].indexOf(t.ethics_tier) >= 0 && !t.ethics_status ? 'clear the ethics sheet' : null,
            fld && fld.state !== 'accepted' ? 'review the field plan' : null
          ].filter(Boolean);
          return { team_id: t.id, block: t.block, lane: t.lane, name: t.name || null, size: t.size,
            project_id: t.project_id || null, project_title: pr ? pr.title : null, project_custom: t.project_custom || null,
            patch: t.patch || null, project_state: t.project_state || null, project_note: t.project_note || null,
            tier3_expected: !!(pr && pr.tier3_expected),
            prediction_sealed_on: t.prediction_sealed_on || null, prediction_sealed_by: t.prediction_sealed_by || null,
            prediction_opened_on: t.prediction_opened_on || null,
            fieldwork: !!t.fieldwork, ethics_tier: t.ethics_tier ?? null, ethics_status: t.ethics_status || null,
            ethics_filed_on: t.ethics_filed_on || null, ethics_decided_on: t.ethics_decided_on || null, ethics_note: t.ethics_note || null,
            ethics_in: f('ethics'), plan_in: f('plan'), charter_in: f('charter'), field_in: f('field'),
            field_accepted: !!(fld && fld.state === 'accepted'), folio_in: f('folio'),
            last_check_n: last ? last.session_n : null, last_check_at: last ? last.at : null, stuck, todo };
        });
      },
      async folioChecklist(teamId) { return ['folio', 'brief', 'handover', 'ai'].reduce((o, k) => (o[k] = !!latestOf(k, teamId), o), {}); },
      async myMarksMap() {
        const st = S.students[meRoll()]; if (!st) return [];
        const show = setting('marks_visible_to_students') || 'submitted';
        return paths().filter(x => x.roll === st.roll).sort((a, b) => a.pos - b.pos).map(x => {
          const co = courseRow(x.course);
          const hide = show === 'never' || (show === 'closed' && !isClosed(x.course));
          let mark = null, pen = null, oral = null, handed = null;
          if (x.regime === 'folio') { const m = state.marks.find(y => y.course === x.course && y.roll === st.roll);
            if (m && m.submitted && !hide) { const own = Math.max(0, Math.min(20, folio20(m) + (m.adjustment || 0)));
              const n = netOf('folio', st.team, null, 20, own, m.viva || 0); mark = n.net_30; pen = n.penalty; } }
          else if (x.regime === 'lens' || x.regime === 'viva30') { const m = state.lens_marks.find(y => y.course === x.course && y.roll === st.roll);
            handed = x.regime === 'lens' ? !!latestOf('lens', st.roll, x.course) : null;
            if (m && m.submitted && !hide) { const n = m.kind === 'lens' ? netOf('lens', st.roll, x.course, 20, folio20(m), m.viva || 0)
              : { net_30: m.viva30, penalty: 0 }; mark = n.net_30; pen = n.penalty; } }
          else if (x.regime === 'project') { const m = state.pc_marks.find(y => y.course === x.course && y.roll === st.roll);
            handed = !!latestOf('pcproj', st.roll);
            if (m && m.project_submitted && !hide) { const n = netOf('pcproj', st.roll, null, 30, m.project || 0, 0); mark = n.net_30; pen = n.penalty; }
            if (m && m.oral_submitted && !hide) oral = m.command + m.defends + m.unexpected + m.presents; }
          return { course: x.course, title: co.title, regime: x.regime, pos: x.pos, teachers: co.teachers || [],
                   mark_30: mark, penalty: pen, oral_40: oral, midterm: state.choices[x.course] || null,
                   handed_in: handed, closed: isClosed(x.course) };
        });
      },
      /* ---- the helper (register AX) --------------------------------
         The same object helper_state() returns from db/19_helper.sql, worked
         out here so the demo answers offline on the invented cohort.  Every
         sentence below is the sentence in the SQL, word for word: one helper,
         not two.  It reads state; it never files, books or submits. */
      async helperState() {
        const ses = state.session; if (!ses) throw err('Sign in first.');
        const t0 = kToday();
        const ai = (setting('helper_ai') || 'off') === 'on';
        const wrap = j => Object.assign({ ai: ai, front_desk: 'the Greenwich Works front desk', today: t0 }, j);
        const daysTo = on => on ? Math.round((new Date(on + 'T00:00:00Z') - new Date(t0 + 'T00:00:00Z')) / 864e5) : null;
        const DY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                    'August', 'September', 'October', 'November', 'December'];
        const nice = s => { const x = new Date(s + 'T00:00:00Z');
          return DY[x.getUTCDay()] + ' ' + x.getUTCDate() + ' ' + MO[x.getUTCMonth()]; };
        const d = k => (typeOf(k) || {}).due_on || null;
        const pick = rows => rows.filter(r => r && r.on)
          .sort((a, b) => a.on < b.on ? -1 : a.on > b.on ? 1 : a.sort - b.sort)
          .slice(0, 3)
          .map(r => ({ key: r.key, what: r.what, why: r.why, go: r.go, say: r.say, on: r.on, days: daysTo(r.on) }));
        const sayOf = (next, fallback) => (next[0] && next[0].say) || fallback;
        const gateOpen = () => (setting('fieldwork_gate_open') || 'no') === 'yes'
          && t0 >= (setting('fieldwork_gate_date') || '2026-10-05');

        if (ses.role === 'student') {
          const st = S.students[meRoll()];
          if (!st) return wrap({ role: 'student', known: false });
          if (/^postgraduate/i.test(st.status || '')) return wrap({
            role: 'student', known: true, outside: true,
            programme: st.prog || '', department: st.dept || '', next: [],
            person: { who: 'the Dean of your programme', name: null,
              where: st.dept || 'your department office',
              say: 'My courses are assessed on the University’s ordinary scheme, outside Greenwich Works. Who in the programme do I ask about my own courses?' } });

          const t = st.team ? team(st.team) : null;
          const filed = {};
          state.handins.filter(h => (h.team_id && h.team_id === st.team) || h.roll === st.roll)
            .forEach(h => { filed[h.type_key + (h.course ? ' ' + h.course : '')] = true; });
          const due = {}; typeRows().forEach(x => { due[x.key] = x.due_on; });
          const mine = paths().filter(x => x.roll === st.roll).sort((a, b) => a.pos - b.pos);
          const lensOpen = mine.filter(x => x.regime === 'lens' && !latestOf('lens', st.roll, x.course)).map(x => x.course);
          const pcs = mine.filter(x => x.regime === 'project').map(x => {
            const v = supervision(x.course, st.roll);
            return { course: x.course, pct: v.pct, signed: v.signed, may_sit: v.may_sit };
          });
          const map = await this.myMarksMap();
          const counted = map.filter(r => r.regime !== 'outside');
          const bk = state.bookings.filter(b => b.state === 'booked' && (b.team_id === st.team || b.roll === st.roll))
            .map(b => b.starts_at || (b.day + 'T' + b.time + ':00+05:00'))
            .filter(x => new Date(x) >= new Date()).sort();
          const chosen = !!(t && (t.project_id || (t.project_custom || '').trim()));
          const next = pick([
            !t || chosen ? null : { on: setting('choice_from'), sort: 1, key: 'sequence', go: '#team',
              what: 'Choose your project with your team, name the team and seal your prediction with your convener — from Session 6, ' + nice(setting('choice_from')) + '.',
              why: 'Nothing else in the term can start until the project is chosen: the ethics sheet is answered in class straight after it, and at most two teams may take one project.',
              say: 'My team has not chosen its project yet. Can we do it with you?' },
            t && t.project_state === 'returned' ? { on: t0, sort: 2, key: 'choice_state', go: '#team',
              what: 'Your convener has sent your choice back with a reason — read it on My team and choose again.',
              why: 'A returned choice is not a choice: until it is approved your team has no project and cannot start collecting.',
              say: 'Our project choice was returned. What do we need to change?' } : null,
            t && !filed.ethics ? { on: d('ethics'), sort: 3, key: 'ethics', go: '#handins',
              what: 'File the signed ethics screening sheet — due ' + nice(d('ethics')) + '.',
              why: 'No team collects a word of data, and no team goes anywhere, before its ethics tier is cleared.',
              say: 'Our ethics screening sheet is not in yet. Can you countersign it?' } : null,
            t && !filed.plan ? { on: d('plan'), sort: 4, key: 'plan', go: '#handins',
              what: 'File the one-page project plan — due ' + nice(d('plan')) + '.',
              why: 'Your convener merges what every marking course needs into the Folio’s sections from this page; a team with no plan is not in that merge.',
              say: 'We have not filed our one-page plan. Can we go through what it should say?' } : null,
            t && t.fieldwork && !filed.field ? { on: d('field'), sort: 5, key: 'field', go: '#handins',
              what: 'File the field plan, form F1 — due ' + nice(d('field')) + '.',
              why: 'Nobody leaves campus without one signed by your convener, and it cannot be accepted until your ethics tier is cleared and the fieldwork gate is open.',
              say: 'We need our field plan signed before we can go out. When can we do it?' } : null,
            t && !filed.charter ? { on: d('charter'), sort: 6, key: 'charter', go: '#handins',
              what: 'File the team charter — due ' + nice(d('charter')) + '.',
              why: 'It is the evidence a teacher uses to move one student up or down three marks from the team’s 20.',
              say: 'Our team charter is not filed. Can you look at ours before we send it?' } : null,
            t && !filed.folio ? { on: d('folio'), sort: 7, key: 'folio', go: '#handins',
              what: 'Upload the Folio with the client brief, the handover page and the AI declaration — due ' + nice(d('folio')) + '.',
              why: 'It is not accepted without all four, every course marking it takes five of the twenty off for each week it is late, and nothing at all is accepted after 15 December.',
              say: 'We are behind on the Folio. Can we talk about what is missing?' } : null,
            lensOpen.length ? { on: d('lens'), sort: 8, key: 'lens', go: '#handins',
              what: 'File your lens note' + (lensOpen.length > 1 ? 's for ' : ' for ') + lensOpen.join(' and ') + ' — due ' + nice(d('lens')) + '.',
              why: 'A lens note is that course’s only piece of coursework: without it that course has nothing of yours to mark out of twenty.',
              say: 'I owe a lens note and I am not sure what it should cover.' } : null,
            pcs.length && !filed.pcproj ? { on: d('pcproj'), sort: 9, key: 'pcproj', go: '#handins',
              what: 'File the project for the course you study as a project — due ' + nice(d('pcproj')) + '.',
              why: 'It carries the project 30 of that course, and you defend it for an hour before a panel; five of the thirty come off for each week it is late.',
              say: 'I study a course as a project and I want to check my topic and my plan.' } : null,
            state.supervision.some(x => x.roll === st.roll && x.held && !x.confirmed)
              ? { on: t0, sort: 10, key: 'supervision', go: '#handins',
                  what: 'Confirm the supervision hours your teacher has ticked, on the Hand-ins screen.',
                  why: 'You cannot sit the oral defence until eighty per cent of the hours are held and the log is signed by both of you.',
                  say: 'My supervision log is not signed off. Can we go through the hours?' } : null
          ]);
          return wrap({
            role: 'student', known: true, outside: false, placed: !!st.team,
            team: t ? {
              id: t.id, name: t.name || null, block: t.block, lane: t.lane,
              project: { chosen: chosen, title: (S.projects.find(p => p.id === t.project_id) || {}).title || null,
                         custom: t.project_custom || null, patch: t.patch || null,
                         state: t.project_state || null, note: t.project_note || null },
              prediction_sealed_on: t.prediction_sealed_on || null,
              prediction_opened_on: t.prediction_opened_on || null,
              ethics: { tier: t.ethics_tier == null ? null : t.ethics_tier, status: t.ethics_status || null,
                        filed_on: t.ethics_filed_on || null, decided_on: t.ethics_decided_on || null },
              fieldwork: !!t.fieldwork } : null,
            gate: { open: gateOpen(), on: setting('fieldwork_gate_date') },
            sequence: { menu_from: setting('menu_from'), full_from: setting('full_from'), choice_from: setting('choice_from') },
            filed: filed, due: due, lens_open: lensOpen, project_courses: pcs,
            marks: { marked: counted.filter(r => r.mark_30 != null).length, of: counted.length },
            next_session: bk[0] || null,
            next: next,
            person: { who: 'your convener', name: (S.blocks[st.block] || {}).convener || null,
              where: st.block || 'your Build Block',
              say: sayOf(next, 'I am not sure what my team should be doing now. Can you tell me what is next?') } });
        }

        if (ses.role === 'teacher') {
          const rows = await this.myMarkingCourses();
          const courses = rows.map(r => {
            const co = courseRow(r.code);
            const ps = paths().filter(x => x.course === r.code);
            const heldWeeks = weeks().filter(n => {
              const s2 = (S.sessions || []).find(x => x[0] === n); return s2 && s2[2] <= t0; }).length;
            return { course: r.code, title: r.title, regime: co.regime || 'ordinary', closed: !!isClosed(r.code),
              midterm: state.choices[r.code] || null,
              folio_teams: r.teams || 0, folio_waiting: Math.max(0, (r.teams || 0) - (r.done || 0)),
              lens_students: ps.filter(x => x.regime === 'lens' || x.regime === 'viva30').length,
              lens_waiting: ps.filter(x => (x.regime === 'lens' || x.regime === 'viva30')
                && !state.lens_marks.some(m => m.course === r.code && m.roll === x.roll && m.submitted)).length,
              project_students: ps.filter(x => x.regime === 'project').length,
              project_waiting: ps.filter(x => x.regime === 'project'
                && !state.pc_marks.some(m => m.course === r.code && m.roll === x.roll && m.project_submitted)).length,
              defence_waiting: ps.filter(x => x.regime === 'project'
                && !state.pc_marks.some(m => m.course === r.code && m.roll === x.roll && m.oral_submitted)).length,
              supervision_behind: ps.filter(x => x.regime === 'project'
                && state.supervision.filter(y => y.course === r.code && y.roll === x.roll && weeks().indexOf(y.session_n) >= 0).length < heldWeeks).length };
          });
          const sum = k => courses.reduce((a, c) => a + (c[k] || 0), 0);
          const noMid = courses.filter(c => c.regime === 'project' && !c.midterm).length;
          const mid = ((S.sessions || []).find(x => /mid-?term/i.test(x[3] || '')) || [])[1] || null;
          const next = pick([
            noMid ? { on: mid, sort: 1, key: 'midterm', go: '#marks',
              what: 'Record your mid-term choice for the ' + noMid + ' course(s) you supervise as a project — a written paper in mid-term week, or the Session 8 plan with the first 1,500 words.',
              why: 'The student cannot be told what their mid-term is until you have chosen it, and it belongs in the course outline.',
              say: 'I need to record the mid-term choice for the courses I supervise as a project.' } : null,
            sum('supervision_behind') ? { on: t0, sort: 2, key: 'supervision', go: '#marks',
              what: 'Tick this week’s supervision hour for the ' + sum('supervision_behind') + ' student(s) whose log is behind.',
              why: 'A student below eighty per cent of the hours, or with an unsigned log, cannot sit their oral defence.',
              say: 'My supervision log is behind and I want to catch it up.' } : null,
            sum('folio_waiting') ? { on: d('folio'), sort: 3, key: 'marking_card', go: '#marks',
              what: 'Enter the Folio 20 and each student’s viva 10 for the ' + sum('folio_waiting') + ' team(s) still waiting.',
              why: 'Every one of a course’s hundred marks is yours; nobody above you can enter them, and the export to Examinations is built from what you submit.',
              say: 'I have Folios still to mark and I want to check the rubric with you.' } : null,
            sum('lens_waiting') ? { on: d('folio'), sort: 4, key: 'lens', go: '#marks',
              what: 'Mark the ' + sum('lens_waiting') + ' lens note(s) or viva(s) out of 30 your course sets.',
              why: 'These students are not in any team your course marks, so this is the only project mark they can be given in your course.',
              say: 'I have lens notes outstanding in my course.' } : null,
            sum('project_waiting') ? { on: d('folio'), sort: 5, key: 'pcproj', go: '#marks',
              what: 'Mark the project 30 for the ' + sum('project_waiting') + ' student(s) studying your course as a project.',
              why: 'The oral defence 40 is scored separately, and the defence page stays locked until the supervision log reaches eighty per cent and is signed.',
              say: 'I have project marks outstanding for a course studied as a project.' } : null,
            sum('defence_waiting') ? { on: addDays(d('folio'), 7), sort: 6, key: 'defence', go: '#marks',
              what: 'Score the oral defence 40 for the ' + sum('defence_waiting') + ' student(s) who have not been defended yet.',
              why: 'You score your own course out of 40 and nobody else can do it for you; the chair chairs and does not score.',
              say: 'I need to arrange the oral defences for my course.' } : null
          ]);
          return wrap({ role: 'teacher', courses: courses,
            closed: courses.filter(c => c.closed).length, no_courses: courses.length === 0, next: next,
            person: { who: 'the block convener, or the front desk', name: null, where: 'the Greenwich Works office',
              say: sayOf(next, 'I teach on Greenwich Works and I want to check what my course owes.') } });
        }

        if (ses.role === 'convener') {
          const rows = await this.board();
          const thisWeek = ((S.sessions || []).find(x => x[1] <= t0 && x[2] >= t0) || [])[0] || null;
          const n = f => rows.filter(f).length;
          const counts = {
            no_project: n(b => !b.project_id && !(b.project_custom || '').trim()),
            choice_waiting: n(b => b.project_state === 'chosen'),
            unsealed: n(b => (b.project_id || (b.project_custom || '').trim()) && !b.prediction_sealed_on),
            tier_unset: n(b => b.ethics_in && b.ethics_tier == null),
            tier3_not_filed: n(b => b.ethics_tier === 3 && !b.ethics_status),
            no_plan: n(b => !b.plan_in), no_charter: n(b => !b.charter_in),
            field_waiting: n(b => b.field_in && !b.field_accepted),
            no_folio: n(b => !b.folio_in),
            no_check: thisWeek == null ? 0 : n(b => !state.checks.some(c => c.team_id === b.team_id && c.session_n === thisWeek))
          };
          const s11 = ((S.sessions || []).find(x => /^Session 11$/i.test(x[3] || '')) || [])[1] || null;
          const next = pick([
            counts.choice_waiting ? { on: t0, sort: 1, key: 'choice_state', go: '#teams',
              what: 'Approve or return ' + counts.choice_waiting + ' project choice(s) waiting on you, on the Teams board.',
              why: 'A choice nobody has decided is not a project: the team cannot seal its prediction or start collecting behind it.',
              say: 'I have project choices waiting to be approved.' } : null,
            counts.tier_unset ? { on: d('ethics'), sort: 2, key: 'tier', go: '#teams',
              what: 'Set the ethics tier for ' + counts.tier_unset + ' team(s) whose sheet is filed and waiting.',
              why: 'Nobody collects data before the tier is cleared, and a Tier 3 team must reach the panel, which sits weekly from 6 October and decides within a week.',
              say: 'I have ethics sheets filed and waiting for a tier.' } : null,
            counts.tier3_not_filed ? { on: d('ethics'), sort: 3, key: 'ethics_queue', go: '#teams',
              what: 'File ' + counts.tier3_not_filed + ' Tier 3 team(s) with the ethics panel.',
              why: 'A Tier 3 project waits on the panel, not on you; the panel sits weekly from 6 October and decides within a week.',
              say: 'I have Tier 3 teams to put in front of the panel.' } : null,
            counts.no_project ? { on: setting('choice_from'), sort: 4, key: 'sequence', go: '#teams',
              what: counts.no_project + ' of your teams have no project choice on file.',
              why: 'Everything else in the term hangs off the choice: the ethics sheet, the plan, the merge at Session 7 and the build from Session 8.',
              say: 'Some of my teams still have no project.' } : null,
            counts.unsealed ? { on: addDays(setting('choice_from'), 5), sort: 5, key: 'prediction', go: '#teams',
              what: counts.unsealed + ' team(s) with a project have no sealed prediction recorded.',
              why: 'The envelope is sealed before any data and opened by you at the team’s first viva; after the data it is worth nothing.',
              say: 'I need to seal predictions with some of my teams.' } : null,
            counts.field_waiting ? { on: d('field'), sort: 6, key: 'field', go: '#teams',
              what: 'Review ' + counts.field_waiting + ' field plan(s) waiting on you.',
              why: 'No team leaves campus without one, and it cannot be accepted before the tier is cleared and the fieldwork gate is open.',
              say: 'I have field plans waiting to be signed.' } : null,
            counts.no_plan ? { on: d('plan'), sort: 7, key: 'plan', go: '#teams',
              what: counts.no_plan + ' team(s) have not filed the one-page plan.',
              why: 'You merge what every marking course needs into the Folio’s sections from those pages at Session 7.',
              say: 'Some of my teams have not filed their plan.' } : null,
            counts.no_charter ? { on: d('charter'), sort: 8, key: 'charter', go: '#teams',
              what: counts.no_charter + ' team(s) have not filed the team charter.',
              why: 'It is what a teacher reads before moving a student up or down three marks.',
              say: 'Some of my teams have not filed a charter.' } : null,
            counts.no_check && thisWeek != null && rows.some(b => b.field_accepted)
              ? { on: t0, sort: 9, key: 'weekly_check', go: '#teams',
                  what: 'Do this week’s five-question check with the teams that are out in the field — ' + counts.no_check + ' not done this week.',
                  why: 'Two minutes a team: where they went, whether anyone went alone, whether anything happened, whether anyone is uneasy, and where the consent forms are.',
                  say: 'I need to do this week’s field check with my teams.' } : null,
            s11 && rows.length ? { on: s11, sort: 10, key: 'moderation', go: '#moderation',
              what: 'Sample three drafts per block at Session 11 — a strong one, a weak one and a middle one — and send one message back to the block’s teachers.',
              why: 'It is the only look at the work before the Folio is final, and it is what makes the moderation at Session 13 defensible.',
              say: 'I want to set up the draft sample for Session 11.' } : null,
            counts.no_folio ? { on: d('folio'), sort: 11, key: 'folio', go: '#teams',
              what: counts.no_folio + ' team(s) have no Folio on file.',
              why: 'The late rule runs off the portal’s own timestamp, and nothing at all is accepted after 15 December.',
              say: 'I am chasing missing Folios.' } : null
          ]);
          return wrap({ role: 'convener', blocks: (ses.blocks || []).slice(),
            teams: rows.length, stuck_teams: rows.filter(b => (b.stuck || []).length).length,
            counts: counts, week: thisWeek, next: next,
            person: { who: 'the Deputy Chair (exceptions) or the front desk', name: null,
              where: 'the Greenwich Works office',
              say: sayOf(next, 'I hold a Build Block and I want to check where my teams stand.') } });
        }

        /* the office */
        const g = (await this.dash()).gauges || {};
        const noName = Object.values(S.students).filter(s =>
          String(s.name || '').replace(/\s+/g, '') === String(s.roll || '').replace(/\s+/g, '')).length;
        const dueWeek = typeRows().filter(x => x.due_on >= t0 && x.due_on <= addDays(t0, 7))
          .sort((a, b) => a.due_on < b.due_on ? -1 : 1)
          .map(x => ({ key: x.key, label: x.label, on: x.due_on }));
        const noMarker = (+g.courses_no_marker || 0) + (+g.individual_paths_no_marker || 0);
        const next = pick([
          !gateOpen() ? { on: setting('fieldwork_gate_date'), sort: 1, key: 'gate', go: '#admin',
            what: 'Open the fieldwork gate once the duty phone and the sign-out sheet exist — the date is ' + nice(setting('fieldwork_gate_date')) + '.',
            why: 'Until it is open no field plan can be accepted, whatever a team’s tier, so no team may leave campus.',
            say: 'The fieldwork gate is still shut. Do the duty phone and the sign-out sheet exist yet?' } : null,
          noMarker ? { on: addDays(d('folio'), -14), sort: 2, key: 'no_marker', go: '#office',
            what: noMarker + ' course(s) have nobody who can enter their marks.',
            why: 'Either the Registrar has named no teacher, or the named teacher has no portal account: until it is fixed nobody can mark those students at all.',
            say: 'Some courses have no marker in the portal. Who is being named?' } : null,
          g.staff_pending ? { on: t0, sort: 3, key: 'g_staff', go: '#office',
            what: g.staff_pending + ' member(s) of staff are still on the first password.',
            why: 'An account on the first password can do nothing but change it, so those people cannot mark, approve or sign anything.',
            say: 'Some staff have not chosen their own password yet.' } : null,
          noName ? { on: t0, sort: 4, key: 'g_accounts', go: '#office',
            what: noName + ' student(s) have no name on file — only a roll number.',
            why: 'Their cards, claim slips and marks export cannot be printed with a name until the Registrar sends the names file.',
            say: 'We are still short of student names. Where is the names file?' } : null,
          g.unplaced ? { on: t0, sort: 5, key: 'g_unplaced', go: '#office',
            what: g.unplaced + ' undergraduate(s) who should have a team have none.',
            why: 'Anyone who registered after the cut is placed by hand, with a written reason; until then they have no project and nothing to hand in.',
            say: 'Some undergraduates are still unplaced.' } : null,
          (+g.storage_bytes || 0) * 10 > (+g.storage_limit || 1) * 8 ? { on: t0, sort: 6, key: 'g_storage', go: '#admin',
            what: 'Storage is over eighty per cent of the plan — raise storage_limit_gb or move to the larger plan.',
            why: 'When the bucket is full a team cannot upload its Folio at all, and the late rule does not care why.',
            say: 'The portal’s storage is nearly full.' } : null,
          dueWeek.length ? { on: dueWeek[0].on, sort: 7, key: 'settings', go: '#gates',
            what: dueWeek[0].label + ' is due on ' + nice(dueWeek[0].on) + ' — watch the gates screen this week.',
            why: 'The gates screen is where a missing hand-in is seen while there is still time to chase it.',
            say: 'What is due this week, and who is behind?' } : null
        ]);
        return wrap({ role: 'office', gauges: g, no_name: noName, due_this_week: dueWeek,
          gate: { open: gateOpen(), on: setting('fieldwork_gate_date') }, next: next,
          person: { who: 'the Deputy Chair', name: null, where: 'the Greenwich Works office',
            say: sayOf(next, 'I am in the office and I want to know what needs doing this week.') } });
      },
      async helperAiState() {
        return { on: (setting('helper_ai') || 'off') === 'on', cap: +(setting('helper_ai_daily_cap') || 5),
                 used: 0, left: +(setting('helper_ai_daily_cap') || 5), max_words: +(setting('helper_ai_max_words') || 120) };
      },
      // Built, and shipped off (register AX.4).  Demo mode has no network at
      // all, so even with the setting on it says so rather than pretending.
      async helperAsk() {
        if ((setting('helper_ai') || 'off') !== 'on')
          throw err('The helper’s AI half is switched off. Ask your convener, or the front desk.');
        throw err('Demo mode never calls a network service, so the AI half cannot answer here. On the live portal this goes to the Edge Function.');
      },

      async auditTrail(n) { return state.audit.slice(-(n || 50)).reverse(); },
      async marksFor(course) {
        return visibleTeams()

          .filter(t => (t.marking || []).includes(course))
          .sort((a, b) => a.id < b.id ? -1 : 1)
          .map(t => {
            const rows = state.marks.filter(m => m.course === course && m.team_id === t.id);
            const r = rows[0] || {};
            return {
              team_id: t.id, block: t.block, lane: t.lane,
              submitted: !!r.submitted,
              rubric: { substance: r.substance ?? '', evidence: r.evidence ?? '',
                        integration: r.integration ?? '', presentation: r.presentation ?? '',
                        revision: r.revision ?? '' },
              // a course marks the members of the team who take it, not the whole team
              checklist: ['folio', 'brief', 'handover', 'ai'].reduce((o, k) => (o[k] = !!latestOf(k, t.id), o), {}),
              members: t.members.filter(roll => ((S.students[roll] || {}).courses || []).includes(course)).map(roll => {
                const m = rows.find(x => x.roll === roll) || {};
                const own = m.substance == null ? null : Math.max(0, Math.min(20, folio20(m) + (m.adjustment || 0)));
                return { roll, name: nameOfRoll(roll),
                         adjustment: m.adjustment ?? 0, viva: m.viva ?? '',
                         participation: m.participation ?? '', comment: m.comment || '',
                         net: own == null ? null : netOf('folio', t.id, null, 20, own, m.viva || 0) };
              })
            };
          });
      },
      async saveMarks(course, teamId, rubric, members, submit) {
        // save_marks(): the course's own teacher and nobody else — not the office
        const who = state.session || {};
        if (!(who.courses || []).includes(course))
          throw err('You do not mark ' + course + '. Only the course teacher enters its marks.');
        if (isClosed(course)) throw err('Marking for ' + course + ' is closed. The office can reopen it, with a reason.');
        if (courseRow(course).regime && courseRow(course).regime !== 'ordinary')
          throw err(course + ' does not mark a Folio: it is studied as a project, or sits outside Greenwich Works.');
        const v = checkMarks(rubric, members, submit);
        const at = new Date().toISOString();
        const was = state.marks.filter(m => m.course === course && m.team_id === teamId);
        state.marks = state.marks.filter(m => !(m.course === course && m.team_id === teamId));
        v.members.forEach(m => {
          const before = was.find(x => x.roll === m.roll) || {};
          state.marks.push({
            course, team_id: teamId, roll: m.roll,
            substance: v.rubric.substance, evidence: v.rubric.evidence,
            integration: v.rubric.integration, presentation: v.rubric.presentation,
            revision: v.rubric.revision,
            adjustment: m.adjustment, viva: m.viva, participation: m.participation,
            comment: m.comment, submitted: !!submit, marked_at: at,
            // save_marks() only stamps submitted_at on the save that submits,
            // and keeps the first one on every save after that
            submitted_at: submit ? (before.submitted_at || at) : (before.submitted_at || null)
          });
        });
        dashCache = null;
        save();
      },
      async moderation() {
        const by = {};
        state.marks.forEach(m => { (by[m.team_id] = by[m.team_id] || {})[m.course] = folio20(m); });
        return Object.keys(by).map(team_id => {
          const v = Object.values(by[team_id]);
          return { team_id, marking_courses: v.length, low: Math.min(...v), high: Math.max(...v),
                   spread: Math.max(...v) - Math.min(...v),
                   mean: Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 };
        }).sort((a, b) => b.spread - a.spread);
      },
      // the columns marks_export returns, in the order it returns them:
      // Examinations opens this in a spreadsheet and the two must match.
      // export_course_marks(): the office and the course's own teacher; every enrolled student a row
      async exportMarks(course) {
        const who = state.session || {};
        if (!(who.role === 'office' || (who.courses || []).includes(course)))
          throw err('The marks of ' + course + ' are exported by the office or by its own teacher.');
        log('marks_exported', { course });
        const rows = paths().filter(x => x.course === course && ['folio', 'lens', 'viva30', 'project'].indexOf(x.regime) >= 0);
        return rows.map(x => {
          const st = S.students[x.roll] || {};
          const base = { course, roll: x.roll, name: st.name || '', team_id: st.team || null, path: x.regime,
            raw_30: null, penalty: null, net_30: null, days_late: null, penalty_waived: null,
            substance: null, evidence: null, integration: null, presentation: null, revision: null,
            adjustment: null, viva: null, viva_30: null,
            oral_command: null, oral_defends: null, oral_unexpected: null, oral_presents: null, oral_40: null,
            submitted: false, comment: null };
          if (x.regime === 'folio') {
            const m = state.marks.find(y => y.course === course && y.roll === x.roll);
            if (m) { const own = Math.max(0, Math.min(20, folio20(m) + (m.adjustment || 0)));
              const n = netOf('folio', st.team, null, 20, own, m.viva || 0);
              Object.assign(base, { raw_30: n.raw_30, penalty: n.penalty, net_30: n.net_30, days_late: n.days_late, penalty_waived: n.waived,
                substance: m.substance, evidence: m.evidence, integration: m.integration, presentation: m.presentation,
                revision: m.revision, adjustment: m.adjustment, viva: m.viva, submitted: !!m.submitted, comment: m.comment || null }); }
          } else if (x.regime === 'lens' || x.regime === 'viva30') {
            const m = state.lens_marks.find(y => y.course === course && y.roll === x.roll);
            if (m) { const n = m.kind === 'lens' ? netOf('lens', x.roll, course, 20, folio20(m), m.viva || 0)
                                                : { raw_30: m.viva30 || 0, net_30: m.viva30 || 0, penalty: 0, days_late: null, waived: false };
              Object.assign(base, { raw_30: n.raw_30, penalty: n.penalty, net_30: n.net_30, days_late: n.days_late, penalty_waived: n.waived,
                substance: m.substance, evidence: m.evidence, integration: m.integration, presentation: m.presentation,
                revision: m.revision, viva: m.viva, viva_30: m.viva30, submitted: !!m.submitted, comment: m.comment || null }); }
          } else {
            const m = state.pc_marks.find(y => y.course === course && y.roll === x.roll);
            if (m) { const n = netOf('pcproj', x.roll, null, 30, m.project || 0, 0);
              Object.assign(base, { raw_30: n.raw_30, penalty: n.penalty, net_30: n.net_30, days_late: n.days_late, penalty_waived: n.waived,
                oral_command: m.command, oral_defends: m.defends, oral_unexpected: m.unexpected, oral_presents: m.presents,
                oral_40: m.command == null ? null : m.command + m.defends + m.unexpected + m.presents,
                submitted: !!(m.project_submitted && m.oral_submitted), comment: m.comment || null }); }
          }
          return base;
        }).sort((a, b) => (a.path + (a.team_id || '') + a.roll) < (b.path + (b.team_id || '') + b.roll) ? -1 : 1);
      },

      /* ---- the dashboards ------------------------------------------ */
      // gates_by_team, one row per team per hand-in type
      async gatesByTeam() {
        const now = kDay(today());
        const rows = [];
        visibleTeams().forEach(t => typeRows().forEach(ty => {
          const h = state.handins.filter(x => x.type_key === ty.key && x.team_id === t.id)
            .sort((a, b) => b.version - a.version)[0];
          const na = (ty.applies === 'fieldwork' && !t.fieldwork) || ty.scope === 'individual';
          const past = daysBetween(now, ty.due_on);
          rows.push({ team_id: t.id, block: t.block, lane: t.lane, fieldwork: !!t.fieldwork,
            type_key: ty.key, label: ty.label, scope: ty.scope, due_on: ty.due_on,
            applies: ty.applies, sort: ty.sort, filed: !!h,
            submitted_at: h ? h.submitted_at : null, version: h ? h.version : null,
            days_late: h ? hand(h).days_late : null, penalty: h ? hand(h).penalty : null,
            state: h ? h.state : null,
            cell: na ? 'na' : h ? 'filed' : past > 0 ? 'late' : past > -10 ? 'due' : 'open' });
        }));
        return rows;
      },

      // Demo mode has one term's worth of nothing in it until somebody uploads
      // something, and an empty dashboard demonstrates nothing.  So the numbers
      // below are invented — deterministically, from the cohort that is there,
      // and always at least whatever has really been done in this browser.
      async dash() {
        if (dashCache) return dashCache;
        const ses = state.session || {};
        const teams = visibleTeams();
        const ids = teams.map(t => t.id);
        const tys = typeRows().filter(t => t.scope !== 'individual');
        const blocks = [...new Set(teams.map(t => t.block))].sort();
        const now = kDay(today());

        const share = ty => {
          const past = daysBetween(now, ty.due_on), r = hash01(ty.key);
          return past >= 0 ? 0.80 + 0.18 * r : past > -14 ? 0.30 + 0.35 * r : 0.10 + 0.25 * r;
        };
        const realFiled = (ty, list) => new Set(state.handins
          .filter(h => h.type_key === ty.key && list.some(t => t.id === h.team_id))
          .map(h => h.team_id)).size;

        const blockStrip = [];
        blocks.forEach(b => {
          const list = teams.filter(t => t.block === b);
          tys.forEach(ty => {
            const due = list.filter(t => ty.applies !== 'fieldwork' || t.fieldwork).length;
            const filed = Math.min(due, Math.max(realFiled(ty, list),
              Math.round(due * share(ty) * (0.85 + 0.3 * hash01(b + ty.key)))));
            const late = daysBetween(now, ty.due_on) > 0
              ? Math.round(filed * (0.08 + 0.14 * hash01(b + ty.key + 'l'))) : 0;
            blockStrip.push({ block: b, type_key: ty.key, label: ty.label, sort: ty.sort,
              due_on: ty.due_on, due, filed, late,
              pct: due ? Math.round(100 * filed / due) : null });
          });
        });
        const filedIn = (b, key) => (blockStrip.find(r => r.block === b && r.type_key === key) || {}).filed || 0;

        const funnel = blocks.map(b => {
          const list = teams.filter(t => t.block === b);
          const chosen = list.filter(t => t.project_id || (t.project_custom || '').trim()).length;
          return { block: b, teams: list.length,
            with_project: Math.min(list.length,
              Math.max(chosen, Math.round(list.length * (0.7 + 0.25 * hash01(b + 'p'))))),
            ethics: filedIn(b, 'ethics'), plan: filedIn(b, 'plan'),
            charter: filedIn(b, 'charter'), folio: filedIn(b, 'folio') };
        });

        // the claim curve: a rush on the first days, a second on launch day
        const roll = Object.values(S.students).filter(s => ids.indexOf(s.team) >= 0).length;
        const start = (S.sessions[0] || [])[1] || '2026-09-07';
        const days = [];
        for (let d = start; d <= now && days.length < 140; d = addDays(d, 1)) days.push(d);
        const w = days.map((d, i) => 0.2 + hash01('c' + d) + (i < 3 ? 3 : 0) + (i === 14 ? 5 : 0));
        const wsum = w.reduce((a, x) => a + x, 0) || 1;
        const claimedTotal = Math.max(Object.keys(state.claimed).length, Math.round(roll * 0.86));
        const claimCurve = days.map((d, i) => ({ day: d, n: Math.round(claimedTotal * w[i] / wsum) }))
          .filter(x => x.n > 0);

        // hand-ins per day, bunched into the four days before each deadline
        const spread = [0.40, 0.25, 0.15, 0.12, 0.08];
        const byDay = {};
        const put = (day, type_key, n, late) => {
          const k = day + '|' + type_key;
          byDay[k] = byDay[k] || { day, type_key, n: 0, late: 0 };
          byDay[k].n += n; byDay[k].late += late;
        };
        tys.forEach(ty => {
          const rows = blockStrip.filter(r => r.type_key === ty.key);
          const total = rows.reduce((a, r) => a + r.filed, 0);
          const late = rows.reduce((a, r) => a + r.late, 0);
          const end = ty.due_on < now ? ty.due_on : now;
          spread.forEach((f, i) => {
            const d = addDays(end, -i);
            const n = Math.round((total - late) * f);
            if (n > 0) put(d, ty.key, n, 0);
          });
          if (late > 0) {
            const d = addDays(end, 2);
            put(d < now ? d : now, ty.key, late, late);
          }
        });
        state.handins.forEach(h => {
          const l = hand(h);
          put(kDay(h.submitted_at), h.type_key, 1, l.days_late > 0 ? 1 : 0);
        });
        const submissions = Object.values(byDay).sort((a, b) => a.day < b.day ? -1 : 1);

        // the mark distribution, one hump per course, centred somewhere sane
        const courses = [...new Set(teams.flatMap(t => t.marking || []))].slice(0, 8);
        const hist = {};
        const bump = (course, mark, n) => {
          const k = course + '|' + mark;
          hist[k] = hist[k] || { course, mark, n: 0 };
          hist[k].n += n;
        };
        courses.forEach(c => {
          const marked = teams.filter(t => (t.marking || []).includes(c))
            .reduce((a, t) => a + (t.members || []).length, 0);
          const centre = 12 + Math.round(4 * hash01(c + 'm'));
          for (let mark = 6; mark <= 20; mark++) {
            const n = Math.round(marked * 0.55 * Math.exp(-Math.pow(mark - centre, 2) / 5) / 2.2);
            if (n > 0) bump(c, mark, n);
          }
        });
        state.marks.forEach(m => bump(m.course, folio20(m), 1));
        const histogram = Object.values(hist)
          .sort((a, b) => a.course === b.course ? a.mark - b.mark : (a.course < b.course ? -1 : 1));

        const markings = histogram.reduce((a, r) => a + r.n, 0);
        const mean = markings ? histogram.reduce((a, r) => a + r.mark * r.n, 0) / markings : 0;
        const sd = markings ? Math.sqrt(histogram.reduce((a, r) =>
          a + r.n * Math.pow(r.mark - mean, 2), 0) / markings) : 0;
        const moderation = markings ? {
          teams_marked: Math.max(new Set(state.marks.map(m => m.team_id)).size,
                                 Math.round(teams.length * 0.55)),
          markings,
          mean_20: Math.round(mean * 100) / 100,
          sd_20: Math.round(sd * 100) / 100,
          low: Math.min(...histogram.map(r => r.mark)),
          high: Math.max(...histogram.map(r => r.mark))
        } : null;

        const marking = await this.myMarkingCourses();

        // office_gauges() is office-only and raises for anyone else; the demo
        // hands back null rather than a number nobody should see.
        let gauges = null;
        if (ses.role === 'office') {
          const all = Object.keys(S.students).length;
          const files = state.handins.reduce((a, h) => a + (h.file_size || 0), 0);
          const filed = blockStrip.reduce((a, r) => a + r.filed, 0);
          gauges = {
            roster: all,
            claimed: Math.max(Object.keys(state.claimed).length, Math.round(all * 0.86)),
            unplaced: 3, not_registered: 3, courses_no_marker: 2,
            locked_out: Object.values(state.tries).filter(t => t.n >= 8).length + 2,
            staff: (S.staff || []).length + 15,
            staff_pending: 4,
            teams: Object.keys(S.teams).length,
            handins: state.handins.length + filed,
            storage_bytes: Math.round(files + filed * 2.4 * MB),
            storage_limit: (+(setting('storage_limit_gb') || 1)) * 1024 * MB,
            reports_open: state.reports.filter(r => r.state === 'open').length,
            marks_in: markings,
            courses_closed: state.closed.length,
            individual_paths_no_marker: 1
          };
        }

        dashCache = { funnel, blockStrip, claimCurve, submissions, histogram,
                      moderation, marking, gauges };
        return dashCache;
      },

      nameOf(roll) { return nameOfRoll(roll); },
      fmt: { kDay, kTime, addDays }
    };
  }

  /* ======================================================== SUPABASE ==== */
  function LiveAPI() {
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    // A dot the person types is kept: staff handles are ali.saeed, dr.uzma.qazi.
    // A student's 'BS00 12345' still becomes bs00-12345.
    const rollEmail = r => r.trim().toLowerCase().replace(/[^a-z0-9.]+/g, '-') + '@works.greenwich.edu.pk';
    const unwrap = ({ data, error }) => { if (error) throw friendly(error); return data; };
    const ROSTER_COLS = 'roll,name,major,prog,dept,track,team_id,block,courses,marking,lens_courses,status,reason,user_id,claimed_at';
    let cache = {};
    // Names, kept from whatever roster rows this account was allowed to read.
    // There is no public directory: a convener resolves the students in their
    // blocks and nobody else, which is the point of the roster_read policy.
    let names = { byRoll: {}, byUser: {} };
    const remember = rows => (rows || []).forEach(r => {
      if (r && r.roll && r.name) names.byRoll[r.roll] = r.name;
      if (r && r.user_id && r.name) names.byUser[r.user_id] = r.name;
    });
    const forget = () => { cache = {}; names = { byRoll: {}, byUser: {} }; };

    // A query that is allowed to come back empty-handed.  dash() asks for seven
    // things at once and most roles are refused some of them; one refusal must
    // not take the screen down with it.
    const soft = (q, fallback) => Promise.resolve(q).then(
      r => (r && r.error) ? fallback : (r && r.data != null ? r.data : fallback),
      () => fallback);

    // handins carries submitted_by, which is a uuid.  Screens show a person.
    const hand = h => Object.assign({}, h, {
      by: names.byUser[h.submitted_by] || names.byRoll[h.roll] || h.roll || 'A team member'
    });
    // bookings arrive as a timestamp inside a joined slot row; the demo has a
    // flat day and time.  Both give both, and keep the timestamp for sorting.
    const bkg = b => {
      const at = (b.slots && b.slots.starts_at) || b.starts_at;
      return Object.assign({}, b, { starts_at: at,
        day: at ? kDay(at) : b.day, time: at ? kTime(at) : b.time });
    };
    const markRow = r => ({ course: r.course || r.code, code: r.course || r.code,
      title: r.title || r.course || r.code, teams: +r.teams || 0, done: +r.done || 0,
      students: r.students == null ? null : +r.students });

    return {
      mode: 'live',
      async session() {
        const { data } = await sb.auth.getSession();
        if (!data.session) return null;
        if (cache.profile) return cache.profile;
        const p = unwrap(await sb.from('profiles').select('*').eq('user_id', data.session.user.id).maybeSingle());
        if (p) { cache.profile = p; if (p.roll) names.byRoll[p.roll] = p.name; if (p.user_id) names.byUser[p.user_id] = p.name; }
        return p;
      },
      async signIn(roll, password) {
        unwrap(await sb.auth.signInWithPassword({ email: rollEmail(roll), password }));
        forget(); return this.session();
      },
      async claim(roll, code, password) {
        // verify_claim() returns a row now and never raises on a wrong code:
        // raising rolled back the attempt counter it had just incremented, so
        // the eight-try lock counted to one for ever.  The message it hands
        // back is written for the student and goes on screen as it is.
        const v = unwrap(await sb.rpc('verify_claim', { p_roll: roll.trim(), p_code: code }));
        if (!v || !v.ok) throw err((v && v.message) || 'That code does not match this roll number.');
        // A claim that stopped half way (the sign-up went through, the link did
        // not — a dropped connection is enough) used to be stuck for ever: the
        // second try failed on "User already registered".  If the address is
        // already registered, sign in to it with the password just typed and
        // carry on to link_account(); only the person who set it can do that.
        const su = await sb.auth.signUp({ email: v.email, password });
        if (su.error) {
          const again = /already|registered|exists/i.test(String(su.error.message || '') + String(su.error.code || ''));
          if (!again) throw friendly(su.error);
          const si = await sb.auth.signInWithPassword({ email: v.email, password });
          if (si.error) throw err('This account was started before but not finished, with a different password. '
            + 'Use the password you chose then, or ask the front desk to reset it and give you a new code.');
        }
        const { data } = await sb.auth.getSession();
        if (!data.session) unwrap(await sb.auth.signInWithPassword({ email: v.email, password }));
        const l = unwrap(await sb.rpc('link_account', { p_roll: roll.trim(), p_code: code }));
        if (!l || !l.ok) throw err((l && l.message) || 'That code does not match this roll number.');
        forget(); return this.session();
      },
      async signOut() { await sb.auth.signOut(); forget(); },

      async changePassword(next) {
        unwrap(await sb.auth.updateUser({ password: next }));
        unwrap(await sb.rpc('password_changed'));
        cache = {}; return this.session();
      },

      async bootstrap() {
        cache.dash = null;                      // one dash() per render
        const profile = await this.session(); if (!profile) return null;
        const [types, sessions, windows, blocks, projects, courses, full, settingsRows, closedRows, choiceRows] = await Promise.all([
          sb.from('handin_types').select('*').order('sort'),
          sb.from('sessions').select('*').order('n'),
          sb.from('windows').select('*').order('sort'),
          sb.from('blocks').select('*').order('name'),
          // the menu columns; the long text is project_full, which the database serves by date (db/16)
          sb.from('projects').select('id,block,lane,title,problem,authority,reserve'),
          sb.from('courses').select('code,title,school,teachers,kind,regime,pg_course'),
          soft(sb.from('project_full').select('*'), []),
          soft(sb.from('gw_settings').select('key,value,note,updated_at'), []),
          soft(sb.from('marking_closed').select('course,closed_at'), []),
          soft(sb.from('course_choices').select('course,midterm'), [])
        ].map(p => p.then ? p.then(r => r && r.error !== undefined ? unwrap(r) : r) : p));
        const fullBy = {}; (full || []).forEach(f => { fullBy[f.id] = f; });
        const settings = {}; (settingsRows || []).forEach(r => { settings[r.key] = r.value; });
        const t0 = kDay(today());
        const stage = t0 >= (settings.choice_from || '9999') ? 'choice' : t0 >= (settings.full_from || '9999') ? 'full'
                    : t0 >= (settings.menu_from || '9999') ? 'menu' : 'before';
        const out = { profile, handinTypes: types, sessions, blocks, courses,
                      projects: (projects || []).map(p => Object.assign({ full: !!fullBy[p.id] }, p, fullBy[p.id] || {})),
                      settings, stage, closed: (closedRows || []).map(r => r.course), choices: choiceRows || [],
                      settingNotes: (settingsRows || []).reduce((o, r) => (o[r.key] = r.note, o), {}),
                      booking: { windows, slot_minutes: 15 } };
        if (profile.role === 'student') {
          // named columns: db/12 takes the claim columns away from every API
          // caller, and "select *" on a table with a withheld column is refused
          const me = unwrap(await sb.from('roster').select(ROSTER_COLS + ',project_courses').eq('roll', profile.roll).maybeSingle())
            || { roll: profile.roll, name: profile.name, status: 'not in this cut', courses: [], lens_courses: [], project_courses: [] };
          out.me = me; remember([me]);
          // who owes what (db/15 student_courses): the register's word on every course, own rows only
          const sc = await soft(sb.from('student_courses').select('course,regime,pos').eq('roll', me.roll).order('pos'), []);
          const byCode = {}; (courses || []).forEach(c => { byCode[c.code] = c; });
          out.myCourses = (sc || []).map(x => Object.assign({ title: (byCode[x.course] || {}).title || x.course,
            teachers: (byCode[x.course] || {}).teachers || [] }, x));
          me.lens_courses = out.myCourses.filter(x => x.regime === 'lens').map(x => x.course);
          me.project_courses = out.myCourses.filter(x => x.regime === 'project').map(x => x.course);
          if (me.team_id) {
            out.team = unwrap(await sb.from('teams').select('*').eq('id', me.team_id).single());
            out.mates = unwrap(await sb.from('roster').select('roll,name,major,user_id').eq('team_id', me.team_id));
            remember(out.mates);
          }
          out.handins  = unwrap(await sb.from('handins_current').select('*')).map(hand);
          out.bookings = unwrap(await sb.from('bookings').select('*, slots(starts_at)').eq('state', 'booked')).map(bkg);
          out.supervision = await soft(sb.from('supervision_log').select('*').eq('roll', me.roll), []);
          out.defence = await soft(sb.from('defences').select('*').eq('roll', me.roll).maybeSingle(), null);
        } else {
          const roster = unwrap(await sb.from('roster')
            .select('roll,name,team_id,block,status,claimed_at,user_id'));
          remember(roster);
          let teams = unwrap(await sb.from('teams').select('*'));
          // roster_read and handins_read are scoped now — a convener to their
          // blocks, a teacher to the teams one of their courses marks — but
          // teams_read still hands a teacher the whole cohort.  Scoping the
          // team list the same way keeps the three lists talking about the same
          // people; it never widens what the database allowed.
          if (profile.role === 'convener')
            teams = teams.filter(t => (profile.blocks || []).includes(t.block));
          if (profile.role === 'teacher')
            teams = teams.filter(t => (t.marking || []).some(c => (profile.courses || []).includes(c)));
          const ids = teams.map(t => t.id);
          out.myBlocks = profile.role === 'office' ? blocks.map(b => b.name) : (profile.blocks || []);
          out.teams    = teams;
          out.roster   = profile.role === 'office' ? roster
            : roster.filter(r => ids.indexOf(r.team_id) >= 0);
          out.handins  = unwrap(await sb.from('handins_current').select('*')).map(hand);
          out.bookings = unwrap(await sb.from('bookings').select('*, slots(starts_at)').eq('state', 'booked')).map(bkg);
          out.reports  = unwrap(await sb.from('reports').select('*').order('created_at', { ascending: false }));
        }
        return out;
      },

      async slotsFor(day) {
        // slots_for_day() (db/13) answers "is it taken" for every slot without
        // saying by whom.  The browser used to work it out from the bookings it
        // was allowed to read — its own — so everybody else's slots looked free.
        const rows = unwrap(await sb.rpc('slots_for_day', { p_day: day }));
        return (rows || []).map(s => ({ id: s.id, day, time: kTime(s.starts_at),
          taken: !!s.taken, mine: !!s.mine, bookable: s.bookable !== false }));
      },
      // one call for the whole strip.  This used to be one round trip per day,
      // each one fetching every booking in the database, sixty-nine times.
      async slotCounts(days) {
        if (!days || !days.length) return [];
        const sorted = days.slice().sort();
        const rows = unwrap(await sb.rpc('slot_counts',
          { p_from: sorted[0], p_to: sorted[sorted.length - 1] }));
        return days.map(d => {
          const r = (rows || []).find(x => x.day === d);
          return { day: d, free: r ? +r.free : 0, total: r ? +r.total : 0 };
        });
      },
      async book(slotId, win, what) { unwrap(await sb.rpc('book_slot', { p_slot: slotId, p_window: win, p_what: what })); },
      async cancelBooking(id) { unwrap(await sb.rpc('cancel_booking', { p_id: id })); },

      async submitHandin(typeKey, file, note, course) {
        const p = await this.session();
        const me = unwrap(await sb.from('roster').select('team_id,roll').eq('roll', p.roll).single());
        const types = unwrap(await sb.from('handin_types').select('*').eq('key', typeKey).single());
        // the bucket refuses this itself, but its error is about MIME types and
        // byte counts; refusing here also saves uploading 200 MB to be told no
        if (file && file.size > MAX_UPLOAD)
          throw err('That file is larger than 60 MB. Split it, or compress the images.');
        if (typeKey === 'lens' && !course) throw err('Say which course the lens note is for.');
        const folder = types.scope === 'individual' ? me.roll : me.team_id;
        // a lens note sits one folder deeper, under its course: submit_handin() (db/15) reads it from there
        const path = folder + '/' + typeKey + '/' + (typeKey === 'lens' ? course + '/' : '')
                   + Date.now() + '-' + file.name.replace(/[^\w.\-]+/g, '_');
        const up = await sb.storage.from('handins').upload(path, file, { upsert: false });
        if (up.error) throw friendly(up.error);
        // p_file_size is still in the signature and still ignored: submit_handin
        // reads the size off the object that actually arrived.
        unwrap(await sb.rpc('submit_handin', { p_type: typeKey, p_file_path: path,
          p_file_name: file.name, p_file_size: file.size, p_note: note || null, p_individual: false }));
        cache.dash = null;
      },
      async fileUrl(path) {
        if (!path) return null;
        const { data, error } = await sb.storage.from('handins').createSignedUrl(path, 300);
        if (error) throw friendly(error);
        return (data && data.signedUrl) || null;
      },
      async patchesTaken(projectId, custom) {
        let q = sb.from('patches_taken').select('team_id,patch');
        q = projectId ? q.eq('project_id', projectId) : q.ilike('project_custom', custom || '');
        return unwrap(await q);
      },
      async claimProject(projectId, custom, patch, fieldwork) {
        unwrap(await sb.rpc('claim_project', { p_project: projectId || null,
          p_custom: custom || null, p_patch: patch, p_fieldwork: !!fieldwork }));
      },
      async report(aboutRoll, body) {
        const p = await this.session();
        const me = unwrap(await sb.from('roster').select('team_id,roll').eq('roll', p.roll).single());
        unwrap(await sb.from('reports').insert({ team_id: me.team_id, about_roll: aboutRoll, by_roll: me.roll, body }));
      },
      async resolveReport(id, outcome) {
        unwrap(await sb.from('reports').update({ state: 'resolved', outcome, seen_at: new Date().toISOString() }).eq('id', id));
      },
      // reset_claim() is the office's, and PostgREST no longer lets anybody
      // else near it.  It returns the new code in clear text once, here.
      async resetClaim(roll) {
        const code = unwrap(await sb.rpc('reset_claim', { p_roll: (roll || '').trim() }));
        return { code };
      },

      /* ---- marking ------------------------------------------------- */
      // the individual paths of a course: student_courses is readable for the caller's own courses
      async pathsFor(course) {
        const q = sb.from('student_courses').select('roll,course,regime,pos').in('regime', ['lens', 'viva30', 'project']);
        return await soft(course ? q.eq('course', course) : q, []);
      },
      async myMarkingCourses() {
        const p = await this.session();
        // my_marking_progress() counts it in the database, scoped to my_courses()
        const rows = await soft(sb.rpc('my_marking_progress'), []);
        const closed = await soft(sb.from('marking_closed').select('course'), []);
        const isClosed = c => (closed || []).some(x => x.course === c);
        const decorate = list => list.map(c => Object.assign({ closed: isClosed(c.code) }, c));
        // a teacher also marks lens notes, vivas out of 30 and projects: those courses come from student_courses
        let extra = [];
        if (p.role === 'teacher') {
          const ps = await this.pathsFor(null);
          const codes = [...new Set((ps || []).map(x => x.course))].filter(c => !rows.some(r => (r.course || r.code) === c));
          if (codes.length) {
            const [cs, lm, pm] = await Promise.all([
              sb.from('courses').select('code,title,regime').in('code', codes).then(unwrap),
              soft(sb.from('lens_marks').select('course,roll,submitted').in('course', codes), []),
              soft(sb.from('pc_marks').select('course,roll,project_submitted').in('course', codes), [])
            ]);
            extra = codes.map(code => {
              const mine = ps.filter(x => x.course === code);
              const co = cs.find(c => c.code === code) || {};
              const done = mine.filter(x => x.regime === 'project'
                ? pm.some(m => m.course === code && m.roll === x.roll && m.project_submitted)
                : lm.some(m => m.course === code && m.roll === x.roll && m.submitted)).length;
              return { course: code, code, title: co.title || code, teams: 0, done, students: mine.length, regime: co.regime,
                       lens: mine.filter(x => x.regime === 'lens').length, viva30: mine.filter(x => x.regime === 'viva30').length,
                       project: mine.filter(x => x.regime === 'project').length };
            });
          }
        }
        if (rows.length || extra.length) return decorate(rows.map(markRow).concat(extra).sort((a, b) => a.code < b.code ? -1 : 1));
        // A convener is given blocks and no courses, so that function returns
        // them nothing.  They still run the marking screen for their blocks, so
        // fall back to the teams RLS lets them see.  For a teacher the function
        // is the whole answer, and a student marks nothing.
        if (p.role !== 'convener' && p.role !== 'office') return [];
        const teams = unwrap(await sb.from('teams').select('id,marking'));
        const codes = [...new Set(teams.flatMap(t => t.marking || []))];
        if (!codes.length) return [];
        const [marks, cs, roster] = await Promise.all([
          sb.from('marks').select('course,team_id,submitted').eq('submitted', true).then(unwrap),
          sb.from('courses').select('code,title').in('code', codes).then(unwrap),
          sb.from('roster').select('roll,team_id,courses').then(unwrap)
        ]);
        return codes.map(code => {
          const mine = teams.filter(t => (t.marking || []).includes(code));
          const done = new Set(marks.filter(m => m.course === code).map(m => m.team_id));
          const ids = mine.map(t => t.id);
          const co = cs.find(c => c.code === code) || {};
          return markRow({ course: code, title: co.title || code, teams: mine.length,
            done: mine.filter(t => done.has(t.id)).length,
            students: roster.filter(r => ids.indexOf(r.team_id) >= 0 && (r.courses || []).includes(code)).length });
        }).filter(c => c.teams > 0).sort((a, b) => a.code < b.code ? -1 : 1);
      },
      async marksFor(course) {
        const teams = unwrap(await sb.from('teams').select('id,block,lane,marking'))
          .filter(t => (t.marking || []).includes(course)).sort((a, b) => a.id < b.id ? -1 : 1);
        const ids = teams.map(t => t.id);
        if (!ids.length) return [];
        const [roster, marks, nets, checks] = await Promise.all([
          sb.from('roster').select('roll,name,team_id,courses').in('team_id', ids).then(unwrap),
          sb.from('marks').select('*').eq('course', course).in('team_id', ids).then(unwrap),
          soft(sb.from('folio_marks_net').select('team_id,roll,days_late,penalty_due,waived,penalty,raw_30,net_30').eq('course', course).in('team_id', ids), []),
          soft(sb.from('folio_checklist').select('*').in('team_id', ids), [])
        ]);
        remember(roster);
        return teams.map(t => {
          const rows = marks.filter(m => m.team_id === t.id);
          const r = rows[0] || {};
          const ck = (checks || []).find(c => c.team_id === t.id) || {};
          return {
            team_id: t.id, block: t.block, lane: t.lane, submitted: !!r.submitted,
            checklist: { folio: !!ck.folio, brief: !!ck.client_brief, handover: !!ck.handover_page, ai: !!ck.ai_declaration },
            rubric: { substance: r.substance ?? '', evidence: r.evidence ?? '',
                      integration: r.integration ?? '', presentation: r.presentation ?? '',
                      revision: r.revision ?? '' },
            // a course marks the members of the team who take it, not the whole team
            members: roster.filter(x => x.team_id === t.id && (x.courses || []).includes(course)).map(x => {
              const m = rows.find(y => y.roll === x.roll) || {};
              const n = (nets || []).find(y => y.team_id === t.id && y.roll === x.roll) || null;
              return { roll: x.roll, name: x.name, adjustment: m.adjustment ?? 0,
                       viva: m.viva ?? '', participation: m.participation ?? '', comment: m.comment || '',
                       net: n && m.substance != null ? n : null };
            })
          };
        });
      },
      async saveMarks(course, teamId, rubric, members, submit) {
        // checkMarks decides what a blank means; save_marks stores the nulls it
        // sends, because a range test against null is null and never fires.
        const v = checkMarks(rubric, members, submit);
        unwrap(await sb.rpc('save_marks', { p_course: course, p_team: teamId,
          p_rubric: v.rubric, p_members: v.members, p_submit: !!submit }));
        cache.dash = null;
      },
      async moderation() {
        return unwrap(await sb.from('moderation').select('*').order('spread', { ascending: false }));
      },
      // export_course_marks() (db/15): the office and the course's own teacher; every export is logged
      async exportMarks(course) {
        return unwrap(await sb.rpc('export_course_marks', { p_course: course }));
      },

      /* ---- Stage 3: the individual paths, the supervision log, the defence ---- */
      async individualsFor(course) {
        const ps = await this.pathsFor(course);
        if (!ps.length) return [];
        const rolls = ps.map(x => x.roll);
        const [roster, lm, ln, pm, pn, hs, sup, defs, exs, ch] = await Promise.all([
          soft(sb.from('roster').select('roll,name,team_id').in('roll', rolls), []),
          soft(sb.from('lens_marks').select('*').eq('course', course), []),
          soft(sb.from('lens_marks_net').select('*').eq('course', course), []),
          soft(sb.from('pc_marks').select('*').eq('course', course), []),
          soft(sb.from('pc_marks_net').select('*').eq('course', course), []),
          soft(sb.from('handins_current').select('*').in('roll', rolls).in('type_key', ['lens', 'pcproj']), []),
          soft(sb.from('supervision_log').select('*').eq('course', course), []),
          soft(sb.from('defences').select('*').in('roll', rolls), []),
          soft(sb.from('defence_exceptions').select('*').eq('course', course), []),
          soft(sb.from('course_choices').select('midterm').eq('course', course).maybeSingle(), null)
        ]);
        remember(roster);
        const closed = (await soft(sb.from('marking_closed').select('course').eq('course', course), [])).length > 0;
        const out = [];
        for (const x of ps) {
          const st = roster.find(r => r.roll === x.roll) || {};
          const row = { roll: x.roll, name: st.name, team_id: st.team_id, regime: x.regime, closed,
            handin: hs.filter(h => h.roll === x.roll && (x.regime === 'project' ? h.type_key === 'pcproj' : (h.type_key === 'lens' && h.course === course)))
                      .sort((a, b) => b.version - a.version).map(hand)[0] || null,
            lens: lm.find(m => m.roll === x.roll) || null, pc: pm.find(m => m.roll === x.roll) || null,
            net: (x.regime === 'project' ? pn : ln).find(m => m.roll === x.roll) || null };
          if (x.regime === 'project') {
            row.log = sup.filter(y => y.roll === x.roll);
            row.defence = defs.find(d => d.roll === x.roll) || null;
            row.exception = exs.find(e => e.roll === x.roll) || null;
            row.midterm = ch ? ch.midterm : null;
            row.supervision = (await soft(sb.rpc('supervision_status', { p_course: course, p_roll: x.roll }), []))[0] || null;
          }
          out.push(row);
        }
        return out.sort((a, b) => (a.regime + a.roll) < (b.regime + b.roll) ? -1 : 1);
      },
      async saveLensMark(course, roll, marks, submit) {
        // the same bounds save_lens_mark() applies, so the refusal is instant
        const m = {};
        if (marks.viva30 != null && marks.viva30 !== '') { const v = whole(marks.viva30);
          if (isNaN(v) || v < 0 || v > 30) throw err('The viva out of 30 runs from 0 to 30.'); m.viva30 = v; }
        else Object.assign(m, checkInts(marks, LENS_MAX, { viva: 'The viva' }));
        m.comment = (marks.comment || '').trim() || null;
        const r = unwrap(await sb.rpc('save_lens_mark', { p_course: course, p_roll: roll, p_marks: m, p_submit: !!submit }));
        cache.dash = null; return r;
      },
      async savePcProject(course, roll, project, comment, submit) {
        const n = whole(project); if (isNaN(n) || n < 0 || n > 30) throw err('The project runs from 0 to 30.');
        unwrap(await sb.rpc('save_pc_project', { p_course: course, p_roll: roll, p_project: n, p_comment: (comment || '').trim() || null, p_submit: !!submit }));
        cache.dash = null;
      },
      async savePcDefence(course, roll, scores, submit) {
        const v = checkInts(scores, ORAL_MAX, ORAL_LABEL); v.comment = (scores.comment || '').trim() || null;
        const t = unwrap(await sb.rpc('save_pc_defence', { p_course: course, p_roll: roll, p_scores: v, p_submit: !!submit }));
        cache.dash = null; return t;
      },
      async logSupervision(course, roll, sessionN, held, note) {
        unwrap(await sb.rpc('log_supervision', { p_course: course, p_roll: roll, p_session: sessionN, p_held: held, p_note: (note || '').trim() || null }));
      },
      async confirmSupervision(course, sessionN) { unwrap(await sb.rpc('confirm_supervision', { p_course: course, p_session: sessionN })); },
      async supervisionStatus(course, roll) { return (unwrap(await sb.rpc('supervision_status', { p_course: course, p_roll: roll })) || [])[0] || null; },
      async setMidterm(course, choice) { unwrap(await sb.rpc('set_midterm_choice', { p_course: course, p_choice: choice })); },
      async closeMarking(course, note) { unwrap(await sb.rpc('close_marking', { p_course: course, p_note: (note || '').trim() || null })); cache.dash = null; },
      async reopenMarking(course, reason) { unwrap(await sb.rpc('reopen_marking', { p_course: course, p_reason: reason })); cache.dash = null; },
      async setSetting(key, value) { unwrap(await sb.rpc('set_setting', { p_key: key, p_value: String(value == null ? '' : value) })); cache.dash = null; },
      async waivePenalty(kind, target, course, reason) {
        return unwrap(await sb.rpc('waive_penalty', { p_kind: kind, p_target: target, p_course: course || null, p_reason: reason }));
      },
      async withdrawWaiver(id) { unwrap(await sb.rpc('withdraw_waiver', { p_id: id })); },
      async waivers() { return await soft(sb.from('penalty_waivers').select('*').is('withdrawn_at', null).order('at', { ascending: false }), []); },
      async grantDefenceException(course, roll, reason) {
        unwrap(await sb.rpc('grant_defence_exception', { p_course: course, p_roll: roll, p_reason: reason }));
      },
      async setDefence(roll, chair, alumnus, when) {
        unwrap(await sb.rpc('set_defence', { p_roll: roll, p_chair: chair, p_alumnus: (alumnus || '').trim() || null,
          p_when: when || null, p_held_on: null }));
      },
      async projectStudents() {
        const ps = await soft(sb.from('student_courses').select('roll,course').eq('regime', 'project'), []);
        const rolls = [...new Set(ps.map(x => x.roll))];
        if (!rolls.length) return [];
        const [roster, defs, exs] = await Promise.all([
          soft(sb.from('roster').select('roll,name,team_id').in('roll', rolls), []),
          soft(sb.from('defences').select('*').in('roll', rolls), []),
          soft(sb.from('defence_exceptions').select('*').in('roll', rolls), [])
        ]);
        remember(roster);
        return rolls.sort().map(r => ({ roll: r, name: (roster.find(x => x.roll === r) || {}).name, team_id: (roster.find(x => x.roll === r) || {}).team_id,
          courses: ps.filter(x => x.roll === r).map(x => x.course).sort(),
          defence: defs.find(d => d.roll === r) || null, exceptions: exs.filter(e => e.roll === r) }));
      },
      /* ---- the project rules: the convener ---- */
      async decideProject(teamId, decision, note) { unwrap(await sb.rpc('decide_project', { p_team: teamId, p_decision: decision, p_note: (note || '').trim() || null })); },
      async setTeamName(name, teamId) { unwrap(await sb.rpc('set_team_name', { p_name: name, p_team: teamId || null })); },
      async sealPrediction(teamId, on) { unwrap(await sb.rpc('seal_prediction', { p_team: teamId, p_on: on || null })); },
      async openPrediction(teamId, on) { unwrap(await sb.rpc('open_prediction', { p_team: teamId, p_on: on || null })); },
      async setEthics(teamId, tier, status, on, note) {
        unwrap(await sb.rpc('set_ethics', { p_team: teamId, p_tier: tier == null ? null : +tier, p_status: status || null,
          p_on: on || null, p_note: (note || '').trim() || null }));
      },
      // the accept guard (db/16) refuses a field plan before the tier is cleared and the gate is open,
      // and a Folio without its client brief, handover page and AI declaration
      async acceptHandin(id, stateTo, note) {
        const { data } = await sb.auth.getSession();
        unwrap(await sb.from('handins').update({ state: stateTo, review_note: (note || '').trim() || null,
          reviewed_by: data && data.session ? data.session.user.id : null, reviewed_at: new Date().toISOString() }).eq('id', id));
      },
      async logWeeklyCheck(teamId, sessionN, answers, logLine) {
        unwrap(await sb.rpc('log_weekly_check', { p_team: teamId, p_session: sessionN, p_answers: answers, p_log: (logLine || '').trim() || null }));
      },
      async weeklyChecks() { return await soft(sb.from('convener_checks').select('*').order('at', { ascending: false }), []); },
      /* ---- 22 September, register BH: the sign-out sheet, form F2, the AI declaration, appeals, the Karachi Review (live side) ---- */
      async signouts(teamId) { const q = sb.from('signouts').select('*').order('at', { ascending: false }); return await soft(teamId ? q.eq('team_id', teamId) : q, []); },
      async fileSignout(teamId, rolls, where, grade, dueIso, phone) { return unwrap(await sb.rpc('file_signout', { p_team: teamId, p_rolls: rolls, p_where: where, p_grade: grade, p_due: dueIso, p_phone: (phone || '').trim() || null })); },
      async deskSignout(id, cardsSeen, numbersOk) { unwrap(await sb.rpc('desk_signout', { p_id: id, p_cards_seen: !!cardsSeen, p_numbers_ok: !!numbersOk })); },
      async reportBack(id) { unwrap(await sb.rpc('report_back', { p_id: id })); },
      async signBack(id, note) { unwrap(await sb.rpc('sign_back', { p_id: id, p_note: (note || '').trim() || null })); },
      async closeSignout(id, note) { unwrap(await sb.rpc('close_signout', { p_id: id, p_note: note })); },
      async incidents(teamId) { const q = sb.from('incidents').select('*').order('at', { ascending: false }); return await soft(teamId ? q.eq('team_id', teamId) : q, []); },
      async fileIncident(teamId, kind, happenedIso, location, present, hurt, authority, authorityWho, what, action, reportedTo, signoutId) {
        return unwrap(await sb.rpc('file_incident', { p_team: teamId, p_kind: kind, p_happened: happenedIso, p_location: location, p_present: present || [], p_hurt: !!hurt, p_authority: !!authority,
          p_authority_who: (authorityWho || '').trim() || null, p_what: what, p_action: (action || '').trim() || null, p_reported_to: (reportedTo || '').trim() || null, p_signout: signoutId || null })); },
      async signIncident(id) { unwrap(await sb.rpc('sign_incident', { p_id: id })); },
      async receiveIncident(id, siteClosed, note) { unwrap(await sb.rpc('receive_incident', { p_id: id, p_site_closed: !!siteClosed, p_note: (note || '').trim() || null })); },
      async reopenSite(id) { unwrap(await sb.rpc('reopen_site', { p_id: id })); },
      async closedSites() { return await soft(sb.rpc('closed_sites'), []); },
      async aiDeclaration(teamId) { const decl = (await soft(sb.from('ai_declarations').select('*').eq('team_id', teamId), []))[0] || null;
        const seen = await soft(sb.from('ai_seen').select('*').eq('team_id', teamId), []); return { decl, seen }; },
      async signAiDeclaration(tools, teamWork, toolWrong, confirmed, signedName) { const r = unwrap(await sb.rpc('sign_ai_declaration', { p_tools: tools, p_team_work: teamWork, p_tool_wrong: toolWrong, p_confirmed: !!confirmed, p_signed_name: signedName })); cache.dash = null; return r; },
      async seeAiDeclaration(teamId, course) { unwrap(await sb.rpc('see_ai_declaration', { p_team: teamId, p_course: course })); },
      async appeals(teamId) { const q = sb.from('appeals').select('*').order('at', { ascending: false }); return await soft(teamId ? q.eq('team_id', teamId) : q, []); },
      async fileAppeal(rulingOn, ruling, grounds) { return unwrap(await sb.rpc('file_appeal', { p_ruling_on: rulingOn, p_ruling: ruling, p_grounds: grounds })); },
      async answerAppeal(id, note) { unwrap(await sb.rpc('answer_appeal', { p_id: id, p_note: note })); },
      async decideAppeal(id, outcome, decision) { unwrap(await sb.rpc('decide_appeal', { p_id: id, p_outcome: outcome, p_decision: decision })); },
      async staffList() { return (await soft(sb.from('profiles').select('user_id,name,role,blocks').in('role', ['teacher', 'convener', 'office']).order('name'), [])).map(p => ({ id: p.user_id, name: p.name, role: p.role, blocks: p.blocks || [] })); },
      async circuits() { return await soft(sb.from('review_circuits').select('*').order('id'), []); },
      async setCircuit(id, name, judge, alumnus, teams) { unwrap(await sb.rpc('set_circuit', { p_id: Number(id), p_name: name, p_judge: judge || null, p_alumnus: (alumnus || '').trim() || null, p_teams: teams || [] })); },
      async reviewScores(teamId) { const q = sb.from('review_scores').select('*'); return await soft(teamId ? q.eq('team_id', teamId) : q, []); },
      async scoreReview(teamId, works, claim, answered, outside, boxes, sentence) { unwrap(await sb.rpc('score_review', { p_team: teamId, p_works: Number(works), p_claim: Number(claim), p_answered: Number(answered), p_outside: Number(outside), p_boxes: boxes || {}, p_sentence: (sentence || '').trim() || null })); },
      async presence() { return await soft(sb.from('review_presence').select('*'), []); },
      async markPresent(teamId, present) { unwrap(await sb.rpc('mark_present', { p_team: teamId, p_present: !!present })); },
      /* ---- 22 September, register BG: the scope, the draft review, the moderation record, the hours (live side) ---- */
      async teamScope(teamId) { return (await soft(sb.from('team_scope').select('*').eq('team_id', teamId), []))[0] || null; },
      async agreeScope(teamId, scope, client) { unwrap(await sb.rpc('agree_scope', { p_team: teamId, p_scope: scope, p_client: (client || '').trim() || null })); },
      async draftReviews(teamId) { const q = sb.from('draft_reviews').select('*'); return await soft(teamId ? q.eq('team_id', teamId) : q, []); },
      async reviewDraft(teamId, course, note) { unwrap(await sb.rpc('review_draft', { p_team: teamId, p_course: course, p_note: (note || '').trim() || null })); },
      async moderationLog(block) { const q = sb.from('moderation_log').select('*').order('at', { ascending: false }); return await soft(block ? q.eq('block', block) : q, []); },
      async logModeration(block, teamId, kind, course, spread, note, outcome) {
        return unwrap(await sb.rpc('log_moderation', { p_block: block, p_team: teamId || null, p_kind: kind, p_course: (course || '').trim() || null,
          p_spread: spread === '' || spread == null ? null : Number(spread), p_note: (note || '').trim() || null, p_outcome: (outcome || '').trim() || null })); },
      async hoursLog() { return await soft(sb.from('convener_hours').select('*').order('on_date', { ascending: false }), []); },
      async logHours(on, hours, what) { return unwrap(await sb.rpc('log_hours', { p_on: on || null, p_hours: Number(hours), p_what: what })); },
      async deleteHours(id) { unwrap(await sb.rpc('delete_hours', { p_id: id })); },
      /* ---- 22 September, register BF: notices, the merge page, the trackers (live side) ---- */
      async notices() { return await soft(sb.from('notices').select('*').order('posted_at', { ascending: false }), []); },
      async postNotice(block, body, until) { return unwrap(await sb.rpc('post_notice', { p_block: block, p_body: body, p_until: until || null })); },
      async withdrawNotice(id) { unwrap(await sb.rpc('withdraw_notice', { p_id: id })); },
      async folioSections(block) { return await soft(sb.from('folio_sections').select('*').eq('block', block).order('n'), []); },
      async setFolioSections(block, sections) { return unwrap(await sb.rpc('set_folio_sections', { p_block: block, p_sections: sections })); },
      async letters() { return await soft(sb.from('letters').select('*').order('wave').order('body_name'), []); },
      async saveLetter(row) { return unwrap(await sb.rpc('save_letter', { p: row })); },
      async guests() { return await soft(sb.from('guests').select('*').order('block').order('on_date'), []); },
      async saveGuest(row) { return unwrap(await sb.rpc('save_guest', { p: row })); },
      async visits() { return await soft(sb.from('visits').select('*').order('block').order('on_date'), []); },
      async saveVisit(row) { return unwrap(await sb.rpc('save_visit', { p: row })); },
      async alumni() { return await soft(sb.from('alumni').select('*').order('pair_no').order('name'), []); },
      async saveAlumnus(row) { return unwrap(await sb.rpc('save_alumnus', { p: row })); },
      async deleteTracker(kind, id) { unwrap(await sb.rpc('delete_tracker', { p_kind: kind, p_id: id })); },
      async seedLetters() { return unwrap(await sb.rpc('seed_letters')); },
      async board() { return await soft(sb.from('convener_board').select('*').order('block').order('team_id'), []); },
      async folioChecklist(teamId) {
        const r = (await soft(sb.from('folio_checklist').select('*').eq('team_id', teamId), []))[0] || {};
        return { folio: !!r.folio, brief: !!r.client_brief, handover: !!r.handover_page, ai: !!r.ai_declaration };
      },
      async myMarksMap() { return await soft(sb.rpc('my_marks_map'), []); },

      /* ---- the helper (register AX) --------------------------------
         ONE call: helper_state() does every read and every ordering inside
         the database, for the caller and nobody else. */
      async helperState() { return unwrap(await sb.rpc('helper_state')); },
      async helperAiState() {
        return await soft(sb.rpc('helper_ai_state'), { on: false, cap: 0, used: 0, left: 0, max_words: 120 });
      },
      /* The AI half, built and SHIPPED OFF (register AX.1, AX.4).  The key is
         never in app/: the question goes to the Supabase Edge Function
         db/edge/helper, which holds it.  What leaves the browser is the
         question and the reader's ROLE — never a name, a roll number, a team
         id or a mark.  helper_ai_begin() refuses outright while the setting
         is off or the day's cap is spent, so this cannot be reached by
         accident.  UNTESTED: nothing has been deployed. */
      async helperAsk(question) {
        const open = unwrap(await sb.rpc('helper_ai_begin', { p_question: question }));
        try {
          const r = await sb.functions.invoke('helper', { body: {
            id: open.id, role: open.role, question: open.question, max_words: open.max_words } });
          if (r.error) throw r.error;
          const a = (r.data && r.data.answer) || null;
          await sb.rpc('helper_ai_done', { p_id: open.id, p_answered: !!a,
                                           p_reason: (r.data && r.data.reason) || null });
          if (!a) throw err((r.data && r.data.reason) || 'The model would not answer that one. Ask your convener.');
          return { answer: a, left: open.left };
        } catch (e) {
          try { await sb.rpc('helper_ai_done', { p_id: open.id, p_answered: false,
                  p_reason: String((e && e.message) || e).slice(0, 200) }); } catch (x) { /* the log is not worth an error */ }
          throw e.friendly ? e : friendly(e);
        }
      },
      async auditTrail(n) { return await soft(sb.from('audit').select('at,action,detail').order('at', { ascending: false }).limit(n || 50), []); },

      /* ---- the dashboards ------------------------------------------ */
      async gatesByTeam() {
        return await soft(sb.from('gates_by_team').select('*').order('team_id').order('sort'), []);
      },
      // Everything the dashboards need, in one pass.  The gates screen used to
      // download every hand-in in the University and search it 172 × 7 times;
      // these are seven views that count it in the database.  Any of them may
      // be refused for this role, and a refusal is an empty list, not an error.
      async dash() {
        if (cache.dash) return cache.dash;
        cache.dash = (async () => {
          let role = 'student';
          try { const p = await this.session(); role = (p && p.role) || 'student'; } catch (e) {}
          const [funnel, blockStrip, claimCurve, submissions, histogram, mod, marking, gauges] =
            await Promise.all([
              soft(sb.from('funnel').select('*').order('block'), []),
              soft(sb.from('gates_by_block').select('*').order('block').order('sort'), []),
              soft(sb.from('claim_curve').select('*').order('day'), []),
              soft(sb.from('submissions_by_day').select('*').order('day'), []),
              soft(sb.from('mark_histogram').select('*').order('course').order('mark'), []),
              soft(sb.from('moderation_summary').select('*').maybeSingle(), null),
              this.myMarkingCourses().catch(() => []),
              // office_gauges() raises for everybody else, and a raise here
              // would take the whole dashboard down with it
              role === 'office' ? soft(sb.rpc('office_gauges'), null) : Promise.resolve(null)
            ]);
          return {
            funnel, blockStrip, claimCurve, submissions, histogram,
            // the summary is one aggregate row over marks_full, so it comes
            // back full of nulls rather than empty when nothing is marked yet
            moderation: (mod && mod.markings) ? mod : null,
            marking, gauges
          };
        })();
        return cache.dash;
      },

      nameOf(roll) { return (roll && names.byRoll[roll]) || roll || ''; },
      fmt: { kDay, kTime, addDays }
    };
  }

  // 'live' needs a real project URL and key.  A placeholder left in config.js
  // would make createClient() throw and leave the page on "Loading…", so an
  // unfilled live config falls back to demo mode and says so.
  const liveReady = CFG.MODE === 'live'
    && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(CFG.SUPABASE_URL || '')
    && (CFG.SUPABASE_ANON_KEY || '').length > 20 && !/HERE/.test(CFG.SUPABASE_ANON_KEY);
  window.API = liveReady ? LiveAPI() : DemoAPI();
  // the marking screen has been calling it both names since the teacher views
  // were added; one implementation, so the two can never drift apart
  window.API.marksCourses = window.API.myMarkingCourses.bind(window.API);
  window.API.isDemo = window.API.mode === 'demo';
  window.API.misconfigured = CFG.MODE === 'live' && !liveReady;
  if (window.API.misconfigured)
    console.error('config.js: MODE is "live" but SUPABASE_URL / SUPABASE_ANON_KEY are not filled in. Running in demo mode instead.');
})();
