# Greenwich Works portal — handover for the developers · 22 September 2026

This folder is the portal's front end, built and ready to publish. This note says what the portal is, what is
already done, what you have to do (about ten minutes), and how everything fits together for the day something
needs changing. Read it once, top to bottom.

---

## 1. What the portal is

Greenwich Works is Greenwich University's Fall 2026–27 programme: every undergraduate is in a team of about
five that takes one real problem in Karachi, builds something real and writes it up once (the Folio), and every
course the team shares marks that one piece of work from its own angle. The portal is where that runs:

- **Students** (1,109, in 198 teams across 19 Build Blocks) claim an account with a printed slip, see what they
  owe and when, hand in files, book sessions with the Pro Vice Chancellor, choose a project, sign out for
  fieldwork, report incidents, sign the AI declaration, and read their marks as courses submit them.
- **Teachers** enter marks on a marking card per team, run viva day, see the Karachi Review's advisory score.
- **Conveners** (16, holding the blocks) approve projects, clear ethics, accept field plans, keep the weekly
  check, moderate, write notices and the Folio's merge page, and tick teams at their table on Review day.
- **The office** (the front desk: Ashir Azim, Shanzeh Mughal, Michael) keeps the register, the gates, the desk's
  sign-out sheet, the trackers, the settings, and closes marking.
- **Rashid Bhai** is the helper on every screen: it tells each reader what to do next from what they have
  actually filed, answers typed questions from the programme's rules, and hands them to a person by name when it
  cannot help. It has an optional language-model half, deployed and switched off (section 6).

Everything a rule decides is decided **in the database**, not in the browser: who may write what, when a
hand-in is late, whether a field plan can be accepted, who may see a mark. The front end only draws.

## 2. How it is built

| Part | What | Where |
|---|---|---|
| Front end | Static files: HTML, CSS, plain JavaScript, no build step, no framework | this folder |
| Database, auth, storage | Supabase project `greenwich-works`, ref `nqkchzmhpzzmakqmmmpq`, region ap-south-1 (Mumbai) | supabase.com/dashboard/project/nqkchzmhpzzmakqmmmpq |
| The helper's AI half | One Supabase Edge Function, `helper`, holding the Anthropic key | the same project, Edge Functions |
| Source of everything | `14 Context for Claude/build/portal/` on the Chair's Mac (app/, db/, harness/, the runbook) | not in this folder — this folder is a build output |

The browser talks to Supabase directly with the **anon** (public) key in `config.js`. Row-level security and
`security definer` functions in the database are what keep a student from reading another team's files; the key
being public is by design. **The `service_role` key is never used by the portal and must never go into
`config.js`.**

## 3. What is already done (22 September 2026)

1. **The database is deployed.** Every SQL step of the runbook (patches, the security gate, the seed of 1,109
   students and 198 teams, the marking rules, the project rules, the helper, the September fixes and the four
   later additions) is on the live project and was compared object by object with the tested copy: 371
   objects, identical. Counts on the project: 1,109 students · 198 teams · 19 blocks · 172 projects ·
   311 courses · 121 staff accounts · 396 bookings.
2. **Auth is configured**: e-mail sign-in on, e-mail confirmation off (students sign in on minted addresses
   that receive no mail; sign-up is gated by the claim code inside the database, not by Supabase).
3. **Storage**: one private bucket, `handins`, 60 MB per file, the allowed types listed on the bucket.
4. **The Edge Function `helper` is deployed** (version 1, JWT verification on) with the Anthropic key in the
   secret store. It is switched off in the database (`helper_ai = off`) and the portal is complete without it.
5. **The front end is built** — this folder — in live mode, pointing at the project.

## 4. What you have to do — publish the front end (about ten minutes)

1. Drag **this whole folder** onto https://app.netlify.com/drop (or use any static host: it is plain files,
   `index.html` at the root, nothing to build, no environment variables).
2. Netlify → Site configuration → Site details → **Change site name** to `greenwich-works`. The address is then
   https://greenwich-works.netlify.app.
3. Open it. You should see the sign-in page with the Karachi skyline behind the card. If it says "Loading…" or
   shows a yellow banner about demo mode, `config.js` is wrong (section 5).
4. Tell the Chair the address. He sets the staff first password and does the one-slip smoke test (section 8).

To publish a change later: get a fresh folder from the builder (it is generated from `build/portal/app/`), drag
it onto Netlify → Deploys → drag and drop. The URL does not change. There is nothing to clear or migrate: the
front end holds no state beyond a few browser conveniences (a remembered tab, whether the tour was seen).

## 5. `config.js` — the one file that binds the front end to the project

```
MODE: 'live'                         'live' = Supabase.  'demo' = the in-browser cohort, no backend at all.
SUPABASE_URL: 'https://nqkchzmhpzzmakqmmmpq.supabase.co'
SUPABASE_ANON_KEY: 'eyJ…'            the anon key from Project Settings → API. Never the service_role key.
```

Also in it: the term label, the front desk line shown at the foot of every page, the notice on the sign-in page,
and the list of documents linked from the student home (`docs/`, in this folder).

**Demo mode** is real and useful: with `MODE: 'demo'` the entire portal runs in the browser on a made-up cohort
of 70 students and 15 teams (`demo-data.js`), every screen and every rule, with the claim code `DEMO`. It is how
the portal is shown to people and how it is tested. To put a demo copy online, copy this folder, change the one
word, drag it to a second Netlify site. `demo-data.js` is generated (`app/make_demo.py`); never hand-edit it.

## 6. Rashid Bhai's AI half — deployed, off, and how it is switched

- The helper answers from a fixed answer set (`helper_answers.js`, 60 answers, each naming the decision-register
  section it comes from) plus the explainer's 58 terms (`explain.js`), with a matcher in `app.js`. When nothing
  matches it says so and names the person to ask. That half needs no network beyond the database.
- With the setting `helper_ai` at `on`, an unmatched question may go to the Edge Function, which sends **the
  question, the reader's role (one word) and the programme's rules text** to Anthropic's API and shows the answer
  under "Not an official answer — check with your convener." Never a name, roll number, team, mark or hand-in.
  Per-person daily cap (`helper_ai_daily_cap`, start at 2), answer length cap (`helper_ai_max_words`), and a log
  the office can read that holds the question, the role and whether it was answered.
- **Switch on:** in the portal as the office → Settings → `helper_ai` → `on` → Save (or in the SQL editor
  `select set_setting('helper_ai', 'on');`). **Switch off:** the same row → `off`. Takes effect on the next
  question; no deploy.
- The function's source, its README (five steps, costs per model, what leaves the University) and the generated
  rules text are in `build/portal/db/edge/helper/` on the Chair's Mac; the deployable copy is
  `build/portal/supabase/functions/helper/`. Redeploy with `supabase functions deploy helper` from
  `build/portal/` after `python3 db/edge/helper/gen_grounding.py`, whenever the answer set changes.
- Set a hard monthly spend limit in the Anthropic console before it is switched on; the daily cap is the only
  thing that stops one person spending the budget.

## 7. The database — how it is run day to day

- **Every rule is a function.** Writes go through `security definer` functions (`submit_handin`, `save_marks`,
  `claim_project`, `set_ethics`, `file_signout`, `sign_ai_declaration`, `score_review`, …) that check the caller
  and write an audit row. Tables grant `SELECT` only, behind row-level policies. There is no path from the
  browser that writes a table directly.
- **Settings** (`gw_settings`, changed only by `set_setting()`, office only): the dates the rules turn on
  (`menu_from`, `full_from`, `choice_from`, `fieldwork_gate_date`), the fieldwork gate (`fieldwork_gate_open`,
  stays `no` until the duty phone and the sign-out sheet exist), the late-week rule, when students see marks,
  the upload limit, the helper's three switches, `review_open` (yes only on 15 December while the judging pairs
  score). The office edits them on the Settings screen.
- **Accounts.** Students: a claim slip (roll number + one-time code, printed, confidential). The code is verified
  inside the database against a peppered hash; eight wrong tries in an hour lock the roll for an hour;
  `reset_claim('ROLL')` issues a fresh code and voids the old slip. Staff: 121 accounts on
  `<handle>@works.greenwich.edu.pk`, one first password set by the Chair (`gw_set_first_password`), which
  opens nothing until the person changes it on first sign-in. The office can reissue codes and reset accounts
  from the Everyone screen.
- **Files** go to the private bucket under `<team or roll>/<hand-in>/…`; the database checks the path is the
  caller's own and that the file finished uploading before it records the hand-in. Every re-upload is a new
  version; nothing is deleted.
- **Re-seeding or changing the schema** is done only by the builder's files in `build/portal/db/`, in the order
  of `DEPLOY-RUNBOOK.md`, and the same order is run against a local PostgreSQL first with 913 assertions
  (`db/run_local.sh`, `db/run_local_tests.sh`). Do not paste ad-hoc SQL into the live project.
- **Backups**: Supabase's daily backups on the free tier are a week; the office exports the register as CSV
  from the portal. The project moves to Pro in November (storage 100 GB, longer backups).
- The project **pauses itself after a week without traffic** on the free tier. If the site says "Loading…" and
  the dashboard shows the project paused, press Restore project and wait a few minutes.

## 8. What is left, and whose it is

| Step | Who | What |
|---|---|---|
| The staff first password | the Chair | `select gw_set_first_password('…');` typed in the SQL editor; returns 98 |
| Publish the front end | you | section 4 |
| The smoke test | the office | one claim slip on the site: First time here → roll → code → password → the home page; then `select reset_claim('ROLL');` and give that student the fresh code |
| Open student accounts | when the Chair says | hand out the claim slips (they are with Ashir to print) |
| Switch Rashid Bhai's AI half on | the Chair | section 6, after a spend limit |
| Later | the builder | an installable, offline shell (needs the live address), Urdu safety lines, "since your last visit" |

## 9. Checks the builder ran before handing this over

- SQL: 913 assertions across the whole deploy order on a clean local database, every rule with a test that
  tries to break it.
- The portal harness: 167 steps through every screen of every role in demo mode, no JavaScript errors.
- Wording and framing sweeps across the papers and the portal text: clean.
- The live schema compared with the tested one after the deploy: identical.

## 10. What is in this folder

```
index.html            the one page; everything is drawn by app.js
app.js                the screens (about 3,900 lines, plain JS, sections headed by register letters)
adapter.js            every call to the database, with a demo twin for MODE: 'demo'
app.css  signin.css   the house style; phone first; a bottom tab bar under 900 px
guide.js explain.js   the programme's rules and the explainer's terms (content only)
helper_answers.js     Rashid Bhai's answer set (content only)
demo-data.js          the made-up cohort for demo mode — generated, never edited by hand
bg.js  assets/        the sign-in scene, the logos and fonts
config.js             MODE, the project's URL and anon key, the front desk line
docs/                 the handbooks and rubrics students open from their home page (PDF)
HANDOVER.md           this note
```

**Who to ask.** The front desk: Shanzeh Mughal, ground floor, 021-111-202-303. The programme: Dr Naveed Ahmed
Mughal, Pro Vice Chancellor and Chair of Greenwich Works. The build: the record of every decision is
`14 Context for Claude/records/build-block-decisions.md` on the Chair's Mac (sections AE onward are current),
and the deploy is `14 Context for Claude/build/portal/DEPLOY-RUNBOOK.md`.
