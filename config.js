/* Greenwich Works — the portal.  Configuration.
   ------------------------------------------------------------------
   MODE 'demo'      runs entirely in the browser on a small made-up cohort.
                    Nothing is saved anywhere but this browser.  Use it to
                    show people the portal without touching real data.
   MODE 'live'      talks to Supabase.  Fill in the two values below with
                    the Project URL and the anon (publishable) key from
                    Supabase → Project Settings → API.  The anon key is
                    meant to be public; the service key is NOT and must
                    never appear in this file.
   ------------------------------------------------------------------ */
window.GW_CONFIG = {
  MODE: 'live',                            // 'live' = Supabase.  'demo' = in-browser cohort, no backend.
  SUPABASE_URL: 'https://nqkchzmhpzzmakqmmmpq.supabase.co',       // Project Settings → API → Project URL   e.g. https://abcdefghijkl.supabase.co
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xa2Noem1ocHp6bWFrcW1tbXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMzExMzMsImV4cCI6MjEwNDYwNzEzM30.iNGTSUgSJfQmHSDm8wqC5SULk7gcL5qBubShMuk-ho4',   // Project Settings → API → anon / publishable key (never the service_role key)
  TERM: 'Fall 2026–27',
  // shown on the sign-in page; set to '' once student accounts are open
  // Register AP.4: no date is promised for student accounts, here or on paper.
  NOTICE: 'Student accounts are not open yet. Your convener will tell you when your account opens; your claim slip comes with your card. Staff can sign in now.',
  SUPPORT: 'Greenwich Works front desk · Shanzeh, ground floor · 021-111-202-303',
  DOCS: [
    { name: 'Student handbook',   href: 'docs/student-handbook.pdf' },
    { name: 'Studying a course as a project', href: 'docs/student-handbook-project-courses.pdf' },
    { name: 'Your project course, in brief', href: 'docs/project-course-guide.pdf' },
    { name: 'Ethics and consent', href: 'docs/ethics-and-consent.pdf' },
    { name: 'Fieldwork safety',   href: 'docs/fieldwork-safety.pdf' }
  ],
  // per-block documents, resolved from the block name
  BLOCK_DOCS: [
    { name: 'Your block brief',   prefix: 'docs/brief-' },
    { name: 'The marking rubric', prefix: 'docs/rubric-' }
  ]
};
