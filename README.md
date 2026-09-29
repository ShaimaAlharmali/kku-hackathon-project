# SAAY (سعي) — Job Tracker

## What it does

It takes opportunities and job-search notes a user enters and gives them a private, browser-only tracker with clear next steps.

SAAY does not submit applications, guarantee employment or interviews, predict hiring outcomes, read LinkedIn, send email, connect calendars, or use job-board integrations.

## Who it is for

Students, recent graduates, and job seekers who want a calmer way to organize internships, cooperative training, graduate programs, and jobs they find themselves.

## Needs

Nothing but a modern web browser. SAAY has no account, API key, database, server, build step, or package dependency.

## How to run it

Start from a fresh download of this repository.

### Windows

1. Download the repository ZIP from GitHub and extract it.
2. Open the extracted project folder.
3. Double-click `index.html`.

### Mac

1. Download the repository ZIP from GitHub and extract it.
2. Open the extracted project folder.
3. Double-click `index.html`.

The app works directly from the local file system using only relative paths.

## Try it with the sample data

1. Open `index.html`.
2. Select **Try a demo** on the welcome page, dashboard, or tracker, or select **Load example data** in Tracker.
3. You should see clearly labelled **Fictional demo** records without replacing any records already stored in the browser.

The examples come from `sample-data/data.js`, use dates relative to today, and include:

- an Applied record at exactly 14 full calendar days, shown with a text-labelled red **Needs attention** state;
- an Interview record at exactly 13 days, which is intentionally not red;
- a Saved opportunity closing tomorrow; and
- an application with a reminder due today.

SAAY saves entries only in the current browser using `localStorage`; it does not upload or sync them.

## Built with Claude Code during the KKU Claude Code hackathon
