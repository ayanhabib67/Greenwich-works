This folder holds the PDFs the portal's home page links to ("What you were given on paper").
The filenames are not free choice: app/config.js names the three general ones outright, and
builds each block name into "brief-<block>.pdf" and "rubric-<block>.pdf". A name that does not
match exactly gives the student a 404.

STATE: all 49 files are here. Nothing on the home page 404s.

The last two were produced on 10 September 2026: run from inside build/,
gen_ethics.py and gen_field.py write the HTML, render.py renders it to out/10_BLOCKS/,
and the rendered PDFs were copied in here under the names config.js asks for.

  ethics-and-consent.pdf     6 pages   from out/10_BLOCKS/_Ethics-and-consent.pdf
                             built by build/gen_ethics.py
  fieldwork-safety.pdf       5 pages   from out/10_BLOCKS/_Fieldwork-safety.pdf
                             built by build/gen_field.py

  Checks run on both: overflow.py clean, blank.py clean (0 near-blank pages),
  secheck.py confirms every numbered section survived the render, and audit.py
  is clean across the whole HTML tree. Do not hand-edit a PDF; change the
  generator and re-render.

PRESENT (44) — refreshed 19 September 2026 (marks: project 30 · mid-term 30 · final 40)
  student-handbook.pdf                  Student handbook v4, Set A  (build/gen_student_v4.py)
  student-handbook-project-courses.pdf  Student handbook v4, Set B  (the project-course pages)
  project-course-guide.pdf              build/gen_project_brief.py — the general guide, no names
  ethics-and-consent.pdf                re-rendered 19 Sep (build/gen_ethics.py)
  fieldwork-safety.pdf                  re-rendered 19 Sep (build/gen_field.py)
  brief-<block>.pdf     x 19            build/gen_brief.py — 19 blocks (register AF)
  rubric-<block>.pdf    x 19
Every block name resolves to its brief and rubric; checked with the app's own slug rule.
The faculty and convener handbooks are NOT here: they name staff, and this folder is public.
