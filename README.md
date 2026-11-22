# Synergy Bid Analyser

Private administrator portal for Synergy Global Pvt. Ltd. Built with React, Vite and Supabase.

## Supabase connection

This frontend is configured for the existing Supabase project:

- Project ref: `linqdcztcqjmvtahsjgz`
- Project URL: `https://linqdcztcqjmvtahsjgz.supabase.co`
- Region: Mumbai (`ap-south-1`)
- Storage bucket: `synergy-tender-documents` (private)

The browser uses the Supabase **publishable** key only. Never put a Supabase service-role or secret key in this project or any `VITE_` variable.

## Run locally

1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env` (the example is prefilled with this project's URL and publishable key).
3. Run:

   ```bash
   npm install
   npm run dev
   ```

4. Open the local URL printed by Vite (normally `http://localhost:5173`).
5. Sign in with an active Synergy admin account. There is no public sign-up page.

## Current connected functionality

- Administrator password login through Supabase Auth.
- Admin allow-list check against `admin_profiles` and active status.
- Dashboard reads tenders, company profile, financials and evidence records.
- Create and update tender records.
- Upload multiple tender files to the private Storage bucket and create `tender_files` rows.
- Upload reusable company evidence and create `evidence_documents` rows.
- Generate short-lived signed URLs to download private files.
- View stored analysis and compliance rows if present.

## Not yet implemented

The frontend intentionally does not claim that tender analysis is automated yet. The following services still need to be built and connected:

- OCR / PDF, DOCX and XLSX text extraction, including page-level source locations.
- AI clause extraction and evidence-matched compliance assessment.
- Financial eligibility calculations for each tender's exact rules.
- Technical/OEM/certification/experience comparison engine.
- PDF assessment report and Excel compliance matrix export.

Uploaded tender files are marked `pending` for extraction until that processing pipeline is deployed. Do not treat an uploaded document as analysed or any criterion as passed solely because the file is present.

## Deployment

This is a Vite frontend and can be deployed to a static hosting provider such as Vercel or Netlify. Set these build environment variables in the hosting project:

- `VITE_SUPABASE_URL=https://linqdcztcqjmvtahsjgz.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<the project's sb_publishable key>`

Build command: `npm run build`
Output directory: `dist`

Do not commit `.env`, `node_modules/`, or `dist/` to source control. `.env.example` contains the public project configuration template only.

## Tender analysis Edge Function configuration

Set the following **server-side Supabase Edge Function secrets** before deploying the function:

- `OPENAI_API_KEY` — OpenAI API key; never expose it in a browser or any `VITE_*` variable.
- `APP_ORIGIN` — exact frontend origin, including scheme and optional port (for example, `https://your-approved-app-domain.example`). Multiple explicitly approved origins may be comma-separated. The function rejects browser origins not listed here and does not use wildcard CORS.
- `SUPABASE_SERVICE_ROLE_KEY` (or the platform-provided secret key) — server-side only.

The `synergy-tender-documents` Storage bucket is private. Browser downloads use short-lived signed URLs and the Edge Function accesses objects using its server-side service key. The application upload picker accepts PDF, DOCX, XLS/XLSX and PNG/JPG; legacy binary DOC is intentionally excluded because extraction is not supported.
