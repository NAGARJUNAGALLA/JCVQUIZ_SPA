JCVQUIZ_SPA — Option A (Single Page App)
Files:
- index.html
- style.css
- app.js
- users.json  (contains SHA-256 hashes of passwords)
- quiz.json   (quiz content, sections -> questions)
- _redirects  (for Netlify SPA routing)

How to use:
1. Replace users.json with your real usernames and SHA-256 hashed passwords.
   Example Python:
     import hashlib
     hashlib.sha256('Pass@01'.encode()).hexdigest()

2. Update quiz.json with your questions in the same structure (sections -> questions).

3. Create a GitHub repo, push the entire folder, and connect the repo to Netlify.
   On Netlify, set the publish directory to the repo root (/) — Netlify will serve index.html.

4. Deploy and open the site. Login with a test user from users.json.

Notes:
- Timer is 1 minute per question (change behavior in app.js startQuiz()).
- Results are saved to localStorage. To store remotely, add Netlify Functions or integrate a DB (Supabase / Firebase / Airtable).
