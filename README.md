# SAAY (سعي) — Job Tracker

## What it does

SAAY is an accessible, English-language job-search organizer for students, recent graduates, and job seekers. It helps people save opportunities, apply through official employer websites, track progress, and decide what to do next.

SAAY **does not** submit applications, guarantee employment or interviews, predict hiring outcomes, read LinkedIn, send email, connect calendars, or use job-board integrations.

## Who it is for

Students, recent graduates, and job seekers who want a calmer, more purposeful way to organize internships, cooperative training, graduate programs, and jobs.

## Needs

A modern web browser. There is no installation, internet connection, account, database, API key, or build step required.

## How to run it

1. Open `index.html` by double-clicking it.
2. Open **Tracker** to add an opportunity or update an existing application.
3. When adding an opportunity, you can optionally choose **Quick role check** to paste a job description and spot matching terms before saving it.

The prototype works directly from the local file system with only relative paths.

## Try it with the sample data

SAAY starts with an empty tracker. Select **Try a demo** on the welcome page, dashboard, or tracker—or **Load example data** in the tracker—to deliberately add clearly labelled **Fictional demo data**. It includes:

- one fictional application exactly 14 full calendar days in **Applied**, shown with a text-labelled red **Needs attention** state;
- one fictional application exactly 13 days in **Interview**, which is intentionally **not** red;
- a saved opportunity closing tomorrow and an application with a reminder due today.

Demo records are clearly labelled and can be loaded without replacing personal records. Use **Clear all data** to remove every record stored in this browser.

### Date and follow-up rules

- `applicationDate` stays separate from `stageChangedAt`.
- Every stage change resets `stageChangedAt` to today, so old waiting time never carries to the new stage.
- A record needs attention only if it is **Applied** or **Interview** for at least 14 full calendar days.
- A completed follow-up is saved in the record history and removed from unfinished reminder tasks. Set a new reminder whenever you need one.
- **My Next Move** surfaces useful next actions from closing dates, interview dates, expected response dates, reminders, and long waits.

### Privacy and storage

All data is stored only in this browser using `localStorage`. It does not sync between devices and is not uploaded to GitHub or any service.

## Quick interview prep

Anyone can start **Quick interview prep** from the welcome page—no tracker record, account, or sign-in is required. The landing checklist is directly usable and saves its progress in the browser. It includes general prompts to understand the role, prepare one strong example, prepare questions, and confirm interview details.

The full workspace keeps optional company, role, date/time, and meeting details alongside a shared checklist, private notes, and a Situation–Task–Action–Result (STAR) builder. Its prompts are general practical guidance, not personalized or company-specific advice.

A normal prep save never creates a tracker record. **Save this prep to tracker** is an optional, explicit step that can create an Interview-stage opportunity or connect to an existing Interview-stage opportunity. Interview-stage records also provide their own **Prepare for interview** actions. Connected prep remains browser-only and preserves the record’s other tracker information.

## Optional quick role check

The tracker is the main experience. When adding an opportunity, **Quick role check** is an optional three-step flow: **Your background**, **Job posting**, and **Your role check**. It preserves entered values while moving Back or Continue and reuses an editable profile saved in this browser.

Paste a job description to spot matching terms before you save this opportunity.

### How the role check works

SAAY uses a transparent **local keyword and rule-based comparison**. It does **not** use semantic analysis, AI, external APIs, web browsing, or a hiring prediction.

- Choose evidence from a saved profile, pasted CV text, and/or manual details for the current review.
- Paste the job description; this is the only job-posting text SAAY checks. An official URL is stored for you to open, but SAAY never retrieves, reads, verifies, or checks whether that posting is still open.
- The results show direct keyword matches, terms not found in the selected material, direct conflicts only where entered facts directly contradict an explicit requirement, and details to confirm.
- Missing CV wording is **unknown**, not proof that a person lacks a skill. A wording gap can mean the skill is real but not described. Add information only when it is accurate, then check the role again.
- No percentage score, application recommendation, suitability judgment, or hiring prediction is generated.

### CV text and PDFs

Pasted CV text can optionally be saved to the browser-only profile and removed later with **Clear saved profile and CV**. It does not sync across devices.

A PDF picker is available as a local helper, but this no-dependency browser version cannot reliably extract PDF text or OCR scanned PDFs. SAAY never uploads, stores, or reads the selected PDF. If a PDF is selected, paste selectable text from it or use the structured/manual fields instead.

### Saving and checking again

**Save to tracker** creates a **Saved** opportunity, never an Applied one. It includes the company, job title, official URL, pasted description, and role-check summary. You must change the stage to Applied yourself after applying through the employer website. Existing tracker records can be checked again in place without creating duplicates.

### Fictional verification fixtures and tests

The quick role check includes clearly labelled fictional verification examples for testing only; they never create tracker records automatically. The local role-check engine can also be checked with:

```bash
node --test tests/assessment-engine.test.js
```

Add skills and experience only when they accurately reflect your background.

## Current feature scope

- Track and edit opportunities across Saved, Applied, Assessment, Interview, Offer, Rejected, and Withdrawn stages.
- Support Internship, Cooperative Training, Graduate Program, Full-Time Job, Part-Time Job, and Other opportunity types.
- Search, filter, and sort records.
- Maintain in-app follow-up history and optional next reminders.
- Copy an editable follow-up message for eligible records; SAAY never sends it.
- Open the saved official employer URL in a new tab; SAAY never applies on a user’s behalf.

## What a public production launch would need later

A public release should add authentication, secure per-user cloud storage and deletion controls, a privacy policy, user-specific access controls, and—only if useful and explicitly permitted—email/calendar connections or verified opportunity sources. Live job feeds, web scraping, notifications, PDF parsing, and email-assisted updates are deliberately outside this prototype.

Built with Claude Code during the KKU Claude Code hackathon

Started on 2026-09-27
