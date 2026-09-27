# SAAY (سعي) — Job Tracker

## What it does

SAAY is an accessible, English-language job-search organizer for students, recent graduates, and job seekers. It helps people save opportunities, apply through official employer websites, track progress, assess a role using their own context, and decide what to do next.

SAAY **does not** submit applications, guarantee employment or interviews, predict hiring outcomes, read LinkedIn, send email, connect calendars, or use job-board integrations.

## Who it is for

Students, recent graduates, and job seekers who want a calmer, more purposeful way to organize internships, cooperative training, graduate programs, and jobs.

## Needs

A modern web browser. There is no installation, internet connection, account, database, API key, or build step required.

## How to run it

1. Open `index.html` by double-clicking it.
2. On the landing page, select **Open your tracker**.
3. Add an opportunity, update its stage, record follow-ups, and use the official employer link when you are ready to apply.

The prototype works directly from the local file system with only relative paths.

## Try it with the sample data

The first open shows clearly labelled **Fictional demo data**. It includes:

- one fictional application exactly 14 full calendar days in **Applied**, shown with a text-labelled red **Needs attention** state;
- one fictional application exactly 13 days in **Interview**, which is intentionally **not** red;
- a saved opportunity closing tomorrow and an application with a reminder due today.

Use **Load example data** in the tracker to restore these made-up records, or **Clear all data** to remove every record stored in this browser.

### Date and follow-up rules

- `applicationDate` stays separate from `stageChangedAt`.
- Every stage change resets `stageChangedAt` to today, so old waiting time never carries to the new stage.
- A record needs attention only if it is **Applied** or **Interview** for at least 14 full calendar days.
- A completed follow-up is saved in the record history and removed from unfinished reminder tasks. Set a new reminder whenever you need one.
- **My Next Move** surfaces useful next actions from closing dates, interview dates, expected response dates, reminders, and long waits.

### Privacy and storage

All data is stored only in this browser using `localStorage`. It does not sync between devices and is not uploaded to GitHub or any service.

## Opportunity assessment

The **Fit assessment** workspace accepts pasted job-description text plus a profile users can review and correct. It highlights transparent matches, explicit/mandatory conditions, preferred qualifications, unknowns, and details to verify. It does not calculate a compatibility percentage or make a hiring prediction.

PDF extraction is not included in this no-dependency prototype. Use pasted text or manual entry instead. Add skills and experience only when they accurately reflect your background.

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
