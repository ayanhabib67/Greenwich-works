/* Greenwich Works — the portal.  The helper's answer set (register AX).
   -----------------------------------------------------------------------
   Content only.  app.js matches a typed question against these and shows the
   best one, then up to three "or did you mean" links.  Nothing here is
   invented: every answer is true on 21 September 2026 and `source` names the
   section of `records/build-block-decisions.md` it comes from.  Where the
   register is silent the answer is the ESCALATION — who to ask — never a guess.

   A course studied as a project is NEVER explained by how few students
   registered (register AG.5): checks/framing.py enforces it.

     GW_HELPER_ANSWERS  [{ id, ask, role, answer, goes_to, source }]
       ask      phrasings and keywords, lower case, no punctuation needed
       role     who may be shown it: student · teacher · convener · office
       answer   two to five plain sentences
       goes_to  the screen where the thing is done, or null
       source   the register section, shown small at the end of the answer

     GW_HELPER_TERMS    [{ key, ask, role }]
       A single term — "what is a lens note" — is NOT answered again here.
       It points at app/explain.js, which already holds 55 of them, and the
       helper shows that entry.  One copy of every definition, not two.
   ----------------------------------------------------------------------- */

(function () {
  'use strict';
  var GW_ALL = ['student', 'teacher', 'convener', 'office'];

window.GW_HELPER_ANSWERS = [

  /* ================================================== the hand-ins and dates */
  { id: 'folio-due', role: ['student'],
    ask: ['when is my folio due', 'folio deadline', 'when do i hand in the folio', 'folio due date',
          'last day to submit', 'submission date', 'deadline'],
    answer: "The Folio is due on Saturday 12 December, the end of Session 13, and it is uploaded here. "
      + "It is not accepted without the two-page client brief, the handover page and the AI declaration, which are filed beside it. "
      + "Every course marking it takes five of its twenty off for each week it is late, counted from midnight in Karachi on the due day. "
      + "Nothing at all is accepted after the Karachi Review on Tuesday 15 December.",
    goes_to: '#handins', source: 'Y.2 · AD.2 · AI.12' },

  { id: 'folio-what', role: ['student'],
    ask: ['what goes in the folio', 'what do we write', 'how long is the folio', 'how many words',
          'word count', 'what does the folio contain', 'folio format'],
    answer: "About 3,000 words for each member of the team, plus or minus ten per cent, plus whatever the project actually made — data, drawings, code, a campaign, a working product. "
      + "On top of that it carries a two-page brief written for the body your project reports to, a handover page for next year's team, and the AI declaration. "
      + "Each section is named, so every course knows whose work it is marking. "
      + "Up to eight courses mark the same file, each out of twenty, each from its own angle.",
    goes_to: '#handins', source: 'E · AI.12 · AD.2' },

  { id: 'hand-in-late', role: ['student'],
    ask: ['what happens if i hand in late', 'late penalty', 'i am late', 'missed the deadline',
          'can i hand in after the due date', 'how much do i lose for being late'],
    answer: "Five of the twenty come off for every week started after the due day, in every course marking that Folio, and five of the thirty for the project of a course you study as a project. "
      + "It is counted from midnight in Karachi on the due day, off the portal's own timestamp, not off anyone's memory. "
      + "Your viva is untouched by it. "
      + "Nothing is accepted after 15 December; a convener or the office may waive a penalty, with a written reason, and you ask your convener for that.",
    goes_to: '#handins', source: 'AD.2 · AG.4' },

  { id: 'what-is-due-now', role: ['student'],
    ask: ['what do i do now', 'what is due', 'what is next', 'what should i be doing', 'am i behind',
          'what do i owe', 'nothing to do'],
    answer: "Next for you, at the top of this panel, is the answer: it is built from what your team has actually filed, in the order things fall due. "
      + "The full list with the dates is on Hand-ins, and This week and next on your home screen shows the same thing against the calendar. "
      + "If Next for you is empty, nothing is due — Rashid Bhai never invents a task to fill the space.",
    goes_to: '#handins', source: 'Y.2 · AX.2' },

  /* ================================================== the project */
  { id: 'choose-project', role: ['student'],
    ask: ['when do we choose our project', 'how do we pick a project', 'project choice', 'when is the choice',
          'can we choose now', 'session 6', 'project menu'],
    answer: "At Session 4, from 28 September, you see the menu: each project's title, its problem in one line and who it is for. Note the three you like; nobody chooses in the room. "
      + "At Session 5, from 5 October, the full projects reach you with the block brief. "
      + "At Session 6, from 12 October, your team makes its final choice, names itself and seals its prediction with your convener, and the ethics sheet is answered in class straight after. "
      + "The portal will not take a choice before that day.",
    goes_to: '#team', source: 'AS.1 · AS.2' },

  { id: 'two-teams', role: GW_ALL,
    ask: ['can two teams take the same project', 'is this project taken', 'somebody else took our project',
          'two teams one project', 'project full', 'can we share a project'],
    answer: "Two teams may take one project, and only on different sites or areas — a different neighbourhood, sample, sector or site. "
      + "The portal refuses a third team outright, and refuses a site another team on that project already holds. "
      + "That is why you note three at Session 4: if your first is full, take the second. "
      + "Your convener approves or returns every choice, and an approved choice is locked until they reopen it.",
    goes_to: '#team', source: 'AI.3 · AI.4' },

  { id: 'project-returned', role: ['student'],
    ask: ['our choice was returned', 'convener sent it back', 'why was our project returned',
          'choice returned', 'not approved'],
    answer: "A returned choice means your convener has sent it back with a reason, which you can read on the My team screen. "
      + "Until a choice is approved your team has no project: it cannot seal a prediction and it cannot start collecting anything. "
      + "Read the reason, choose again — often it is the site rather than the project — and ask your convener if the reason is not clear.",
    goes_to: '#team', source: 'AI.3 · AS.2' },

  { id: 'prediction', role: ['student', 'convener'],
    ask: ['what is the sealed prediction for', 'do we get marks for the prediction', 'when is it opened',
          'sealed envelope', 'who opens the prediction'],
    answer: "At Session 6, before any data, the team writes what it expects to find, signs it and seals it with its convener. "
      + "The convener keeps the envelope and opens it at the team's first viva, then passes a copy to the team's other teachers before their vivas. "
      + "It carries no marks at all; it is there so you can see what you learned. "
      + "The portal records only that it was sealed, and later opened — never what it says.",
    goes_to: '#team', source: 'AI.11 · AO.1' },

  { id: 'venture-money', role: ['student', 'convener'],
    ask: ['who pays for our project', 'money', 'funding', 'can we spend', 'we are selling something',
          'takings', 'rs 25000', 'venture money', 'budget'],
    answer: "A venture team gets Rs 25,000 from the University, and every rupee a venture takes goes into a University account held by Finance — refunds come from the same place, not from a student's pocket. "
      + "In a client project the client pays or there is no spend: any paid activity is optional and client-funded. "
      + "How the Rs 25,000 is drawn is published by the Office of the Provost before Session 8. "
      + "Do not commit your own money; ask your convener first.",
    goes_to: null, source: 'AH.8 · AI.6 · AI.7' },

  /* ================================================== ethics and fieldwork */
  { id: 'ethics-when', role: ['student'],
    ask: ['when is the ethics sheet', 'ethics screening', 'ten questions', 'ethics deadline',
          'do we need ethics approval', 'who signs the ethics sheet'],
    answer: "The ten-question screening sheet is answered in class at Session 6, straight after your team's final choice of project, and countersigned by your convener; you upload the signed scan here by Saturday 17 October. "
      + "Your convener sets the tier from it: 1 self-certify, 2 the convener approves, 3 the full ethics panel. "
      + "Nobody collects a word of data, and nobody goes anywhere, before the tier is cleared.",
    goes_to: '#handins', source: 'AS.2 · AP.2' },

  { id: 'tier-three', role: ['student', 'convener'],
    ask: ['we are tier 3', 'ethics panel', 'how long does the panel take', 'tier three',
          'panel decision', 'when does the panel sit'],
    answer: "A Tier 3 project goes to the full ethics panel, which sits every week from 6 October and decides within a week: cleared, cleared with conditions, or not cleared. "
      + "Your convener files your team with the panel; the office records the decision. "
      + "Nineteen projects are expected to need it, and they were written knowing that. "
      + "Do not begin collecting while you wait.",
    goes_to: '#team', source: 'AP.2 · AR.2' },

  { id: 'fieldwork-gate', role: GW_ALL,
    ask: ['when can we go out', 'fieldwork gate', 'can we leave campus', 'field visit',
          'when does fieldwork start', 'are we allowed outside'],
    answer: "The gate is Monday 5 October at the earliest, and only if the Greenwich Works duty phone and the sign-out sheet exist by then — the office opens it in the portal. "
      + "No team leaves campus before both exist, whatever its ethics tier. "
      + "On top of that your tier must be cleared and your field plan, form F1, signed by your convener. "
      + "Until then the work is done from published sources.",
    goes_to: '#handins', source: 'AO.3 · X.3' },

  { id: 'field-rules', role: ['student'],
    ask: ['fieldwork rules', 'can i go alone', 'is this area safe', 'what time can we go',
          'area grade', 'red area', 'safety rules'],
    answer: "Never alone — pairs at least, threes in an amber area; daylight only, finished by 6 pm in November and December; check out and check back in. "
      + "Carry your ID card and the authorisation letter, keep phones, laptops, cameras and cash out of sight, stay in public and semi-public places, and never confront, argue or photograph a face. "
      + "Any student may abort a visit at any moment and never has to justify it — a convener who questions that has broken the rule, not the student. "
      + "Where you and your convener disagree on an area grade, the higher grade applies.",
    goes_to: null, source: 'X.3' },

  { id: 'hurt-fieldwork', role: GW_ALL,
    ask: ['who pays if i am hurt', 'insurance', 'injured on fieldwork', 'accident', 'hospital',
          'am i covered', 'what if something happens to me', 'emergency'],
    answer: "Care first, and never delay treatment over the question of who pays. Ring 1122 first, then the Greenwich Works duty number; police 15, Edhi 115, Chhipa 1020. Tell your convener the same day, even when nothing came of it. "
      + "What the University will meet has not been published: the register records that there is no insurance product in this context and that the substitutes — a welfare-fund ceiling and a standing hospital arrangement — are still being signed. "
      + "So the honest answer is that nobody here can tell you who pays, and you must not let that hold up treatment. "
      + "Ask your convener, or the front desk, and they escalate it the same day.",
    goes_to: null, source: 'X.3 · AA (G9) · AE.39' },

  /* ================================================== the marks */
  { id: 'marks-scheme', role: GW_ALL,
    ask: ['how am i marked', 'marks', 'out of 100', 'marking scheme', 'how many marks',
          'what is the project 30', 'grading'],
    answer: "Every course is out of 100 as project 30, mid-term 30 and final 40. "
      + "In an ordinary course the project 30 is your team's Folio out of 20 — moved by up to three either way on your own viva and the charter — plus your own viva out of 10. "
      + "The mid-term and the final are unchanged, set and marked by the course teacher, and they stay in the University's own system. "
      + "The three quizzes at Sessions 3, 6 and 11 continue as practice and carry no marks.",
    goes_to: null, source: 'AG.1 · AG.2' },

  { id: 'marks-when', role: ['student'],
    ask: ['when do i see my marks', 'where are my marks', 'my marks are not showing',
          'when are results', 'has my course marked me'],
    answer: "Each course's project 30 appears on your courses map, on the home screen, as soon as that course's teacher submits it — a draft they have not submitted is not shown. "
      + "Once the office closes marking for a course, nothing in it can change. "
      + "Your mid-term and your final are not here: they stay in the University's own examination system. "
      + "If a mark looks wrong, the course teacher is the only person who can change it — nobody above them can.",
    goes_to: '#home', source: 'AG.1 · AV.3' },

  { id: 'why-no-mark', role: ['student'],
    ask: ['why does my course not mark my team', 'my course is not marking the folio',
          'why do i have a lens note', 'this course is not on my folio', 'why am i writing something separate'],
    answer: "At most eight courses mark one team's Folio. A course outside those eight sets you a lens note instead: an individual piece of about 3,000 words on the same project from that course's angle, same rubric, same twenty, plus your viva ten. "
      + "You never write more than two; from a third such course on, that course sets no written piece and marks your viva out of 30 instead. "
      + "A course you study as a project marks only your own project and never the team's Folio.",
    goes_to: '#home', source: 'AG.3 · AE.51 · AL.4' },

  { id: 'midterm', role: ['student'],
    ask: ['what is my mid term', 'midterm', 'mid-term exam', 'is there a mid term',
          'when is the mid term', 'mid term for a project course'],
    answer: "The mid-term is 30 of the 100 in every course, unchanged, set and marked by your course teacher in mid-term week, 26–31 October, and entered in the University's own system rather than here. "
      + "In a course you study as a project the teacher chooses between a written paper in mid-term week and your Session 8 plan with the first 1,500 words, and states which in the course outline. "
      + "Your courses map shows the choice once your teacher has recorded it.",
    goes_to: '#home', source: 'AG.1 · AG.4' },

  { id: 'viva', role: ['student'],
    ask: ['what is the viva', 'how long is the viva', 'when is the viva', 'viva marks',
          'do i have to explain my work'],
    answer: "Three minutes, alone, with each course teacher, in that course's Session 14 class, 14–19 December. It is worth 10 of the project 30 and it is yours alone. "
      + "Work you cannot explain is not credited to you, which is what makes a team mark fair. "
      + "Your convener opens your team's sealed prediction at your first viva. "
      + "A section above thirty students may spread its vivas across Sessions 13 and 14, or Tuesday 8 December; three minutes is never shortened.",
    goes_to: null, source: 'AG.2 · AD.2 · AO.1' },

  { id: 'ai-declaration', role: ['student'],
    ask: ['can i use ai', 'chatgpt', 'ai declaration', 'is ai allowed', 'do i have to say i used ai'],
    answer: "You file an AI declaration with the Folio saying what tools you used and what you checked; it carries no marks and the Folio is not accepted without it. "
      + "Using these tools is declared rather than banned — what gets caught is not reading what they gave you, and that is caught at the viva, where you have three minutes to explain your own work. "
      + "Anything you cannot explain is not credited to you.",
    goes_to: '#handins', source: 'H · Y.2 · AG.2' },

  { id: 'plagiarism', role: GW_ALL,
    ask: ['plagiarism', 'someone copied', 'copied work', 'misconduct', 'one member cheated'],
    answer: "Only the author is penalised. The section is taken out of the file, its author referred under the University's existing misconduct rule, the team mark recalculated on what remains, and the other members told what happened. "
      + "This works because every section of the Folio is named. "
      + "Report it to your convener, who takes it from there.",
    goes_to: null, source: 'AA (G11)' },

  /* ================================================== courses studied as a project */
  { id: 'project-course', role: ['student'],
    ask: ['what is a course studied as a project', 'i have a project course', 'no class for this course',
          'one to one course', 'my course has no lecture', 'supervised course'],
    answer: "It is a more demanding and more rewarding way to study a subject: your course's own teacher supervises you for an hour every week, at the class time printed on your timetable or at an hour the two of you agree. "
      + "You write a piece of real work of your own — your team's Build Block problem seen through that course, about 3,000 words, due with the Folio at Session 13 — and you defend it for an hour before a panel, the way professional and postgraduate work is judged. "
      + "It is marked project 30, mid-term 30 and final 40, the final being the oral defence. "
      + "It does not mark your team's Folio.",
    goes_to: '#handins', source: 'AG.4 · AG.5 · AL.1 · AL.9 · AL.10' },

  { id: 'joined-project', role: ['student'],
    ask: ['i have several project courses', 'do i write two projects', 'joined project',
          'more than one project course', 'one defence or two'],
    answer: "You write one joined project and file one file, about 3,000 words for each course, and each course marks its own part. "
      + "There is one defence covering all of them: every joined course's teacher sits in the same hour and each scores their own course out of 40 on their own page. "
      + "The chair chairs the hour and does not score.",
    goes_to: '#handins', source: 'AL.5 · AP.7' },

  { id: 'defence', role: ['student', 'teacher'],
    ask: ['what happens at the oral defence', 'defence', 'viva for a project course', 'panel',
          'how is the defence scored', 'who is on the panel'],
    answer: "One hour before a panel of your course teacher and a chair named by your Dean; an alumnus may sit as a third member, ask questions, and never scores. "
      + "It is the final 40, scored as command of the subject 15, defending your choices 10, answering the unexpected 10, presenting clearly 5. "
      + "A gap of more than six of the forty between examiners goes to a moderator. "
      + "You cannot sit it until eighty per cent of your supervision hours are held and the log is signed by you and your teacher.",
    goes_to: null, source: 'AG.4 · AL.8 · AP.3 · AP.6 · AH.7' },

  { id: 'supervision', role: ['student'],
    ask: ['supervision log', 'confirm my hours', 'weekly hour', 'do i have to attend supervision',
          'eighty per cent', '80%', 'attendance'],
    answer: "One hour a week with your teacher. The teacher ticks each hour held and you confirm it here; you need eighty per cent of the hours and a log signed by both of you before you may sit the oral defence. "
      + "Below that the score page stays locked, unless the office records a written exception. "
      + "For an ordinary course the University's own attendance rule is unchanged and the register says nothing more about it — ask the front desk if you need the exact figure.",
    goes_to: '#handins', source: 'AP.3 · AL.6' },

  { id: 'fail', role: ['student'],
    ask: ['what if i fail', 'resit', 'failed a course', 'retake', 'second attempt'],
    answer: "The University's ordinary resit regulations apply, including for a course studied as a project. "
      + "The earlier idea of a single 5,000-word replacement study capped at a bare pass was withdrawn. "
      + "Your course teacher and the Registrar's office hold the detail; ask your convener to put you in front of the right person.",
    goes_to: null, source: 'AE.53' },

  /* ================================================== the team */
  { id: 'change-team', role: ['student'],
    ask: ['how do i change team', 'i want to move team', 'wrong team', 'can i swap teams',
          'i do not like my team', 'move me'],
    answer: "A team change is your convener's decision, and they record a written reason for it. You cannot change it here and neither can the front desk. "
      + "The teams were cut from the Registrar's files of 20 September and are final; anyone who registered or dropped afterwards is placed or removed by hand, with a written reason. "
      + "Take it to your convener with what is actually wrong — a problem inside the team is usually answered by the report route, not by a move.",
    goes_to: '#team', source: 'Q · AS.3' },

  { id: 'teammate', role: ['student'],
    ask: ['my teammate is not working', 'nobody is doing anything', 'report a teammate',
          'someone is not contributing', 'carrying the team', 'free rider'],
    answer: "Use “Something is wrong in the team” on your home screen. It goes to your convener and nobody else: your teammates never see it, and neither does the person you name. "
      + "The convener decides what happens — they may cut the scope in writing, or remove the person from the Folio, in which case that person is marked on their viva and what they can personally evidence. "
      + "It is answered within five working days. "
      + "Do it in week three, not in December, and keep your team charter up to date, because that is the evidence a teacher reads before moving anyone up or down three marks.",
    goes_to: '#home', source: 'Q · V · AA (G7)' },

  { id: 'no-team', role: ['student'],
    ask: ['i have no team', 'i am not in a team', 'unplaced', 'where is my team', 'no block'],
    answer: "You are on the register but not yet in a team, so nothing here opens until your convener places you. "
      + "Anyone who registered after the cut of 20 September is placed by hand, with a written reason. "
      + "Go to the front desk with your roll number and your timetable, and they will get you to the right convener.",
    goes_to: '#home', source: 'AS.3' },

  { id: 'charter', role: ['student'],
    ask: ['what is the charter for', 'team charter', 'do we need a charter', 'charter due'],
    answer: "One page started at Session 6 and filed by Saturday 7 November: who does what, by when, how the team decides, and what happens if someone does not deliver. "
      + "It is the evidence a teacher uses when moving one student up or down three marks from the team's twenty. "
      + "A team with no charter has nothing to point at when one member stops working.",
    goes_to: '#handins', source: 'Y.2 · AG.2 · AU.3' },

  /* ================================================== signing in, the account */
  { id: 'cannot-sign-in', role: GW_ALL,
    ask: ['i cannot sign in', 'forgot my password', 'wrong password', 'locked out', 'cant log in',
          'my code does not work', 'account locked'],
    answer: "Eight wrong codes lock a roll number for one hour; wait the hour or go to the front desk, who can issue a fresh code. "
      + "A member of staff signs in with their handle — first name and surname with a full stop between them — not with an email address. "
      + "If you have forgotten a password you have already chosen, the front desk resets it; nobody in the portal can read it. "
      + "Your account is on your roll number, so bring your card.",
    goes_to: null, source: 'AD.7 · AD.8 · Y.1' },

  { id: 'account-opens', role: ['student'],
    ask: ['when does my account open', 'claim code', 'claim slip', 'first time here',
          'where is my code', 'set up my account'],
    answer: "You are handed a slip with your card carrying your roll number and a one-time six-character code. Enter both under “First time here” and choose your own password. "
      + "Your convener tells you when student accounts open — no date is printed on any student paper, because the date is the Chair's to give. "
      + "If the slip is lost, the front desk issues another code; the old one stops working.",
    goes_to: null, source: 'AP.4 · Y.1' },

  { id: 'password', role: GW_ALL,
    ask: ['change my password', 'new password', 'password rules', 'must change password'],
    answer: "Use Password in the top bar and choose your own. "
      + "Every member of staff starts on a first password issued by the office and can do nothing at all in the portal until they have replaced it — an account still on the first password cannot mark, approve or sign anything. "
      + "Nobody, including the office, can read your password once you have set it.",
    goes_to: null, source: 'AD.8' },

  { id: 'upload-problem', role: GW_ALL,
    ask: ['my file will not upload', 'file too big', 'upload failed', 'what file types',
          'can i replace a file', 'wrong file uploaded'],
    answer: "A single file may be 60 MB at most. If yours is larger, split it or compress the images — the portal will not take it, and a file that did not upload is not a hand-in. "
      + "Every upload is a new version and never an overwrite: the old file stays, with its timestamp and who sent it, so replacing a file is safe and a late change looks like a late change. "
      + "If it still fails, tell the front desk the same day — the late rule runs off the portal's timestamp.",
    goes_to: '#handins', source: 'Y.2 · AV.2' },

  { id: 'pvc-booking', role: ['student'],
    ask: ['how do i book the pvc', 'fifteen minutes', 'book a session', 'provost', 'chair meeting',
          'mentorship', 'no slots'],
    answer: "Fifteen minutes with the Pro Vice Chancellor, twelve till eight every day including weekends, from 5 October to 12 December. "
      + "Every team gets two sessions booked automatically; individual slots are first come and open fourteen days ahead at a time. "
      + "Book at least one day ahead and write one sentence saying what is stuck — the booking is refused without it, because that sentence is the whole point of the fifteen minutes. "
      + "Sessions 12 and 13 are held back for crises.",
    goes_to: '#diary', source: 'S · Y.3' },

  /* ================================================== the term, the Review */
  { id: 'karachi-review', role: GW_ALL,
    ask: ['what happens on 15 december', 'karachi review', 'showcase', 'exhibition', 'do i have to attend',
          'the review day'],
    answer: "Tuesday 15 December, 10:00 to 17:00, across the whole campus: a thirty-minute handover of the studies to the bodies that asked for them, then every team exhibits at its own table all day. "
      + "A judging pair — a teacher and an alumnus — comes to your table for about eight minutes and scores you there; that score is advisory and goes to the courses marking your Folio, it is not entered as a mark. "
      + "Attendance is compulsory, and nothing is accepted after this day.",
    goes_to: null, source: 'AA · AT.3' },

  { id: 'what-is-gw', role: GW_ALL,
    ask: ['what is greenwich works', 'why are we doing this', 'explain the programme', 'what is this portal',
          'why one piece of work'],
    answer: "Every student is in a team that takes one real problem in Karachi, builds something that exists by December, and writes it up once — and the courses those students share mark that same piece of work, each from its own angle. "
      + "It replaces the fifteen to eighteen small assignments six courses used to set. "
      + "Every course is still out of 100 as project 30, mid-term 30 and final 40, and the mid-term and the final are untouched. "
      + "How this works, in the tabs above, is the long version.",
    goes_to: '#guide', source: 'AG.1 · AS.2' },

  { id: 'postgraduate', role: GW_ALL,
    ask: ['i am a masters student', 'mphil', 'phd', 'b ed', 'bed', 'postgraduate', 'level 7',
          'level 8', 'do postgraduates have teams'],
    answer: "Level 7 and level 8 courses and the postgraduate programmes — MS, MPhil, PhD and B.Ed — are outside Greenwich Works. No teams, no projects, nothing to hand in here. "
      + "Those courses run as ordinary classes and are assessed on the University's ordinary scheme by their own teacher. "
      + "If you think that is wrong — for example you are an undergraduate — go to the front desk with your roll number and your timetable.",
    goes_to: null, source: 'AJ.3 · AP.5 · AQ.1' },

  /* ================================================== teachers */
  { id: 't-what-i-enter', role: ['teacher', 'convener'],
    ask: ['what do i enter', 'what do i mark', 'where do i put the marks', 'marking screen',
          'do i enter the mid term here', 'what marks go in the portal'],
    answer: "The portal records the project 30 only: the team's Folio 20 on the five rubric lines, entered once per team, plus each enrolled student's viva 10 and the ±3 adjustment. "
      + "For a course studied as a project it also records the project 30 and the oral final 40. "
      + "The mid-term 30 and the written final 40 stay in the University's own system. "
      + "Every one of the hundred marks is yours; nobody above you can move one.",
    goes_to: '#marks', source: 'AG.1 · AG.2 · AG.4' },

  { id: 't-one-or-two-members', role: ['teacher', 'convener'],
    ask: ['only one of my students is in this team', 'one member', 'two members', 'small marking',
          'can i still use the rubric', 'adjustment with one student'],
    answer: "Where your course marks a Folio for one or two enrolled members, mark the 20 on those members' named sections rather than on the whole file. "
      + "Integration then asks whether the section belongs to the Folio, not whether the Folio holds together. "
      + "The ±3 does not apply to a one-member marking, because there is no team mark to adjust. "
      + "This is common — nearly half of all course-team markings are one or two members.",
    goes_to: '#marks', source: 'AD.2' },

  { id: 't-lens', role: ['teacher', 'convener'],
    ask: ['my course sets a lens note', 'lens note marking', 'students not in my teams',
          'viva out of 30', 'third lens note'],
    answer: "A student your course does not mark through a Folio owes you a lens note: about 3,000 words on their own project from your course's angle, marked on the same rubric out of 20, plus their viva 10. "
      + "No student writes more than two. From a third such course on, that course sets no written piece at all and marks the student's viva out of 30 instead — the portal will refuse the wrong shape of mark and say so. "
      + "The marking screen shows those courses as students rather than teams.",
    goes_to: '#marks', source: 'AG.3 · AE.51' },

  { id: 't-project-course', role: ['teacher', 'convener'],
    ask: ['my course is studied as a project', 'i supervise a project student', 'how do i run it',
          'how do i present it to students', 'one hour a week', 'project course pay'],
    answer: "You supervise each student for an hour a week, at the class time printed on the timetable or at an hour the two of you agree, and you tell the Registrar which. It is paid as one hour a week whatever the number of students. "
      + "Record your mid-term choice — a written paper in mid-term week, or the Session 8 plan with the first 1,500 words — and tick each supervision hour as it is held. "
      + "Present it to students as what it is: one-to-one supervision, a piece of real work of their own, and a defence before a panel. Never explain it by how few students registered.",
    goes_to: '#marks', source: 'AG.5 · AL.1 · AL.2 · AL.3 · AL.6 · AL.12' },

  { id: 't-defence-score', role: ['teacher'],
    ask: ['who scores the defence', 'can the chair score', 'alumnus at a defence', 'defence score',
          'teacher absent from a defence', 'joined defence'],
    answer: "You score your own course out of 40 — command 15, defends the choices 10, answers the unexpected 10, presents clearly 5 — and nobody else can enter it for you. "
      + "The chair named by the Dean chairs the hour and does not score; an alumnus may sit as a third member, ask questions, and never scores. "
      + "In a joined defence every joined course's teacher sits in the same hour and each scores their own course on their own page. "
      + "A gap of more than six of the forty between examiners goes to a moderator.",
    goes_to: '#marks', source: 'AL.8 · AP.6 · AP.7 · AH.7 · AU.3' },

  { id: 't-cannot-see-course', role: ['teacher', 'convener', 'office'],
    ask: ['my course is missing', 'i cannot see my course', 'no course on my marking screen',
          'nobody can mark this course', 'no marker'],
    answer: "Twenty-three of the 141 marking courses have nobody who can enter their marks: either the Registrar has named no teacher, or the named teacher has no portal account yet. "
      + "The office adds the account and the teaching right, with a written reason, from the SQL editor — it cannot be done from a screen. "
      + "Tell the office which course, and give the exact code from your timetable.",
    goes_to: '#marks', source: 'AS.4 · AW.1' },

  { id: 't-close-export', role: ['teacher', 'office'],
    ask: ['export for examinations', 'csv', 'close marking', 'reopen marking', 'marks are locked',
          'i cannot edit a mark'],
    answer: "Submitting a mark puts it in the export; the office closes a course once its marks are final, and after that nothing in it can be changed by anybody. "
      + "The office can reopen a course with a written reason, which is logged, and every change to a mark keeps who and when. "
      + "The export is a file of roll, name, raw, penalty, net and the parts, and only the office and the course's own teacher can take it.",
    goes_to: '#marks', source: 'AA (G6) · AV.3' },

  /* ================================================== conveners */
  { id: 'c-approve', role: ['convener'],
    ask: ['how do i approve a choice', 'approve project', 'return a choice', 'team board',
          'what is waiting on me'],
    answer: "Teams is the board: one row per team with the choice, the prediction, the ethics tier and status, the plan, the charter, the field plan, the weekly check and the Folio. "
      + "“To do” is what waits for you; “stuck” is what needs somebody. "
      + "Approve or return each choice with a reason the team can read — an approved choice is locked until you reopen it, and the portal has already refused a third team on the project and a site another team holds.",
    goes_to: '#teams', source: 'AI.3 · AV.3' },

  { id: 'c-merge', role: ['convener', 'teacher'],
    ask: ['the merge', 'session 7 merge', 'what do i do with the plans', 'folio sections',
          'what does each course want'],
    answer: "At Session 7 you merge what every marking course needs into the Folio's sections, working from the teams' one-page plans, and send one document back to the block. "
      + "A team with no plan on file is not in that merge, which is why the plan is chased first. "
      + "Each affected project also carries one required chapter or artefact so that every marking course has something real to mark.",
    goes_to: '#teams', source: 'E · AI.8' },

  { id: 'c-weekly-check', role: ['convener'],
    ask: ['weekly check', 'five questions', 'field check', 'do i have to check every week'],
    answer: "Once a week, from a team's first field visit to Session 13, two minutes each: did you go where the plan says; did anyone go alone; did anything at all happen; is anyone uncomfortable about this site; consent forms — how many, and where are they. "
      + "Five yes-or-no answers and two lines in the log, entered on the Teams board. "
      + "That log is the evidence that the fieldwork rules were not decorative, and the portal will not take a worrying answer without a line saying what you did.",
    goes_to: '#teams', source: 'X.3' },

  { id: 'c-moderation', role: ['convener'],
    ask: ['moderation', 'sample three drafts', 'courses disagree', 're-mark', 'four marks apart'],
    answer: "At Session 11 sample three drafts per block — a strong one, a weak one and a middle one — and send one message back to the block's teachers. "
      + "At Sessions 13 and 14, on the same three Folios, compare what each course awarded: four marks or more apart, ask that teacher to re-mark with you present; if they will not move, record both marks and send it to the programme heads. "
      + "You enter no mark yourself and you change none, and a gap against a one- or two-member marking is not automatically a case. "
      + "The one thing you may do to a mark's arithmetic is waive a late penalty, with a written reason that is logged — as the office may. Where you also teach the course, you cannot waive on work you marked yourself; the office can.",
    goes_to: '#moderation', source: 'Q · AD.2' },

  { id: 'c-hours', role: ['convener'],
    ask: ['how many hours is this', 'convener workload', 'am i paid', 'honorarium', 'too many teams'],
    answer: "The eleven-week industry-convener pairing was cut on 10 September: alumni now come for two days in December as viva panellists and showcase judges, and those hours were never recovered. "
      + "On the current cut a convener carries between four and seventeen teams, and the realistic figure is about forty-eight hours across the term rather than the thirty an older handbook promised. "
      + "No honorarium has been agreed. Both belong to the Steering Group, and the January pricing runs on what conveners actually record. Fifteen of the sixteen block holders have a convener account here; the sixteenth signs in as a teacher, so his hours reach the office on paper.",
    goes_to: null, source: 'AA · AM · AN.3' },

  /* ================================================== the office */
  { id: 'o-gate', role: ['office'],
    ask: ['open the fieldwork gate', 'gate setting', 'duty phone', 'sign out sheet', 'settings'],
    answer: "The gate is a settings row. Set fieldwork_gate_open to yes only once the Greenwich Works duty phone and the sign-out sheet actually exist; until then no field plan can be accepted, whatever a team's tier. "
      + "The duty phone is a new SIM in a basic handset held at the Greenwich Works desk, rostered between the three of the secretariat, with the PVC as after-hours escalation. "
      + "Every setting change is logged with who and when.",
    goes_to: '#admin', source: 'AO.3 · AA (G1)' },

  { id: 'o-dates', role: ['office'],
    ask: ['change a date', 'move a deadline', 'menu from', 'choice from', 'due date change',
          'dates are wrong'],
    answer: "The dates live in settings, not in code: menu_from 28 September, full_from 5 October, choice_from 12 October, the fieldwork gate, the late-week rule, the last acceptance date and when a student sees a mark. "
      + "Changing one changes it for everybody at once, and it is logged. "
      + "Before 5 October the database itself will not serve a student the full project text — that is the setting doing it, not the browser.",
    goes_to: '#admin', source: 'AS.2 · AV.3' },

  { id: 'o-reset', role: ['office'],
    ask: ['reset a claim code', 'student lost their slip', 'issue a new code', 'unlock a roll number'],
    answer: "Reissue the code from the Everyone screen: the old code stops working at once and the student sets up their account with the new one. "
      + "A roll number locks for an hour after eight wrong codes, and reissuing clears it. "
      + "Never read a code back to somebody over the phone without knowing who you are speaking to — the code is the whole of the account.",
    goes_to: '#office', source: 'AD.7 · Y.1' },

  { id: 'o-names', role: ['office'],
    ask: ['students with no name', 'names file', 'name not on file', 'missing names', 'roll number instead of a name'],
    answer: "Seventy-six students on the current cut have no name on the Registrar's file, sixty-seven of them in teams, so the portal shows their roll number in place of a name. "
      + "Their cards, claim slips and marks export cannot be printed with a name until the names file arrives from the Registrar's office and the seed is rebuilt. "
      + "It is on the waiting list against the Registrar's office.",
    goes_to: '#office', source: 'AS.3' },

  { id: 'o-storage', role: ['office'],
    ask: ['storage', 'how much space', 'bucket full', 'uploads failing', 'supabase pro'],
    answer: "Storage is the number to watch: the free plan is 1 GB and the Folios are expected to need rather more. "
      + "Supabase Pro from November is the decision already taken, about USD 25 a month for the three months of uploads, and storage_limit_gb is the setting the gauge measures against. "
      + "A single file may be 60 MB at most. When the bucket is full a team simply cannot upload, and the late rule does not care why.",
    goes_to: '#admin', source: 'AV.2 · AA' },

  /* ---- 22 September, register BH: the sign-out sheet, form F2, the AI declaration as a form, appeals, the Karachi Review ---- */
  { id: 'sign-out', role: ['student'],
    ask: ['how do i sign out', 'sign out', 'going out', 'leaving campus', 'fieldwork today', 'sign in when back', 'we are back', 'the desk', 'sign-out sheet'],
    answer: "Before you leave campus, file the line from My team: where you are going (the street and the area), the grade from your field plan, who is going, and when you are due back — never after 6 pm. "
      + "Then go to the desk: it counts heads, sees your cards and the letter, and signs you out. When you are back, tap We are back and the desk signs you in. "
      + "Two of you at least, three anywhere graded amber; a red site is signed out on paper with your convener's written approval and an escort. No line is filed until your field plan is accepted and the gate is open.",
    goes_to: '#team', source: 'X.3 · AO.3 · BH' },
  { id: 'incident-form', role: ['student', 'convener', 'office'],
    ask: ['something happened', 'incident', 'incident form', 'form f2', 'f2', 'near miss', 'we were followed', 'police stopped us', 'someone was hurt', 'report an incident'],
    answer: "Report it the same day on form F2, from My team — including the ones where nothing actually happened. Say when, where, who was present, whether anyone was hurt, whether police or any authority were involved, and what happened in your own words. "
      + "Your convener signs it and the office records the Registrar's receipt. If somebody is hurt: care first — ring 1122, then the duty number. A site closed after an incident stays closed to every team until the Registrar reopens it.",
    goes_to: '#team', source: 'X.3 · BH' },
  { id: 'ai-declaration-form', role: ['student'],
    ask: ['how do i sign the ai declaration', 'where is the ai declaration', 'ai declaration form', 'declare ai', 'sign the declaration', 'upload the ai declaration'],
    answer: "It is not an upload: on Hand-ins, open AI declaration and sign the sheet for the team — every tool you used, what for, how you checked its output and who used it; what the team did itself; and at least one place a tool was wrong. "
      + "Tick the declaration and sign with your own name. It files the team's AI declaration the moment it is signed, and the Folio is not accepted without it. It carries no marks; what it protects is the credit for your work.",
    goes_to: '#handins', source: 'H · Y.2 · BH' },
  { id: 'appeal-ruling', role: ['student'],
    ask: ['how do i appeal', 'appeal', 'i disagree with my convener', 'removed from the folio unfairly', 'appeal a ruling', 'programme heads', 'can i appeal a mark'],
    answer: "A ruling by your convener — a removal from the Folio, a team change, a report answered — can be appealed in writing to the programme heads within seven days of the ruling, from My team. "
      + "Your convener writes an account, the heads decide, and the office records the decision; their decision ends it. A mark is not appealed in the portal: the University's ordinary route applies, unchanged.",
    goes_to: '#team', source: 'AO.6 · BH' },
  { id: 'review-score', role: ['teacher', 'convener', 'office'],
    ask: ['the review score', 'judging pair', 'how do i score at the review', 'karachi review sheet', 'my circuit', 'who judges', 'is the review score a mark', 'at its table'],
    answer: "On 15 December eleven judging pairs — a teacher and an alumnus — walk circuits of about twenty teams and score each at its table on the sheet: does it work (4), is the claim supported (3), did they answer (2), would you take it outside (1). "
      + "The office builds the circuits and opens the day; the teacher on the pair scores from The Review; a judge is never on a circuit holding their own blocks. "
      + "The score is advisory: it shows on the marking card of every course marking that Folio and is never entered as a mark. The team's convener ticks every team at its table; attendance is compulsory.",
    goes_to: '#review', source: 'AE.45 · BH' }
];

/* ---------------------------------------------------------------------------
   Definitions are NOT repeated here.  These point at app/explain.js, which
   already holds 55 terms; the helper shows that entry with its own title.
   --------------------------------------------------------------------------- */
window.GW_HELPER_TERMS = [
  { key: 'folio',        role: GW_ALL,  ask: ['what is the folio', 'folio', 'the file'] },
  { key: 'lens',         role: GW_ALL,  ask: ['what is a lens note', 'lens note', 'lens'] },
  { key: 'viva30',       role: GW_ALL,  ask: ['what is the viva out of 30', 'viva 30', 'viva out of thirty'] },
  { key: 'pcproj',       role: GW_ALL,  ask: ['what is the project for a project course', 'project course hand in'] },
  { key: 'ethics',       role: GW_ALL,  ask: ['what is the ethics screening sheet', 'ethics sheet'] },
  { key: 'tier',         role: GW_ALL,  ask: ['what is an ethics tier', 'tier', 'tier 1', 'tier 2'] },
  { key: 'gate',         role: GW_ALL,  ask: ['what is the fieldwork gate'] },
  { key: 'field',        role: GW_ALL,  ask: ['what is the field plan', 'form f1', 'f1'] },
  { key: 'plan',         role: GW_ALL,  ask: ['what is the one page plan', 'project plan'] },
  { key: 'charter',      role: GW_ALL,  ask: ['what is the team charter'] },
  { key: 'brief',        role: GW_ALL,  ask: ['what is the client brief', 'two page brief'] },
  { key: 'handover',     role: GW_ALL,  ask: ['what is the handover page'] },
  { key: 'ai',           role: GW_ALL,  ask: ['what is the ai declaration'] },
  { key: 'menu',         role: GW_ALL,  ask: ['what is the project menu'] },
  { key: 'sequence',     role: GW_ALL,  ask: ['what is the sequence', 'menu full projects choice'] },
  { key: 'twoteams',     role: GW_ALL,  ask: ['what is the two team rule'] },
  { key: 'patch',        role: GW_ALL,  ask: ['what is a site', 'what is an area', 'what is the patch'] },
  { key: 'prediction',   role: GW_ALL,  ask: ['what is the sealed prediction'] },
  { key: 'team_name',    role: GW_ALL,  ask: ['what is the team name rule', 'can we call ourselves anything'] },
  { key: 'choice_state', role: GW_ALL,  ask: ['what does chosen mean', 'what does approved mean', 'what does returned mean'] },
  { key: 'block',        role: GW_ALL,  ask: ['what is a build block', 'block'] },
  { key: 'lane',         role: GW_ALL,  ask: ['what is a lane', 'client lane', 'civic lane', 'venture lane', 'studio lane'] },
  { key: 'convener',     role: GW_ALL,  ask: ['what is a convener', 'what does a convener do', 'block holder'] },
  { key: 'project30',    role: GW_ALL,  ask: ['what is the project 30'] },
  { key: 'project_course', role: GW_ALL, ask: ['what does studied as a project mean'] },
  { key: 'midterm',      role: GW_ALL,  ask: ['what is the mid term choice'] },
  { key: 'defence',      role: GW_ALL,  ask: ['what is the oral defence'] },
  { key: 'supervision',  role: GW_ALL,  ask: ['what is the supervision log'] },
  { key: 'chair',        role: GW_ALL,  ask: ['what is the chair of a defence', 'who is the chair'] },
  { key: 'rubric',       role: GW_ALL,  ask: ['what is the rubric', 'substance evidence integration presentation revision'] },
  { key: 'adjustment',   role: GW_ALL,  ask: ['what is the plus or minus three', 'adjustment'] },
  { key: 'late',         role: GW_ALL,  ask: ['what is the late penalty'] },
  { key: 'net',          role: GW_ALL,  ask: ['what is raw penalty net', 'net mark'] },
  { key: 'waiver',       role: GW_ALL,  ask: ['what is a waived penalty', 'waiver'] },
  { key: 'moderation',   role: GW_ALL,  ask: ['what is moderation'] },
  { key: 'marks_visible', role: GW_ALL, ask: ['when does a mark appear'] },
  { key: 'review',       role: GW_ALL,  ask: ['what is the karachi review'] },
  { key: 'pvc',          role: GW_ALL,  ask: ['what is the fifteen minutes with the pvc'] },
  { key: 'claim',        role: GW_ALL,  ask: ['what is the claim slip', 'what is a claim code'] },
  { key: 'report',       role: GW_ALL,  ask: ['what is report a teammate'] },
  { key: 'marking_card', role: ['teacher', 'convener', 'office'], ask: ['what is the marking card'] },
  { key: 'closing',      role: ['teacher', 'convener', 'office'], ask: ['what is closing marking'] },
  { key: 'export',       role: ['teacher', 'convener', 'office'], ask: ['what is the export'] },
  { key: 'no_marker',    role: ['teacher', 'convener', 'office'], ask: ['what is a course with no marker'] },
  { key: 'weekly_check', role: ['convener', 'office'], ask: ['what is the weekly five question check'] },
  { key: 'ethics_queue', role: ['convener', 'office'], ask: ['what is the ethics queue'] },
  { key: 'board',        role: ['convener', 'office'], ask: ['what is the team board'] },
  { key: 'exception',    role: ['teacher', 'convener', 'office'], ask: ['what is an office exception'] },
  { key: 'g_accounts',   role: ['office'], ask: ['what is accounts claimed'] },
  { key: 'g_staff',      role: ['office'], ask: ['what is staff on the first password'] },
  { key: 'g_storage',    role: ['office'], ask: ['what is the storage gauge'] },
  { key: 'g_unplaced',   role: ['office'], ask: ['what is unplaced'] },
  { key: 'settings',     role: ['office'], ask: ['what are the settings'] },
  { key: 'regime_outside', role: GW_ALL, ask: ['what does outside greenwich works mean'] },
  { key: 'regime_folio', role: GW_ALL,  ask: ['what does marks the folio mean'] },
  { key: 'signout',      role: GW_ALL,  ask: ['what is the sign out sheet', 'sign-out sheet'] },
  { key: 'f2',           role: GW_ALL,  ask: ['what is form f2', 'what is the incident form'] },
  { key: 'appeal',       role: GW_ALL,  ask: ['what is an appeal'] }
];
})();
