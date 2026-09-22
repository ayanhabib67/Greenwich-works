/* Greenwich Works — the portal explainer.
   -----------------------------------------------------------------
   Content only. No layout, no styling, no rendering code. Another file
   builds the screens from this one.

     window.GW_GUIDE.programme   facts that are the same for everybody
     window.GW_GUIDE.roles       one entry per role: student, teacher,
                                 convener, office

   Tab ids are the ones the app routes on: home, handins, diary, team,
   gates, marks, moderation, office, guide. A null tab means it happens
   away from the portal.
   ----------------------------------------------------------------- */
window.GW_GUIDE = {

  programme: {
    name: "Greenwich Works",
    term: "Fall 2026–27",
    oneLine: "Every student is in a team that takes one real problem in Karachi, builds something real and writes it up once — and the courses the team shares mark that same piece of work, each from its own angle.",

    what: [
      "Greenwich Works is how coursework is assessed at Greenwich this term. Until now every course set its own assignments: six courses meant fifteen to eighteen small pieces, each marked once, none worth keeping. From this term there is one piece of work instead, and the courses share it.",
      "Every student is in a team — five where the timetable allows it, never fewer than three — cut from students who share most of a timetable. The team takes one project: a real problem in Karachi, with a named body that wants the answer. It sees the project menu at Session 4 and the full projects at Session 5, and makes its final choice at Session 6, with a team name and a sealed prediction of what it expects to find. At most two teams take one project, and only on different sites or areas. Between Session 8 and Session 13 the team builds: every project ends with something that exists by December, and the Folio is the account of it.",
      "The Folio is the work itself: about 3,000 words for each member, plus or minus ten per cent, plus whatever the project produces — data, drawings, code, a campaign, a working product. At most eight courses mark one Folio, each out of 20, each from its own angle. A course outside those eight sets that student a lens note instead.",
      "A Build Block is the group of courses that share a timetable, and the teams cut from them. There are 19, held by 16 conveners. The convener approves the projects, merges what the marking courses want into one document, and moderates afterwards. The convener enters no mark and changes none; a convener or the office may waive a late penalty, with a written reason that is logged. Every one of a course's hundred marks — project 30, mid-term 30, final 40 — is entered by the course teacher."
    ],

    vocabulary: [
      { term: "Greenwich Works",
        meaning: "The programme itself, a pilot across the whole university in Fall 2026–27. It replaces the coursework in every course with one shared piece of work, and leaves the mid-term and the final untouched." },
      { term: "Build Block",
        meaning: "A group of courses that share a timetable, and the teams cut from them. There are 19, held by 16 conveners. A team's project comes from its block, and its block's courses mark it." },
      { term: "the Folio",
        meaning: "The one piece of work a team produces between Session 8 and Session 13. About 3,000 words per member, plus the artefacts the project needs. Uploaded in versions, and marked by up to eight courses at once." },
      { term: "lens note",
        meaning: "What a course sets a student when it is outside the eight marking their team's Folio. An individual piece, about 3,000 words, on the same project from that course's angle, same rubric, same 20. Never more than two: from a third on, that course sets no written piece and marks your viva out of 30 instead." },
      { term: "a course studied as a project",
        meaning: "A course you study one-to-one instead of in lectures — a more demanding and more rewarding way to study a subject. The course's own teacher supervises you for an hour every week, at the class time printed on your timetable or at an hour the two of you agree. You write a piece of real work of your own: your team's Build Block problem seen through this course, about 3,000 words, due with the Folio at Session 13. You defend it for an hour before a panel, the way professional and postgraduate work is judged. Marked project 30, mid-term 30 (your teacher chooses a written paper or your Session 8 plan with the first 1,500 words) and final 40, the oral defence. If you hold several, you write one joined project and sit one defence, and each course marks its own part. It does not mark your team's Folio." },
      { term: "project menu",
        meaning: "What teams see at Session 4: each project's title, its problem in one line, and who it is for. Teams note the three they like. The full projects, with the block brief, follow at Session 5, and the final choice is made at Session 6." },
      { term: "site or area (the patch)",
        meaning: "Where, or on whom, a team works — a neighbourhood, a sample, a sector, a site. At most two teams take one project, and only on different sites or areas: the portal refuses a site another team on the same project already holds, and the convener confirms every choice." },
      { term: "sealed prediction",
        meaning: "At Session 6, before any data, the team writes down what it expects to find, signs it and seals it with its convener. The convener opens it at the team's first viva. It carries no marks; it is there so the team can see what it learned." },
      { term: "convener, or block holder",
        meaning: "The person who runs a Build Block. They approve projects and team names, merge the marking courses' requirements into the Folio's sections at Session 7, sign field plans, moderate, and rule when a team breaks down. They enter no mark and change none. The one thing they may do to a mark's arithmetic is waive a late penalty, with a written reason that is logged \u2014 as may the office." },
      { term: "the Karachi Review",
        meaning: "Tuesday 15 December. The whole campus is open, every team exhibits at its own table, and eleven judging pairs — a teacher and an alumnus — walk circuits of about twenty teams, eight minutes each. The panel score is advisory: it goes to the courses marking the Folio and is not entered as a mark." },
      { term: "viva",
        meaning: "Three minutes, alone, with each course teacher, in that course's Session 14 class. Worth 10 of the project 30, and the student's own. Work a student cannot explain is not credited to them." },
      { term: "charter",
        meaning: "One page the team writes at Session 8: who does what, by when, how the team decides, and what happens if someone does not deliver. Filed in the portal, and the evidence a teacher uses for the ±3." },
      { term: "ethics tier",
        meaning: "Which of three routes a project's fieldwork takes, decided by ten questions answered in class at Session 6, straight after the team's final choice: self-certify, convener approval on the field plan, or the ethics panel where anything private is asked or anything identifying is recorded. The panel sits every week from 6 October and decides within a week. No data is collected before the screen is cleared." },
      { term: "field plan",
        meaning: "Form F1. Where the team is going, when, who with, the area grade and the duty number, signed by the convener. It appears only for teams that tick fieldwork, and nobody goes out without it. No team leaves campus before Monday 5 October, whatever its tier." }
    ],

    marks: [
      { component: "Folio — the team mark",
        marks: 20,
        whoGives: "The course teacher",
        note: "Part of the project 30. One mark per course per team, on that course's own dimension, against the five rubric lines. Entered once and applied to every member of that team enrolled in that course." },
      { component: "Viva",
        marks: 10,
        whoGives: "The course teacher",
        note: "The rest of the project 30. Three minutes per student in that course's Session 14 class, on their own part. Nobody else's work can earn it." },
      { component: "Mid-term",
        marks: 30,
        whoGives: "The course teacher",
        note: "Set, sat and marked as before, on Sessions 1–7, and entered in the examination system rather than here." },
      { component: "Final",
        marks: 40,
        whoGives: "The course teacher",
        note: "Entirely the teacher's. A practical course may take a final practical project instead. The three quizzes, at Sessions 3, 6 and 11, are practice and carry no marks." }
    ],

    marksNote: "The 20 breaks down the same way in every course and block: substance 8, evidence 4, integration 3, presentation 3, revision 2. On top of the team mark a teacher may move any one student up to three marks either way, on the evidence of the viva and the charter, with a one-line reason. Late work loses five of the twenty a week — the team mark, in every course marking that Folio, taken from the portal timestamp. The viva is untouched, and nothing is accepted after the Karachi Review on Tuesday 15 December. Where a course marks a Folio for only one or two enrolled members, the 20 is marked on those members' named sections rather than on the whole file; integration then asks whether the section belongs to the Folio, not whether the Folio holds together; and the ±3 does not apply to a one-member marking, because there is no team mark to adjust. This is common. A course studied as a project is out of 100 in the same way — project 30, mid-term 30, final 40 — with the final taken as a one-hour oral defence: command of the subject 15, defending the choices 10, answering the unexpected 10, presenting clearly 5.",

    calendar: [
      { session: "Session 1", dates: "7–12 September",
        what: "Orientation. The Build Block is explained.",
        who: ["student", "teacher", "convener", "office"] },
      { session: "Session 2", dates: "14–19 September",
        what: "Add and drop closes. Conveners brief every class for twenty minutes, from the script.",
        who: ["student", "teacher", "convener"] },
      { session: "Session 3", dates: "21–26 September",
        what: "Quiz 1. The teams are final: they were cut from the Registrar's files of 20 September. Anyone who registered or dropped after that is placed or removed by hand, with a written reason. Cards and claim slips follow; your convener tells you when your portal account opens.",
        who: ["student", "teacher", "convener", "office"] },
      { session: "Session 4", dates: "28 September – 3 October",
        what: "The project menu is issued in class, twenty minutes: each project's title, its one-line problem and who it is for. Teams note the three they like. Nobody chooses in the room.",
        who: ["student", "teacher", "convener"] },
      { session: "Session 5", dates: "5–10 October",
        what: "The full projects reach every team, with the block brief. The booking diary opens on 5 October. Monday 5 October is also the fieldwork gate: no team leaves campus before it, and none before its ethics sheet is cleared.",
        who: ["student", "convener"] },
      { session: "Session 6", dates: "12–17 October",
        what: "Quiz 2. Each team makes its final choice of project, names itself and seals its prediction with its convener. The ethics screening sheet is answered in class straight after and filed by Saturday 17 October. The ethics panel sits weekly from 6 October; a team that needs it files this week and hears within a week.",
        who: ["student", "teacher", "convener"] },
      { session: "Session 7", dates: "19–24 October",
        what: "The one-page project plan is due on Saturday 24 October. The convener merges the marking courses' requirements into the Folio's sections.",
        who: ["student", "teacher", "convener", "office"] },
      { session: "Mid-term", dates: "26–31 October",
        what: "Mid-term examinations, unchanged, set and marked by the course teacher.",
        who: ["student", "teacher"] },
      { session: "Session 8", dates: "2–7 November",
        what: "The build starts. The rubric is issued. The team charter is due on 7 November. A team doing fieldwork has had its field plan approved since 17 October.",
        who: ["student", "teacher", "convener"] },
      { session: "Session 9", dates: "9–14 November",
        what: "Project work. Iqbal Day is Monday 9 November; Monday sections make it up on Tuesday 10 November.",
        who: ["student", "teacher", "convener"] },
      { session: "Session 10", dates: "16–21 November",
        what: "Project work, client check-ins, and the school's industrial visit somewhere in this stretch.",
        who: ["student", "convener"] },
      { session: "Session 11", dates: "23–28 November",
        what: "Quiz 3, and the draft review — ten minutes with each team, on what exists rather than what is planned. Sections above thirty tell the convener where their vivas will be held.",
        who: ["student", "teacher", "convener"] },
      { session: "Session 12", dates: "30 November – 5 December",
        what: "It goes live: what the project promised would exist by December has to exist by now — the product, the campaign, the report, the offer.",
        who: ["student", "convener"] },
      { session: "Session 13", dates: "7–12 December",
        what: "The Folio is due on Saturday 12 December, with the AI declaration and any lens notes. Marking opens in the portal.",
        who: ["student", "teacher", "convener", "office"] },
      { session: "Session 14", dates: "14–19 December",
        what: "Vivas in class, three minutes a student, in every course. Alumni sit on viva panels on 19 December.",
        who: ["student", "teacher", "convener", "office"] },
      { session: "The Karachi Review", dates: "Tuesday 15 December",
        what: "The whole campus exhibits, 10:00 to 17:00, opening with a thirty-minute handover of the studies to the bodies that asked for them. Nothing is accepted after this day.",
        who: ["student", "teacher", "convener", "office"] },
      { session: "Finals", dates: "21–26 December",
        what: "Final examinations, unchanged, set and marked by the course teacher.",
        who: ["student", "teacher"] }
    ]
  },

  roles: {

    /* ------------------------------------------------------ student */
    student: {
      label: "Student",
      blurb: "You are here to build one piece of work with your team, hand it in on time, and be able to explain your own part of it.",

      youCan: [
        { title: "See what is due next",
          body: "Home is this week and the next: what is due, where your team stands (project, name, prediction, ethics, plan, charter), how every course marks you with the project 30 filling in as marks arrive, and your next fifteen minutes. Hover over, or tap the ? beside, anything you do not know.",
          tab: "home" },
        { title: "Hand in everything your team owes",
          body: "The ethics sheet, the plan, the charter, the Folio with its client brief, handover page and AI declaration — and the field plan only if your team ticks fieldwork, a lens note for each course that sets you one, and one joined project if you study courses as a project. Choose the file, add a line for your convener if it helps, and send it.",
          tab: "handins" },
        { title: "Replace a file without losing the old one",
          body: "Every hand-in is a new version. The old file stays, with its timestamp and who sent it. A late change looks like a late change, which is the point.",
          tab: "handins" },
        { title: "Enter your project and your site",
          body: "At Session 6 your team enters its final choice from the block's list, or describes its own, and names its site or area. At most two teams take one project, and only on different sites; the screen shows what is already taken.",
          tab: "team" },
        { title: "Say that your project involves fieldwork",
          body: "One tick. It adds the field plan to your hand-ins and puts your team under the fieldwork rules. Once the ethics sheet or the field plan is filed, only your convener can take it off.",
          tab: "team" },
        { title: "Book fifteen minutes with the Pro Vice Chancellor",
          body: "Twelve till eight, every day including weekends, 5 October to 12 December. One day ahead, one sentence saying what is stuck — the booking is refused without it. Your team's two automatic sessions are already in your list; cancel and rebook rather than not turning up.",
          tab: "diary" },
        { title: "Report a teammate privately",
          body: "It goes to your convener and nobody else. Your teammates never see it, and neither does the person you name. Use it in week three, not in December.",
          tab: "team" }
      ],

      youMust: [
        { title: "Claim your account",
          by: "When your convener tells you",
          body: "You are handed a claim slip with your student card, carrying your roll number and a one-time code. Your convener tells you when your account opens. Enter both under First time here and choose your own password. Eight wrong codes lock the row for an hour." },
        { title: "Make your final choice of project",
          by: "Session 6 · 12–17 October",
          body: "You see the project menu at Session 4 — note the three you like — and the full projects at Session 5. At Session 6 your team makes its final choice, names itself, and seals its prediction of what it expects to find with its convener. Enter the project and your site or area in the portal the same week. At most two teams take one project, and only on different sites." },
        { title: "File the ethics screening sheet",
          by: "Saturday 17 October",
          body: "Ten questions answered in class at Session 6, straight after your final choice, and countersigned by your convener. Upload the signed scan. Nobody collects data or goes out before it is cleared; a project that needs the ethics panel hears within a week." },
        { title: "File the one-page project plan",
          by: "Saturday 24 October",
          body: "One page: the question, who it is for, what you will gather, and by when." },
        { title: "File the field plan, if you are going out",
          by: "Saturday 17 October",
          body: "Form F1 — locations, area grade, who is going, hours, and your convener's signature. It goes in with the ethics sheet, and no team does fieldwork until it is approved. If the plan changes, change it in the portal before you go, not afterwards." },
        { title: "File the team charter",
          by: "Saturday 7 November",
          body: "Who does what, how you decide, and what happens if someone does not deliver. One page, and the thing you point at later." },
        { title: "Make it live",
          by: "Session 12 · by 5 December",
          body: "What your project said would exist by December has to exist by the end of Session 12 — the product, the campaign, the report, the offer. Not a plan for it." },
        { title: "Upload the Folio and the AI declaration",
          by: "Saturday 12 December",
          body: "3,000 words per member plus or minus ten per cent, the evidence log and the artefact, the two-page brief for the body your project reports to, and the handover page for next year's team — with the declaration saying what you used and what you checked. Five of the twenty come off for every week it is late, in every course marking it. Any lens note you owe is due the same day, and so is the project for any course you study as a project." },
        { title: "Sit your vivas",
          by: "Session 14 · 14–19 December",
          body: "Three minutes with each teacher, in their class, about your own part. Be able to say why each part of your section is there and what it is based on." },
        { title: "Exhibit at the Karachi Review",
          by: "Tuesday 15 December",
          body: "Your team exhibits at its own table, all day. A panel of a teacher and an alumnus comes to you for eight minutes and scores you there. Attendance is compulsory." }
      ],

      walkthrough: [
        { title: "This is where your work is handed in",
          body: "Everything your team owes goes through this portal — the ethics sheet, the plan, the charter, the Folio, the AI declaration. Not email, not WhatsApp, not a USB handed to a teacher. If it is not here at the deadline, it is late." },
        { title: "Your password is yours",
          body: "You set it when you claimed your account with the code on your slip. Nobody at the university can read it, so if you lose it the front desk resets it rather than looks it up." },
        { title: "Start on Home, then Hand-ins",
          body: "Home tells you what is due next and how many days you have; Hand-ins is the list itself. Filing a replacement never deletes the old version." },
        { title: "My team is where the project lives",
          body: "Your project, your site or area, and the tick that says you are doing fieldwork. It is also where you report a teammate privately." },
        { title: "The explainer stays in the menu",
          body: "The marks, the dates, the vocabulary and the answers to the questions people actually ask are under How this works, in the menu." }
      ],

      faq: [
        { q: "What if a course of mine is not marking my team's Folio?",
          a: "At most eight courses mark one Folio. A course outside those eight sets you a lens note instead — 3,000 words on the same project from that course's angle, same rubric, same 20 marks. You never write more than two: from a third on, that course sets no written piece and marks your viva out of 30 instead." },
        { q: "What if I am the only person in my team taking a course?",
          a: "Then that course marks your own section on its own. Integration asks whether your section belongs to the Folio, and the ±3 does not apply, because there is no team mark to adjust." },
        { q: "Somebody in my team is doing nothing.",
          a: "Report it through My team, in week three rather than in December. It goes to your convener alone. They may remove that person from the Folio, in which case that person is marked on their viva and whatever they can personally evidence." },
        { q: "Am I allowed to use AI?",
          a: "You are expected to. Declare it in the AI declaration, check anything a tool gives you before it goes in, and be able to explain it at the viva. Students are not caught for using AI — they are caught for submitting something they never read." },
        { q: "Another team has taken the project we wanted.",
          a: "At most two teams take one project, and only on different sites or areas. If one team has it, you may still take it on a different site. If it already has its two teams, choose another from your list of three — that is why you noted three at Session 4." },
        { q: "One of my courses is studied as a project. What does that mean?",
          a: "You study that course one-to-one with its teacher instead of in lectures: an hour of supervision every week, a piece of real work of your own on your team's problem seen through that course, and a one-hour defence before a panel at the end. It is marked project 30, mid-term 30, final 40 like every other course. You stay in your team for your other courses." }
      ],

      notYours: [
        "Marks. Your course teacher gives every one of the hundred, and nobody above them can move a mark.",
        "Taking a late penalty off. That one is not yours either \u2014 but your convener, or the office, can waive it where there is a reason, so ask rather than assume. The reason is written down and the waiver is logged; the mark itself is not touched.",
        "Your team's marking list. It comes from your registrations. If it looks wrong, tell your convener the same week.",
        "Moving yourself between teams. Your convener does that, in writing, with a reason.",
        "Seeing another team's work, or a report someone filed about you. Reports go to the convener and the office alone.",
        "Releasing a crisis slot in Sessions 12 or 13. That window is held back and the office opens it.",
        "Deciding whether your fieldwork needs a panel. Your convener runs the ten questions with you and signs, or does not sign."
      ]
    },

    /* ------------------------------------------------------ teacher */
    teacher: {
      label: "Teacher",
      blurb: "You teach your course as you always have, and you give every one of its hundred marks.",

      youCan: [
        { title: "See every team your course marks",
          body: "One card per team, with its block and whether you have submitted it. Each card lists only the members of that team who are enrolled in your course.",
          tab: "marks" },
        { title: "Enter the team's 20 once",
          body: "Substance 8, evidence 4, integration 3, presentation 3, revision 2. The rubric belongs to the team, so saving applies it to every member of that team in your course. You cannot half-save a team.",
          tab: "marks" },
        { title: "Move a student up or down three",
          body: "The ±3, on the evidence of the viva and the charter. It is per student and it is the difference between a team mark and a fair mark. Anything outside ±3 is refused by the database.",
          tab: "marks" },
        { title: "Enter the viva",
          body: "Out of ten, per student. The project total out of 30 updates as you type, and an untouched team reads as a dash rather than as a mark of zero.",
          tab: "marks" },
        { title: "Save without submitting",
          body: "Save keeps the sheet as it stands. Save and submit marks the team done and puts it in the export. Submitting locks nothing — you can re-submit.",
          tab: "marks" },
        { title: "Export your course for Examinations",
          body: "One row per student as CSV: the five rubric lines, the folio 20, the adjustment, the viva and the project 30. You sign a printed copy, and that sheet is the audit trail.",
          tab: "marks" },
        { title: "Hold the viva in your own class",
          body: "Three minutes a student in your Session 14 class. A section above thirty spreads them across Sessions 13 and 14, starting a week early — told to the convener by Session 11. Three minutes is not shortened.",
          tab: null }
      ],

      youMust: [
        { title: "Choose your own password",
          by: "First sign-in",
          body: "You sign in with your handle — your name in lower case with full stops, like ali.saeed — and the password on your sign-in sheet, which you were given on paper. It was printed, so it is not yours. Nothing else opens until you choose your own, and the database checks that you did." },
        { title: "Hand out the project menu, twenty minutes",
          by: "Session 4 · 28 September – 3 October",
          body: "The menu for the block — each project's title, one-line problem and who it is for — and the format sheet: what the Folio is and what your course will mark. Teams note the three they like; nobody chooses in the room. The full projects follow at Session 5 and the final choice at Session 6. Skip it and the team starts three weeks late." },
        { title: "Run the three quizzes",
          by: "Sessions 3, 6 and 11",
          body: "Practice, not marks. The quizzes carry nothing; the project is the only coursework your course sets, and anything further is unmarked." },
        { title: "Issue your rubric row",
          by: "Session 8 · 2–7 November",
          body: "Tell your students exactly what your course will mark in the Folio. The rubric sheet for the block names every course and its dimension; yours is one row of it." },
        { title: "Hold the draft review",
          by: "Session 11 · 23–28 November",
          body: "About ten minutes with each team in your class, on what exists rather than on what they plan. This is where a bad Folio is still fixable, and it is worth 2 of your 20. A section above thirty tells the convener this week where its vivas will be held." },
        { title: "Mark the Folios",
          by: "From Session 13 · 7–12 December",
          body: "Read the section your dimension lives in and its artefact, about 3,000 words, then ten minutes across the whole file to judge integration. You are not reading fifteen thousand words." },
        { title: "Hold the vivas",
          by: "Session 14 · 14–19 December",
          body: "Three minutes a student, on their own part as your course sees it. Without them the team mark carries passengers and you have no evidence for a ±3." },
        { title: "Submit and export",
          by: "After the vivas",
          body: "Submit each team, then export the course as CSV and sign the printed copy for Examinations. You do not retype anything into a second system." }
      ],

      walkthrough: [
        { title: "This is where the Folio marks are entered",
          body: "The portal holds the Folios your students hand in and the sheet you mark them on. Your mid-term and your final stay in the examination system and are not touched here." },
        { title: "Sign in with your handle, then change the password",
          body: "Your handle is your name in lower case with full stops — ali.saeed. The first password is on the sign-in sheet you were given on paper; you must choose your own before anything else opens." },
        { title: "Marking is your only tab",
          body: "Your courses run along the top with a progress bar each. Choose one and you get a card per team it marks, with your students listed inside it." },
        { title: "The team mark once, the rest per student",
          body: "The five rubric lines apply to the whole team. The ±3 and the viva are per student. Every bound is enforced in the database, so a mark outside its maximum is refused rather than quietly stored." },
        { title: "The explainer stays in the menu",
          body: "The rubric, the dates, the late rule and the questions faculty actually ask are under How this works, in the menu." }
      ],

      faq: [
        { q: "My course has nothing to do with the others in the block.",
          a: "Then mark your own dimension and ignore the rest. The rubric sheet names exactly what your course looks at. Where your students fall outside a team's eight, you get lens notes instead." },
        { q: "What if the team is weak but one student is excellent?",
          a: "The ±3 on the team mark, plus the viva of 10. That student can finish 13 marks ahead of a passenger in the same team." },
        { q: "Does this cost me more time?",
          a: "About a seventh fewer hours overall and a fifth fewer in a big class, modelled on real class sizes. In a class of twenty or fewer it can cost you an hour or two." },
        { q: "What about AI?",
          a: "Expected, declared in the AI declaration bound into the Folio, and defended at the viva. Work a student cannot explain is not credited to them. Undeclared use, or fabricated data or references, is misconduct under the HEC 2026 framework." },
        { q: "A student cannot log in. Do I send them to IT?",
          a: "No. Students get in with a one-time claim slip handed out with their card; their convener tells them when accounts open. Send them to the front desk, which reissues a code on the spot." },
        { q: "One of my courses is studied as a project. How is it marked?",
          a: "Project 30, mid-term 30, final 40, like every course. You supervise each student for an hour a week, at the printed class time or an hour you agree. The project is the student's own Build Block problem seen through your course, about 3,000 words, due at Session 13. The mid-term is your choice, stated in the outline: a written paper in mid-term week, or the Session 8 plan with the first 1,500 words. The final is a one-hour oral defence before you and a chair named by the Dean: command 15, defends the choices 10, answers the unexpected 10, presents clearly 5. Present it to students as what it is — one-to-one supervision, a piece of real work, a defence before a panel. These marks are not entered in the portal yet; you will be told when they are." }
      ],

      notYours: [
        "The project. Teams choose one from their block's list at Session 6, on a site of their own; the convener confirms it.",
        "The merge. Turning eight courses' requirements into one document with seven sections is the convener's job at Session 7.",
        "Another course's marks. You read your own courses; the convener reads the teams in their blocks.",
        "Signing off fieldwork. The convener runs the ten ethics questions and signs the field plan. If a student tells you something went wrong out there, it goes to their convener the same day.",
        "Removing a student from a Folio. That is the convener's ruling, in writing, on the same day.",
        "Resetting an account or reissuing a claim slip. The office does that.",
        "The rules — the marks scheme, the word count, the rubric, the eight-course cap, the dates. Those belong to the Steering Group."
      ]
    },

    /* ----------------------------------------------------- convener */
    convener: {
      label: "Convener",
      blurb: "You hold a Build Block: you approve what its teams build, make the marking coherent, and rule when it goes wrong. You enter no mark and you change none \u2014 the one thing you may do to a mark's arithmetic is waive a late penalty, with a written reason that is logged.",

      youCan: [
        { title: "See who has filed what",
          body: "One row per team in your blocks, one column per hand-in. Filled means filed, and the colour says whether it is due or late. This is the sheet the office chases from.",
          tab: "gates" },
        { title: "Read the reports students file about teammates",
          body: "They land with you and the office, and nobody else. Read it, speak to both, decide within five working days, and mark it handled. A report is not a verdict — some are retaliation.",
          tab: "gates" },
        { title: "See where the courses disagree",
          body: "Every Folio in your blocks by the spread between the courses marking it, widest first. Four marks or more apart, out of 20, is flagged. It does not mean anyone is wrong; it means the file is worth a second look.",
          tab: "moderation" },
        { title: "See the register for your blocks",
          body: "Your students, their teams and whether they have set their account up — your own blocks, and nothing outside them.",
          tab: "office" },
        { title: "Waive a late penalty",
          body: "On a hand-in of one of your own teams, with a written reason of at least a line. It is not a mark: the raw mark is untouched, the penalty that was due still shows beside it, and the waiver is logged with your name and the time. The office may do the same, and either of you can withdraw a waiver afterwards. If you also teach the course, the portal refuses to let you waive on work you marked yourself — ask the office.",
          tab: "gates" },
        { title: "Mark, if you also teach",
          body: "Marking works as it does for any teacher, but only for your own courses. Holding a block gives you no claim on anyone else's marks — and none on the late penalty of a Folio you marked yourself.",
          tab: "marks" },
        { title: "Confirm projects, sites and team names",
          body: "Teams enter their final choice in the portal at Session 6 and you confirm it. At most two teams take one project, and only on different sites or areas. The portal refuses a site another team on the same project holds; it does not yet stop a third team choosing a project, so that check is yours — and so is whether the site is small enough to finish and close enough to reach.",
          tab: null },
        { title: "Run the ethics screen and sign the field plan",
          body: "Ten questions in class at Session 6, straight after the final choice, put a team on one of three routes. The ethics panel sits weekly from 6 October and decides within a week. You sign the field plan or you do not, and nobody goes out unsigned — and nobody at all before Monday 5 October, when the duty phone and the sign-out sheet must exist.",
          tab: null },
        { title: "Merge the requirements into one document",
          body: "At Session 7 you turn what the marking courses want into one Folio with seven sections, and send every team one page saying which course marks which section. It is the most important thing you do.",
          tab: null }
      ],

      youMust: [
        { title: "Choose your own password, and read your allocation",
          by: "First sign-in",
          body: "Your handle is your name in lower case with full stops, like ali.saeed, and your first password is on the sign-in sheet you were given on paper. Choose your own; nothing else opens until you do. Then check the teams you hold and flag any that are obviously wrong while a change is still cheap." },
        { title: "Brief your classes",
          by: "Session 2 · 14–19 September",
          body: "Twenty minutes each, from the script. Two sentences have to survive intact when a teacher paraphrases: one piece of work instead of fifteen, and the ten for the viva is yours alone." },
        { title: "Confirm the locked teams",
          by: "Session 3 · 21–26 September",
          body: "The teams are final, cut from the Registrar's files of 20 September. Anyone who registered or dropped after that is placed or removed by hand. Cards and claim slips go out to the final teams, and you tell your students when their portal accounts open. After this a change needs your written reason." },
        { title: "Confirm every project, site and team name, and take the sealed predictions",
          by: "Session 6 · 12–17 October",
          body: "Teams see the menu at Session 4 and the full projects at Session 5, and choose at Session 6. Five tests: is it a problem rather than a topic, can the team finish it by Session 12, has every marking course something real to mark, is the site free and reachable, and is there a named body that would read it. At most two teams to a project, on different sites. Each team seals its prediction with you; you keep the envelopes, open each at the team's first viva, and pass a copy to the team's other teachers. A team with nothing by the end of Session 6 is assigned a project by you." },
        { title: "Run the ethics screen",
          by: "Session 6 · 12–17 October",
          body: "Ten questions with each team, in class, straight after the choice, countersigned before any data is collected. Tier 3 teams file with the ethics panel this week; it sits weekly from 6 October and decides within a week. Monday 5 October is the fieldwork gate: no team leaves campus before it, and only if the duty phone and the sign-out sheet exist." },
        { title: "Do the merge, and sign the field plans",
          by: "Session 7 · 19–24 October",
          body: "One page to every team: your Folio has these seven sections, this is what goes in each, these courses mark each one. Do not let the section count grow with the number of courses, and do not let the word count grow either." },
        { title: "Check the charters",
          by: "Sessions 8–9 · 2–14 November",
          body: "Each one should name who owns what. Chase the teams without a confirmed client, subject or permission while there is still time to change the patch." },
        { title: "Sample three drafts per block",
          by: "Session 11 · 23–28 November",
          body: "A strong one, a weak one and a middle one, read by you, with one message back to the block's teachers. Sections above thirty students also tell you this week where their vivas will be held." },
        { title: "Chase the missing Folios",
          by: "Session 13 · 7–12 December",
          body: "The late rule runs off the portal timestamp, not off anyone's memory of when a file arrived." },
        { title: "Moderate the marks",
          by: "Sessions 13–14 · 7–19 December",
          body: "On the same three Folios, compare what each course awarded. Four marks or more apart, ask that teacher to re-mark with you present. If they will not move, record both marks and send it to the programme heads. A gap against a one- or two-member marking is not automatically a case." },
        { title: "Walk your circuit at the Karachi Review",
          by: "Tuesday 15 December",
          body: "You are never on a circuit that takes in your own blocks. The panel score is out of 10 and advisory: it goes to the courses marking that Folio and you do not enter it as a mark." },
        { title: "Send one page to the programme heads",
          by: "By 31 December",
          body: "What worked, what did not, and your hours log. The role is priced in January on what conveners actually record. Fifteen of the sixteen block holders have a convener account here; the sixteenth signs in as a teacher, so his hours reach the office on paper." }
      ],

      walkthrough: [
        { title: "This is the sheet your block runs on",
          body: "The portal holds every hand-in your teams file, the reports they send you, and the marks the courses enter. It is where you find out what is missing without asking anybody." },
        { title: "Sign in with your handle, then change the password",
          body: "Your name in lower case with full stops — ali.saeed. Your first password is on the sign-in sheet you were given on paper, and you must choose your own before anything else opens." },
        { title: "The gates first",
          body: "One row per team, one column per hand-in, filled where it is filed. The counter at the top of the page shows how many reports are waiting for you." },
        { title: "Moderation is a prompt, not a verdict",
          body: "Every Folio in your blocks by the spread between the courses marking it. Four marks or more apart, out of 20, is the trigger. You are making a 14 mean the same thing in Fashion as in Finance." },
        { title: "The explainer stays in the menu",
          body: "The four jobs, the dates, the moderation trigger and what is yours to decide are under How this works, in the menu." }
      ],

      faq: [
        { q: "Do I give any marks?",
          a: "No, and that is deliberate. Every one of a course's hundred marks is entered by the course teacher. What you hold is the coherence of the work, not the judgement of it." },
        { q: "What does this actually cost me?",
          a: "About forty-eight hours across the term at full scale — roughly three a week, heavy in weeks 4 to 7 and again in the last fortnight. The eleven-week industry pairing that once offset it was cut on 10 September and the hours were not recovered. Keep the log; the role is priced on it in January." },
        { q: "A team is down to three.",
          a: "It continues. Cut the scope in writing — 3,000 words per surviving member, the same standard everyone else meets — and the mark is unaffected. No merging into other teams in week ten." },
        { q: "A course is setting its own assignment anyway.",
          a: "Tell the teacher and the Head of Department in one message, quoting the rule: the project is the only coursework a course sets, and the three quizzes carry no marks. That rule is the whole reform; without it the Folio becomes the sixteenth submission." },
        { q: "A student is hurt in the field.",
          a: "Care first. Never delay treatment over the question of who pays; that is settled afterwards, not on the pavement. The duty number is staffed while fieldwork runs. Say nothing to a team about who pays — as of 10 September there is no insurer and the three substitutes are unsigned. You are told the same day and you log it the same day." }
      ],

      notYours: [
        "Any student's mark. The course teacher gives all hundred, and moderation asks for a re-mark rather than making one.",
        "What a course teaches, or a teacher's mid-term or final.",
        "The marks scheme, the dates, the word count, the rubric or the eight-course cap. Those are the Steering Group's, taken once and minuted.",
        "Fees, attendance and discipline.",
        "Resetting a student's account or reissuing a claim code — the front desk does that, from its own screen.",
        "Releasing the crisis window in Sessions 12 and 13. It is hidden from students and the office opens it.",
        "The register outside your blocks. You see your own teams and students, and nothing else.",
        "Anything on neither list belongs to the programme heads — the Chair and the Deputy Chair. Ask in the same week."
      ]
    },

    /* -------------------------------------------------------- office */
    office: {
      label: "Office",
      blurb: "You keep the portal working, you chase what is missing, and you record what happens. You decide nothing.",

      youCan: [
        { title: "See the whole register",
          body: "Every student, their team, their block and whether they have set their account up, searchable by roll number, name or team. It shows the first 200 matches, so narrow the search or export.",
          tab: "office" },
        { title: "Export the register as CSV",
          body: "Roll number, name, team, block and account state. It opens in Excel.",
          tab: "office" },
        { title: "See every team's gates, in every block",
          body: "The same grid a convener gets, across all 19 blocks. This is what the chasing runs from.",
          tab: "gates" },
        { title: "See moderation across the university",
          body: "Every Folio with a mark, by the spread between the courses marking it, and how many sit above the four-mark trigger.",
          tab: "moderation" },
        { title: "See marking progress course by course",
          body: "How many teams each course has submitted. You see every mark in the university; entering or changing one is the teacher's, and only the teacher's.",
          tab: "marks" },
        { title: "Reissue a claim code, or reset an account",
          body: "On Everyone, find the student and press New code or Reset. A fresh code is shown once for you to hand over; the old slip and the old password stop working, and anything already handed in stays where it is.",
          tab: "office" },
        { title: "Run the automatic bookings",
          body: "autobook('w1') and autobook('w2') give every team its two promised sessions, spread evenly across each window. Only the office may run them.",
          tab: null },
        { title: "Release a crisis slot",
          body: "Sessions 12 and 13 are a hidden window. Students cannot see it and cannot book into it. You open it, one team at a time.",
          tab: null }
      ],

      youMust: [
        { title: "Choose your own password",
          by: "First sign-in",
          body: "Your handle is your name in lower case with full stops, and your first password is on the sign-in sheet you were given on paper. Choose your own before anything else opens — the office accounts first of all. The Home screen counts the staff who have not yet done it." },
        { title: "Hand out the claim slips",
          by: "With the student cards",
          body: "One slip per student, with their card, carrying their name, roll number and a one-time six-character code. They are printed by the university rather than the print shop, because they carry names and codes, and they are confidential. No date is promised to students: their convener tells them when accounts open." },
        { title: "Load the final cut",
          by: "On the Chair's word",
          body: "The teams are final, cut from the Registrar's files of 20 September. Nothing is loaded until the Chair says deploy; then the SQL is run in the order written in STAGE-1-2-CHANGES. Accounts and codes already issued are kept: the seed updates a student's team and block but never overwrites their claim code or their account." },
        { title: "Open student accounts",
          by: "On the Chair's word",
          body: "The first hand-in is the ethics sheet at Session 6, so accounts need to be open before then. Clear the notice on the sign-in page when they are. Demo mode on an invented cohort is the fallback if the live one breaks." },
        { title: "Chase what is missing",
          by: "Every week from Session 6",
          body: "The gates grid is the sheet to chase from. Late is a colour on it, and it comes from the portal timestamp rather than anyone's memory." },
        { title: "Decide the storage upgrade",
          by: "November",
          body: "The free tier gives 1 GB of file storage. About 200 Folios at 15 MB each is roughly 3 GB, so storage runs out in December rather than October. Roughly USD 25 a month, about USD 75 for the term." },
        { title: "Keep the exception log",
          by: "Continuously",
          body: "Every exception is minuted. The secretariat decides nothing and records everything, and the February verdict is read off what was recorded." }
      ],

      walkthrough: [
        { title: "This is the front desk for the whole programme",
          body: "The portal holds every account, hand-in, booking and mark, across all 19 blocks. You see all of it. What you do not do is decide anything with it." },
        { title: "Sign in with your handle, then change the password",
          body: "Your name in lower case with full stops. Your first password is on the sign-in sheet you were given on paper, and you must choose your own before anything else opens." },
        { title: "Everyone is the register",
          body: "Search by roll number, name or team. The account column says who has claimed their slip — the number to watch in the week after Session 3." },
        { title: "The gates are what you chase",
          body: "One row per team, one column per hand-in, every block. A student who cannot get in goes to their convener for a reissued slip; a team that has not filed goes on your list." },
        { title: "The explainer stays in the menu",
          body: "The dates, the marks scheme, the vocabulary and every role's version of this page are under How this works, in the menu." }
      ],

      faq: [
        { q: "A student says they cannot sign in.",
          a: "Ask whether they have claimed the account yet. First time here takes their roll number and the code from the slip, then they choose a password. Eight wrong codes lock the row for an hour. New code, on Everyone, issues a fresh code and voids the slip they are holding, so use it only when the slip is genuinely lost." },
        { q: "A staff member says the password does not work.",
          a: "Check the handle. Staff sign in with their name in lower case with full stops, like ali.saeed, typed into the roll-number box. The first password is the one on their paper sign-in sheet, and they are made to change it — so a person who has already chosen their own cannot use the sheet's." },
        { q: "The Supabase project is not up yet.",
          a: "Demo mode runs the whole portal in the browser on an invented cohort, with a banner saying so. It is what to put in front of students if the live one breaks. The demo claim code is the word DEMO." },
        { q: "Do the alumni need accounts?",
          a: "No. About forty alumni come for two days in December — Karachi Review panels on the 15th and viva panels on the 19th. They never mark and never moderate, so they need nothing in the portal." },
        { q: "Who sees a report about a teammate?",
          a: "The convener of that block and the office. Never the team, and never the person named. That has been verified from the reported student's own account." }
      ],

      notYours: [
        "Marks. You can see every one and you enter none; the course teacher gives all hundred.",
        "Moderation. The convener samples and asks for a re-mark. You record the outcome.",
        "Approving a project, a patch or a team name — the convener does that.",
        "Signing a field plan or deciding an ethics route. Convener, or the panel of three.",
        "Removing a student from a Folio, or ruling on a report. The convener rules; you log it.",
        "Changing the rules. The Steering Group takes them once, and every exception is minuted.",
        "Reading anybody's password. Nobody at the university can. A lost one is reset, not looked up."
      ]
    }
  }
};
