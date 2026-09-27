(() => {
  "use strict";

  const STORAGE_KEY = "saay-opportunities-v1";
  const PROFILE_KEY = "saay-profile-v1";
  const SHARED_KEY = "saay-first-share-seen-v1";
  const STAGES = ["Saved", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];
  const TYPES = ["Internship", "Cooperative Training", "Graduate Program", "Full-Time Job", "Part-Time Job", "Other"];
  const ACTIVE_STAGES = ["Applied", "Assessment", "Interview", "Offer"];
  const stageAdvice = {
    Saved: "Review the requirements and tailor your CV before you apply.",
    Applied: "Record your application date and set a follow-up when appropriate.",
    Assessment: "Prepare for the assessment and note the skills it is testing.",
    Interview: "Prepare relevant skill examples and your questions for the conversation.",
    Offer: "Compare the offer with your personal priorities before deciding.",
    Rejected: "Archive this application and reflect on what could help next time.",
    Withdrawn: "Keep a brief record of why you withdrew for future decisions."
  };

  const state = {
    view: "landing",
    query: "",
    stageFilter: "All",
    typeFilter: "All",
    sort: "updated",
    opportunities: [],
    assessmentDraft: null
  };

  const app = document.getElementById("app");
  const liveRegion = document.getElementById("live-region");

  function today() {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }

  function toDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function isoDate(value = today()) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function calendarDaysSince(dateValue) {
    const date = toDate(dateValue);
    if (!date) return 0;
    const difference = today().getTime() - date.getTime();
    return Math.max(0, Math.floor(difference / 86400000));
  }

  function calendarDaysUntil(dateValue) {
    const date = toDate(dateValue);
    if (!date) return null;
    return Math.ceil((date.getTime() - today().getTime()) / 86400000);
  }

  function formatDate(value) {
    const date = toDate(value);
    if (!date) return "Not set";
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function readableDateDelta(days) {
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days === -1) return "yesterday";
    return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
  }

  function uid(prefix = "record") {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function escapeAttr(value = "") { return escapeHtml(value); }

  function announce(message) {
    liveRegion.textContent = "";
    window.setTimeout(() => { liveRegion.textContent = message; }, 20);
  }

  function showToast(message) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
    announce(message);
  }

  function cloneSamples() {
    return typeof window.SAAY_SAMPLE_DATA === "function" ? window.SAAY_SAMPLE_DATA() : [];
  }

  function normalizeOpportunity(record) {
    const now = new Date().toISOString();
    const stage = STAGES.includes(record.stage) ? record.stage : "Saved";
    return {
      id: record.id || uid(),
      isDemo: Boolean(record.isDemo),
      company: String(record.company || "").trim(),
      title: String(record.title || "").trim(),
      opportunityType: TYPES.includes(record.opportunityType) ? record.opportunityType : "Other",
      officialUrl: String(record.officialUrl || "").trim(),
      notes: String(record.notes || "").trim(),
      stage,
      applicationDate: record.applicationDate || "",
      stageChangedAt: record.stageChangedAt || isoDate(),
      closingDate: record.closingDate || "",
      interviewDate: record.interviewDate || "",
      expectedResponseDate: record.expectedResponseDate || "",
      nextReminderDate: record.nextReminderDate || "",
      followUpHistory: Array.isArray(record.followUpHistory) ? record.followUpHistory : [],
      assessment: record.assessment || null,
      createdAt: record.createdAt || now,
      updatedAt: record.updatedAt || now
    };
  }

  const repository = {
    get() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return cloneSamples().map(normalizeOpportunity);
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.map(normalizeOpportunity) : cloneSamples().map(normalizeOpportunity);
      } catch (error) {
        return cloneSamples().map(normalizeOpportunity);
      }
    },
    save(records) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    },
    loadSamples() {
      const records = cloneSamples().map(normalizeOpportunity);
      this.save(records);
      return records;
    },
    clear() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    },
    profile() {
      try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; }
    },
    saveProfile(profile) { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
  };

  function saveOpportunities(records = state.opportunities) {
    state.opportunities = records.map(normalizeOpportunity);
    repository.save(state.opportunities);
  }

  function isAttention(record) {
    return (record.stage === "Applied" || record.stage === "Interview") && calendarDaysSince(record.stageChangedAt) >= 14;
  }

  function attentionText(record) {
    const days = calendarDaysSince(record.stageChangedAt);
    return `${days} days in ${record.stage} — consider following up.`;
  }

  function dateValueLabel(value) {
    if (!value) return "Not set";
    const days = calendarDaysUntil(value);
    return `${formatDate(value)}${days !== null ? ` (${readableDateDelta(days)})` : ""}`;
  }

  function stageBadge(stage) {
    return `<span class="badge badge--${escapeAttr(stage)}">${escapeHtml(stage)}</span>`;
  }

  function demoBadge(record) {
    return record.isDemo ? '<span class="badge badge--demo">Fictional demo</span>' : "";
  }

  function emptyState(title, text, actionLabel, action) {
    return `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${actionLabel ? `<button class="button button--small" type="button" data-action="${action}">${escapeHtml(actionLabel)}</button>` : ""}</div>`;
  }

  function renderLanding() {
    app.innerHTML = `
      <div class="shell">
        <header class="site-header">
          <div class="container header-row">
            ${brand("landing")}
            <nav class="site-nav" aria-label="Main navigation">
              <a class="nav-link" href="#how-it-works">How it works</a>
              <button class="button button--small" type="button" data-action="open-app">Open your tracker</button>
            </nav>
          </div>
        </header>
        <main id="main-content">
          <section class="hero">
            <div class="container hero-grid">
              <div>
                <p class="eyebrow">A calmer way to make job-search progress</p>
                <h1>Turn every opportunity into a <em>clear next step.</em></h1>
                <p class="hero-copy">SAAY helps students, recent graduates, and job seekers organize opportunities, apply through official employer websites, track progress, and follow up with purpose.</p>
                <div class="hero-actions">
                  <button class="button" type="button" data-action="open-app">Start organizing opportunities</button>
                  <a class="button button--secondary" href="#how-it-works">See how it works</a>
                </div>
                <p class="trust-note">SAAY organizes decisions and applications. It does not submit applications, guarantee interviews, promise employment, or predict hiring outcomes.</p>
              </div>
              <div class="preview-card" aria-label="Illustration of SAAY tracker dashboard">
                <div class="preview-topline"><span class="preview-label">My next move</span><span class="badge badge--attention">Needs attention</span></div>
                <div class="preview-metric">One clear action</div>
                <div class="preview-list">
                  <div class="preview-row"><div><strong>Graduate Product Intern</strong><span>Northstar Studio · 14 days in Applied</span></div><span class="badge badge--attention">Follow up</span></div>
                  <div class="preview-row"><div><strong>Cooperative Training</strong><span>Harbor Labs · Closing tomorrow</span></div><span class="badge badge--Saved">Complete</span></div>
                  <div class="preview-row"><div><strong>People Ops Coordinator</strong><span>Cedar & Co. · Interview in 2 days</span></div><span class="badge badge--Interview">Prepare</span></div>
                </div>
              </div>
            </div>
          </section>
          <section class="page-section" aria-labelledby="features-title">
            <div class="container"><p class="eyebrow">Built for your real workflow</p><h2 class="section-heading" id="features-title">Keep momentum without losing sight of what matters to you.</h2>
              <div class="feature-grid">
                <article class="feature-card"><span class="feature-number">01</span><h3>Track applications</h3><p>Keep saved opportunities, submitted applications, stages, dates, and notes in one clear place.</p></article>
                <article class="feature-card"><span class="feature-number">02</span><h3>Assess opportunities</h3><p>Review how a role matches your own profile and preferences—without a hiring prediction.</p></article>
                <article class="feature-card"><span class="feature-number">03</span><h3>Stay on top of follow-ups</h3><p>See when an application may need attention and keep your own reminder history.</p></article>
              </div>
            </div>
          </section>
          <section class="page-section" id="how-it-works" aria-labelledby="how-title">
            <div class="container"><p class="eyebrow">A simple, purposeful flow</p><h2 class="section-heading" id="how-title">From a promising role to your next move.</h2>
              <div class="steps"><article class="step"><h3>Assess & save</h3><p>Review the role against your needs and save it when it feels worth pursuing.</p></article><article class="step"><h3>Apply officially</h3><p>Use the official employer link. SAAY never submits an application for you.</p></article><article class="step"><h3>Track & follow up</h3><p>Update progress, record follow-ups, and act on reminders when they matter.</p></article></div>
            </div>
          </section>
        </main>
        <footer class="site-footer"><div class="container footer-row"><span>SAAY (سعي) — purposeful job-search progress.</span><span>Browser-only prototype · your data stays on this device.</span></div></footer>
      </div>`;
  }

  function brand(currentView) {
    return `<a class="brand" href="#" data-action="go-landing" aria-label="SAAY home"><span>SAAY</span><span class="brand__arabic" lang="ar" dir="rtl">سعي</span></a>`;
  }

  function renderApp() {
    const view = state.view === "landing" ? "dashboard" : state.view;
    app.innerHTML = `
      <div class="app-shell">
        <header class="app-header"><div class="container app-header-row">
          ${brand(view)}
          <nav class="app-nav" aria-label="App navigation">
            ${navButton("dashboard", "Overview", view)}
            ${navButton("tracker", "Tracker", view)}
            ${navButton("assessment", "Fit assessment", view)}
          </nav>
          <button class="button button--small" type="button" data-action="add-opportunity">Add opportunity</button>
        </div></header>
        <main id="main-content" class="app-main"><div class="container">${view === "dashboard" ? renderDashboard() : view === "tracker" ? renderTracker() : renderAssessment()}</div></main>
      </div>`;
    maybeShowSharePrompt();
  }

  function navButton(view, label, current) {
    return `<button type="button" data-action="navigate" data-view="${view}" ${current === view ? 'aria-current="page"' : ""}>${label}</button>`;
  }

  function recordsByRecent(records) {
    return [...records].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  function getDueReminders() {
    return state.opportunities.filter(record => record.nextReminderDate && calendarDaysUntil(record.nextReminderDate) <= 3).sort((a, b) => calendarDaysUntil(a.nextReminderDate) - calendarDaysUntil(b.nextReminderDate));
  }

  function getNextMoves() {
    const moves = [];
    state.opportunities.forEach(record => {
      const closing = calendarDaysUntil(record.closingDate);
      const interview = calendarDaysUntil(record.interviewDate);
      const expected = calendarDaysUntil(record.expectedResponseDate);
      const reminder = calendarDaysUntil(record.nextReminderDate);
      if (record.stage === "Saved" && closing !== null && closing >= 0 && closing <= 1) {
        moves.push({ priority: 1, kind: "deadline", record, heading: `${record.company}: complete your application`, text: `The fictional or saved closing date is ${readableDateDelta(closing)}. Review requirements and tailor your CV.`, action: "view" });
      }
      if (record.stage === "Interview" && interview !== null && interview >= 0 && interview <= 2) {
        moves.push({ priority: 2, kind: "interview", record, heading: `${record.company}: prepare for your interview`, text: `Your interview is ${readableDateDelta(interview)}. Prepare relevant skill examples and questions.`, action: "view" });
      }
      if (reminder !== null && reminder <= 0) {
        moves.push({ priority: 3, kind: "reminder", record, heading: `${record.company}: reminder due`, text: `Your next reminder was scheduled for ${formatDate(record.nextReminderDate)}. Review the application and record a follow-up if you take one.`, action: "view" });
      } else if (expected !== null && expected >= 0 && expected <= 2) {
        moves.push({ priority: 4, kind: "expected", record, heading: `${record.company}: expected response soon`, text: `You expected an update ${readableDateDelta(expected)}. Set a reminder around this date if you need one.`, action: "view" });
      }
      if (isAttention(record)) {
        moves.push({ priority: 5, kind: "attention", record, heading: `${record.company}: consider a follow-up`, text: attentionText(record), action: "followup" });
      }
    });
    return moves.sort((a, b) => a.priority - b.priority).slice(0, 5);
  }

  function renderDashboard() {
    const records = state.opportunities;
    const active = records.filter(record => ACTIVE_STAGES.includes(record.stage)).length;
    const interviews = records.filter(record => record.stage === "Interview").length;
    const offers = records.filter(record => record.stage === "Offer").length;
    const attention = records.filter(isAttention).length;
    const moves = getNextMoves();
    const reminders = getDueReminders();
    const hasDemo = records.some(record => record.isDemo);
    return `
      <section aria-labelledby="overview-title">
        <div class="app-page-header"><div><p class="eyebrow">Your job-search home</p><h1 id="overview-title">Make your next move clear.</h1><p>Track what matters, see what needs attention, and take the next step on your terms.</p></div><button type="button" class="button" data-action="add-opportunity">Add opportunity</button></div>
        ${hasDemo ? demoBanner() : ""}
        <div class="metric-grid" aria-label="Application summary">
          ${metricCard("Active applications", active, "Applied, assessments, interviews, and offers")}
          ${metricCard("Interviews", interviews, interviews ? "Prepare your next conversation" : "No interviews scheduled")}
          ${metricCard("Offers", offers, offers ? "Compare them with your priorities" : "No offers recorded")}
          ${metricCard("Needs attention", attention, attention ? "Applied or Interview for 14+ days" : "No 14-day waits right now")}
        </div>
        <div class="dashboard-grid">
          <section class="panel" aria-labelledby="next-move-title"><div class="panel__header"><div><h2 id="next-move-title">My Next Move</h2><p>Useful actions based on your dates, reminders, and application stage.</p></div><button type="button" class="button button--text" data-action="navigate" data-view="tracker">View tracker</button></div><div class="panel__content">${moves.length ? moves.map(renderNextMove).join("") : emptyState("Nothing urgent right now", "Add an opportunity or a reminder to see focused next-step guidance here.", "Add opportunity", "add-opportunity")}</div></section>
          <div class="mini-list">
            <section class="panel" aria-labelledby="recent-title"><div class="panel__header"><div><h2 id="recent-title">Recent applications</h2><p>Your latest records.</p></div></div><div class="panel__content">${records.length ? recordsByRecent(records).slice(0, 4).map(renderMiniRecord).join("") : emptyState("No records yet", "Start with one opportunity you want to keep organized.", "Add opportunity", "add-opportunity")}</div></section>
            <section class="panel" aria-labelledby="reminders-title"><div class="panel__header"><div><h2 id="reminders-title">Upcoming follow-ups</h2><p>In-app only—nothing is sent automatically.</p></div></div><div class="panel__content">${reminders.length ? reminders.slice(0, 4).map(renderReminder).join("") : '<p class="section-copy">No follow-up reminders are due in the next three days.</p>'}</div></section>
          </div>
        </div>
      </section>`;
  }

  function demoBanner() {
    return `<div class="demo-banner"><span aria-hidden="true">ⓘ</span><div><strong>Fictional demo data is visible.</strong> These examples are made up to demonstrate the tracker. Your records are saved only in this browser and do not sync across devices. <button class="button--text" type="button" data-action="clear-data">Clear all data</button></div></div>`;
  }

  function metricCard(label, value, hint) { return `<article class="metric-card"><div class="metric-card__label">${label}</div><div class="metric-card__value">${value}</div><div class="metric-card__hint">${hint}</div></article>`; }

  function renderNextMove(move) {
    const attention = move.kind === "attention";
    return `<article class="next-card"><div class="next-card__topline"><span class="priority-label ${attention ? "priority-label--attention" : ""}">${attention ? "Needs attention" : "Next step"}</span>${stageBadge(move.record.stage)}</div><h3>${escapeHtml(move.heading)}</h3><p>${escapeHtml(move.text)}</p><div class="next-card__actions"><button type="button" class="button button--small" data-action="view-record" data-id="${move.record.id}">${move.action === "followup" ? "Record follow-up" : "View details"}</button>${move.action === "followup" ? `<button type="button" class="button button--secondary button--small" data-action="open-copy" data-id="${move.record.id}">Copy follow-up message</button>` : ""}</div></article>`;
  }

  function renderMiniRecord(record) {
    return `<div class="record-row"><div><strong>${escapeHtml(record.title)}</strong><span>${escapeHtml(record.company)} · ${escapeHtml(record.opportunityType)}</span></div><button type="button" class="button button--text" data-action="view-record" data-id="${record.id}">View</button></div>`;
  }

  function renderReminder(record) {
    const days = calendarDaysUntil(record.nextReminderDate);
    return `<div class="record-row"><div><strong>${escapeHtml(record.company)}</strong><span>Reminder ${readableDateDelta(days)} · ${escapeHtml(record.title)}</span></div><button type="button" class="button button--text" data-action="view-record" data-id="${record.id}">Open</button></div>`;
  }

  function filteredRecords() {
    const query = state.query.trim().toLowerCase();
    const records = state.opportunities.filter(record => {
      const matchesQuery = !query || [record.company, record.title, record.opportunityType, record.notes].join(" ").toLowerCase().includes(query);
      return matchesQuery && (state.stageFilter === "All" || record.stage === state.stageFilter) && (state.typeFilter === "All" || record.opportunityType === state.typeFilter);
    });
    return records.sort((a, b) => {
      if (state.sort === "oldest-stage") return calendarDaysSince(b.stageChangedAt) - calendarDaysSince(a.stageChangedAt);
      if (state.sort === "applied") return (toDate(b.applicationDate)?.getTime() || 0) - (toDate(a.applicationDate)?.getTime() || 0);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  function renderTracker() {
    const records = filteredRecords();
    const saved = records.filter(record => record.stage === "Saved");
    const active = records.filter(record => record.stage !== "Saved");
    return `<section aria-labelledby="tracker-title">
      <div class="app-page-header"><div><p class="eyebrow">Application tracker</p><h1 id="tracker-title">Every opportunity, in one honest view.</h1><p>Saved opportunities stay separate until you apply. Update progress, record your follow-ups, and keep your official links close.</p></div><button type="button" class="button" data-action="add-opportunity">Add opportunity</button></div>
      ${state.opportunities.some(record => record.isDemo) ? demoBanner() : ""}
      <div class="tracker-toolbar" aria-label="Tracker filters"><div class="filter-group"><label class="sr-only" for="search-records">Search records</label><input class="input search-input" id="search-records" type="search" value="${escapeAttr(state.query)}" placeholder="Search company, title, type, or notes" data-filter="query"><label class="sr-only" for="stage-filter">Filter by stage</label><select id="stage-filter" class="select" data-filter="stage"><option value="All">All stages</option>${STAGES.map(stage => `<option ${state.stageFilter === stage ? "selected" : ""} value="${stage}">${stage}</option>`).join("")}</select><label class="sr-only" for="type-filter">Filter by type</label><select id="type-filter" class="select" data-filter="type"><option value="All">All types</option>${TYPES.map(type => `<option ${state.typeFilter === type ? "selected" : ""} value="${type}">${type}</option>`).join("")}</select><label class="sr-only" for="sort-records">Sort records</label><select id="sort-records" class="select" data-filter="sort"><option value="updated" ${state.sort === "updated" ? "selected" : ""}>Recently updated</option><option value="oldest-stage" ${state.sort === "oldest-stage" ? "selected" : ""}>Longest in stage</option><option value="applied" ${state.sort === "applied" ? "selected" : ""}>Application date</option></select></div><button class="button button--secondary button--small" type="button" data-action="load-samples">Load example data</button></div>
      <section class="tracker-section" aria-labelledby="saved-title"><div class="tracker-section__heading"><div><h2 id="saved-title">Saved opportunities</h2><p>Roles you are considering, before you submit an application.</p></div><span class="badge badge--Saved">${saved.length} saved</span></div>${saved.length ? `<div class="record-list">${saved.map(renderRecord).join("")}</div>` : emptyState("No saved opportunities", "Save a role you want to assess or apply to later.", "Add saved opportunity", "add-opportunity")}</section>
      <section class="tracker-section" aria-labelledby="applications-title"><div class="tracker-section__heading"><div><h2 id="applications-title">Applications & progress</h2><p>Submitted applications, assessments, interviews, offers, and outcomes.</p></div><span class="badge badge--Applied">${active.length} records</span></div>${active.length ? `<div class="record-list">${active.map(renderRecord).join("")}</div>` : emptyState("No applications in progress", "When you apply through an employer website, update the record here.", "Add opportunity", "add-opportunity")}</section>
    </section>`;
  }

  function renderRecord(record) {
    const waiting = isAttention(record);
    return `<article class="record-card"><div class="record-main"><div class="record-title-row"><h3 class="record-title">${escapeHtml(record.title)}</h3>${stageBadge(record.stage)}${demoBadge(record)}${waiting ? '<span class="badge badge--attention">Needs attention</span>' : ""}</div><p class="record-company">${escapeHtml(record.company)}</p><div class="record-meta"><span>${escapeHtml(record.opportunityType)}</span><span>${record.applicationDate ? `Applied ${formatDate(record.applicationDate)}` : "Not applied yet"}</span><span>Stage updated ${formatDate(record.stageChangedAt)}</span>${record.nextReminderDate ? `<span>Reminder ${dateValueLabel(record.nextReminderDate)}</span>` : ""}</div>${waiting ? `<p class="attention-message"><span class="attention-dot" aria-hidden="true"></span>${escapeHtml(attentionText(record))}</p>` : ""}</div><div class="record-actions"><button type="button" class="button button--secondary button--small" data-action="view-record" data-id="${record.id}">View</button>${record.officialUrl ? `<button type="button" class="button button--small" data-action="apply-link" data-id="${record.id}">Employer website</button>` : ""}</div></article>`;
  }

  function renderAssessment() {
    const profile = repository.profile();
    return `<section aria-labelledby="assessment-title"><div class="app-page-header"><div><p class="eyebrow">Does this opportunity fit me?</p><h1 id="assessment-title">Review a role with your own context.</h1><p>Use pasted text and your reviewed profile to surface matches, unknowns, and questions to verify. This is not a hiring prediction.</p></div></div>
      <div class="assessment-layout"><section class="assessment-card"><h2>Your profile & preferences</h2><p>Keep this accurate. SAAY does not read LinkedIn or upload your information anywhere.</p>${profileForm(profile)}</section><section class="assessment-card"><h2>Opportunity details</h2><p>Paste the official role description. PDF extraction is not included; use pasted text or manual notes instead.</p>${assessmentForm()}</section></div></section>`;
  }

  function profileForm(profile) {
    return `<form id="profile-form"><div class="form-grid"><div class="field"><label for="profile-education">Education / field of study</label><input class="input" id="profile-education" name="education" value="${escapeAttr(profile.education || "")}"></div><div class="field"><label for="profile-status">Student or graduate status</label><select class="select" id="profile-status" name="status"><option value="">Choose if helpful</option>${["Student", "Recent graduate", "Graduate", "Other"].map(value => `<option value="${value}" ${(profile.status || "") === value ? "selected" : ""}>${value}</option>`).join("")}</select></div><div class="field field--full"><label for="profile-experience">Experience</label><textarea class="textarea" id="profile-experience" name="experience" placeholder="Paste a short, accurate summary of experience.">${escapeHtml(profile.experience || "")}</textarea></div><div class="field field--full"><label for="profile-skills">Skills</label><input class="input" id="profile-skills" name="skills" value="${escapeAttr(profile.skills || "")}" placeholder="e.g. research, Excel, communication"></div><div class="field"><label for="profile-type">Desired opportunity type</label><select class="select" id="profile-type" name="desiredType"><option value="">No preference set</option>${TYPES.map(value => `<option value="${value}" ${(profile.desiredType || "") === value ? "selected" : ""}>${value}</option>`).join("")}</select></div><div class="field"><label for="profile-roles">Preferred roles / fields</label><input class="input" id="profile-roles" name="roles" value="${escapeAttr(profile.roles || "")}"></div><div class="field"><label for="profile-locations">Preferred locations</label><input class="input" id="profile-locations" name="locations" value="${escapeAttr(profile.locations || "")}"></div><div class="field"><label for="profile-workstyle">Work style / relocation</label><input class="input" id="profile-workstyle" name="workstyle" value="${escapeAttr(profile.workstyle || "")}" placeholder="e.g. remote, willing to relocate"></div><div class="field"><label for="profile-availability">Availability to start</label><input class="input" id="profile-availability" name="availability" value="${escapeAttr(profile.availability || "")}"></div><div class="field"><label for="profile-linkedin">LinkedIn URL <span class="field-help">(reference only)</span></label><input class="input" id="profile-linkedin" name="linkedin" type="url" value="${escapeAttr(profile.linkedin || "")}" placeholder="https://..."></div></div><div class="form-actions"><button type="submit" class="button button--secondary">Save profile</button></div></form>`;
  }

  function assessmentForm() {
    return `<form id="assessment-form"><div class="form-grid"><div class="field"><label for="assess-company">Company name <span class="required">*</span></label><input class="input" id="assess-company" name="company" required></div><div class="field"><label for="assess-title">Job title <span class="required">*</span></label><input class="input" id="assess-title" name="title" required></div><div class="field"><label for="assess-type">Opportunity type</label><select class="select" id="assess-type" name="opportunityType">${TYPES.map(type => `<option value="${type}">${type}</option>`).join("")}</select></div><div class="field"><label for="assess-url">Official opportunity link</label><input class="input" id="assess-url" name="officialUrl" type="url" placeholder="https://employer.example/role"></div><div class="field field--full"><label for="assess-description">Pasted job description <span class="required">*</span></label><textarea class="textarea" id="assess-description" name="description" required placeholder="Paste role requirements, responsibilities, and qualifications here."></textarea><small>Use text you can review. SAAY does not extract PDFs or read LinkedIn profiles.</small></div></div><div class="form-actions"><button type="submit" class="button">Review opportunity</button></div></form><div id="assessment-result"></div>`;
  }

  function openDialog(content, label) {
    const existing = document.getElementById("modal-dialog");
    if (existing) existing.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "modal-dialog";
    dialog.className = "dialog";
    dialog.setAttribute("aria-label", label);
    dialog.innerHTML = `<div class="dialog__inner">${content}</div>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove());
    dialog.showModal();
    const focusTarget = dialog.querySelector("[autofocus], input, button, select, textarea");
    if (focusTarget) window.setTimeout(() => focusTarget.focus(), 30);
  }

  function closeDialog() {
    const dialog = document.getElementById("modal-dialog");
    if (dialog) dialog.close();
  }

  function opportunityForm(record = null) {
    const current = record || { stage: "Saved", opportunityType: "Internship", applicationDate: "", stageChangedAt: isoDate(), officialUrl: "", notes: "", closingDate: "", interviewDate: "", expectedResponseDate: "", nextReminderDate: "" };
    const edit = Boolean(record);
    return `<div class="modal-header"><h2>${edit ? "Edit opportunity" : "Add an opportunity"}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="Close dialog">×</button></div><div class="modal-body"><form id="opportunity-form" data-record-id="${record ? record.id : ""}" novalidate><div class="error-summary" id="form-errors" tabindex="-1"><p>Review the highlighted fields.</p><ul></ul></div><div class="form-grid"><div class="field"><label for="company">Company name <span class="required">*</span></label><input class="input" id="company" name="company" required value="${escapeAttr(current.company || "")}"><span class="field-error" data-error-for="company"></span></div><div class="field"><label for="title">Job title <span class="required">*</span></label><input class="input" id="title" name="title" required value="${escapeAttr(current.title || "")}"><span class="field-error" data-error-for="title"></span></div><div class="field"><label for="opportunityType">Opportunity type <span class="required">*</span></label><select class="select" id="opportunityType" name="opportunityType">${TYPES.map(type => `<option value="${type}" ${current.opportunityType === type ? "selected" : ""}>${type}</option>`).join("")}</select></div><div class="field"><label for="stage">Application stage <span class="required">*</span></label><select class="select" id="stage" name="stage">${STAGES.map(stage => `<option value="${stage}" ${current.stage === stage ? "selected" : ""}>${stage}</option>`).join("")}</select><small>Changing the stage resets its waiting time from today.</small></div><div class="field field--full"><label for="officialUrl">Official opportunity link</label><input class="input" id="officialUrl" name="officialUrl" type="url" value="${escapeAttr(current.officialUrl || "")}" placeholder="https://employer.example/role"><small>SAAY opens this link but never submits an application for you.</small><span class="field-error" data-error-for="officialUrl"></span></div><div class="field"><label for="applicationDate">Application date</label><input class="input" id="applicationDate" name="applicationDate" type="date" value="${escapeAttr(current.applicationDate || "")}"><small>Stored separately from the stage change date.</small></div><div class="field"><label for="stageChangedAt">Stage changed on</label><input class="input" id="stageChangedAt" name="stageChangedAt" type="date" value="${escapeAttr(current.stageChangedAt || isoDate())}" ${edit ? "readonly" : ""}><small>${edit ? "Updated automatically when you change the stage." : "Set this for a historical record."}</small></div><div class="field"><label for="closingDate">Closing date <span class="field-help">(optional)</span></label><input class="input" id="closingDate" name="closingDate" type="date" value="${escapeAttr(current.closingDate || "")}"></div><div class="field"><label for="interviewDate">Interview date <span class="field-help">(optional)</span></label><input class="input" id="interviewDate" name="interviewDate" type="date" value="${escapeAttr(current.interviewDate || "")}"></div><div class="field"><label for="expectedResponseDate">Expected response date <span class="field-help">(optional)</span></label><input class="input" id="expectedResponseDate" name="expectedResponseDate" type="date" value="${escapeAttr(current.expectedResponseDate || "")}"></div><div class="field"><label for="nextReminderDate">Next reminder <span class="field-help">(optional)</span></label><input class="input" id="nextReminderDate" name="nextReminderDate" type="date" value="${escapeAttr(current.nextReminderDate || "")}"></div><div class="field field--full"><label for="notes">Notes <span class="field-help">(optional)</span></label><textarea class="textarea" id="notes" name="notes" placeholder="Keep a short, useful note for yourself.">${escapeHtml(current.notes || "")}</textarea></div></div><div class="form-actions">${edit ? `<button type="button" class="button button--danger" data-action="confirm-delete" data-id="${record.id}">Delete</button>` : ""}<button type="button" class="button button--secondary" data-action="close-dialog">Cancel</button><button type="submit" class="button">${edit ? "Save changes" : "Save opportunity"}</button></div></form></div>`;
  }

  function recordDetail(record) {
    const attention = isAttention(record);
    const history = record.followUpHistory.length ? record.followUpHistory.map(item => `<li class="history-item"><strong>Follow-up completed ${formatDate(item.completedAt)}</strong>${item.note ? `<br>${escapeHtml(item.note)}` : ""}</li>`).join("") : "<li class=\"history-item\">No completed follow-ups yet.</li>";
    return `<div class="modal-header"><h2>${escapeHtml(record.title)}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="Close dialog">×</button></div><div class="modal-body"><section class="detail-section"><div class="detail-header"><div><p class="record-company">${escapeHtml(record.company)}</p></div><div>${stageBadge(record.stage)} ${demoBadge(record)}</div></div>${attention ? `<p class="attention-message"><span class="attention-dot" aria-hidden="true"></span>${escapeHtml(attentionText(record))}</p>` : ""}<div class="detail-grid" style="margin-top:14px"><div class="detail-data"><span>Type</span><strong>${escapeHtml(record.opportunityType)}</strong></div><div class="detail-data"><span>Application date</span><strong>${formatDate(record.applicationDate)}</strong></div><div class="detail-data"><span>Stage changed</span><strong>${formatDate(record.stageChangedAt)}</strong></div></div></section><section class="detail-section"><h3>Suggested next step</h3><p class="guidance">${escapeHtml(stageAdvice[record.stage])}</p></section>${record.notes ? `<section class="detail-section"><h3>Your notes</h3><p>${escapeHtml(record.notes)}</p></section>` : ""}<section class="detail-section"><h3>Dates & reminders</h3><div class="detail-grid"><div class="detail-data"><span>Closing</span><strong>${dateValueLabel(record.closingDate)}</strong></div><div class="detail-data"><span>Interview</span><strong>${dateValueLabel(record.interviewDate)}</strong></div><div class="detail-data"><span>Next reminder</span><strong>${dateValueLabel(record.nextReminderDate)}</strong></div></div></section><section class="detail-section"><h3>Follow-up history</h3><p>Complete a follow-up to keep it out of unfinished tasks. This only records your action; SAAY never sends anything.</p><form id="followup-form" class="followup-form" data-id="${record.id}"><label class="sr-only" for="followup-note">Follow-up note</label><input class="input" id="followup-note" name="note" placeholder="Optional note, e.g. sent a polite check-in"><button class="button button--small" type="submit">Mark follow-up complete</button></form><ul class="followup-history">${history}</ul>${attention ? `<div style="margin-top:14px"><button type="button" class="button button--secondary button--small" data-action="open-copy" data-id="${record.id}">Copy follow-up message</button></div>` : ""}</section><section class="detail-section"><div class="form-actions">${record.officialUrl ? `<button type="button" class="button" data-action="apply-link" data-id="${record.id}">Apply on employer website</button>` : ""}<button type="button" class="button button--secondary" data-action="edit-record" data-id="${record.id}">Edit opportunity</button></div></section></div>`;
  }

  function openCopyDialog(record) {
    const message = `Hello ${record.company} team,\n\nI hope you are well. I am writing to follow up on my application for the ${record.title} position. I remain interested in the opportunity and would appreciate any update you can share about the process.\n\nThank you for your time,\n[Your name]`;
    openDialog(`<div class="modal-header"><h2>Follow-up message</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="Close dialog">×</button></div><div class="modal-body"><p class="section-copy">Edit this before copying if needed. SAAY only copies text—it never sends email.</p><textarea class="copy-area" id="copy-message">${escapeHtml(message)}</textarea><div class="form-actions"><button type="button" class="button button--secondary" data-action="close-dialog">Cancel</button><button type="button" class="button" data-action="copy-message">Copy message</button></div></div>`, "Copy follow-up message");
  }

  function validateOpportunity(formData) {
    const errors = {};
    if (!formData.company.trim()) errors.company = "Enter the company name.";
    if (!formData.title.trim()) errors.title = "Enter the job title.";
    if (formData.officialUrl) {
      try {
        const url = new URL(formData.officialUrl);
        if (!/^https?:$/.test(url.protocol)) errors.officialUrl = "Use an http or https web address.";
      } catch { errors.officialUrl = "Enter a complete web address, such as https://employer.example/role."; }
    }
    return errors;
  }

  function showFormErrors(errors) {
    const summary = document.getElementById("form-errors");
    if (!summary) return;
    Object.keys(errors).forEach(name => {
      const message = document.querySelector(`[data-error-for="${name}"]`);
      const field = document.querySelector(`[name="${name}"]`);
      if (message) message.textContent = errors[name];
      if (field) field.setAttribute("aria-invalid", "true");
    });
    if (Object.keys(errors).length) {
      summary.classList.add("is-visible");
      summary.querySelector("ul").innerHTML = Object.entries(errors).map(([name, message]) => `<li><a href="#${name}">${escapeHtml(message)}</a></li>`).join("");
      summary.focus();
    }
  }

  function getRecord(id) { return state.opportunities.find(record => record.id === id); }

  function saveOpportunityFromForm(form) {
    const formData = Object.fromEntries(new FormData(form).entries());
    const errors = validateOpportunity(formData);
    document.querySelectorAll("[data-error-for]").forEach(element => { element.textContent = ""; });
    document.querySelectorAll("[aria-invalid]").forEach(element => element.removeAttribute("aria-invalid"));
    const summary = document.getElementById("form-errors");
    if (summary) summary.classList.remove("is-visible");
    if (Object.keys(errors).length) { showFormErrors(errors); return; }
    const recordId = form.dataset.recordId;
    const existing = recordId ? getRecord(recordId) : null;
    const now = new Date().toISOString();
    const stageChanged = !existing || existing.stage !== formData.stage;
    const updated = normalizeOpportunity({
      ...(existing || {}),
      ...formData,
      id: existing?.id || uid("opportunity"),
      isDemo: existing?.isDemo || false,
      // A new historical/demo record may use the entered date; any later stage change resets the timer to today.
      stageChangedAt: existing ? (stageChanged ? isoDate() : existing.stageChangedAt) : (formData.stageChangedAt || isoDate()),
      followUpHistory: existing?.followUpHistory || [],
      assessment: existing?.assessment || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    });
    saveOpportunities(existing ? state.opportunities.map(record => record.id === existing.id ? updated : record) : [...state.opportunities, updated]);
    closeDialog();
    renderApp();
    showToast(existing ? "Opportunity updated." : "Opportunity saved.");
    if (!existing && !localStorage.getItem(SHARED_KEY) && !updated.isDemo) showSharePrompt();
  }

  function renderAssessmentResult(data) {
    const profile = repository.profile();
    const description = data.description.toLowerCase();
    const skills = (profile.skills || "").split(/[;,]/).map(value => value.trim()).filter(Boolean);
    const matches = skills.filter(skill => description.includes(skill.toLowerCase()));
    const mandatoryLines = extractRelevantLines(data.description, /\b(must|required|eligib|minimum|mandatory)\b/i);
    const preferredLines = extractRelevantLines(data.description, /\b(preferred|nice to have|bonus|plus)\b/i);
    const unknowns = [];
    if (!profile.education) unknowns.push("Education or field of study is not set in your reviewed profile.");
    if (!profile.status) unknowns.push("Student or graduate status is not set in your reviewed profile.");
    if (!profile.availability) unknowns.push("Availability to start is not set in your reviewed profile.");
    const preferenceNotes = [];
    if (profile.desiredType && profile.desiredType !== data.opportunityType) preferenceNotes.push(`Your desired type is ${profile.desiredType}, while this role is ${data.opportunityType}.`);
    if (profile.locations && !description.includes(profile.locations.toLowerCase())) preferenceNotes.push("The description does not clearly confirm your preferred location(s)—verify this with the employer.");
    const result = {
      profile,
      description: data.description,
      findings: { matches, mandatoryLines, preferredLines, unknowns, preferenceNotes },
      createdAt: new Date().toISOString()
    };
    state.assessmentDraft = { ...data, assessment: result };
    document.getElementById("assessment-result").innerHTML = `<div class="assessment-result" aria-live="polite"><div class="finding"><h3>Relevant matches</h3>${matches.length ? `<ul>${matches.map(item => `<li>${escapeHtml(item)} appears in both your skills and the description.</li>`).join("")}</ul>` : "<p>No direct skill match was found from the skills you entered. This can mean the wording differs or that you need to review the role yourself.</p>"}</div><div class="finding"><h3>Mandatory or eligibility conditions</h3>${mandatoryLines.length ? `<ul>${mandatoryLines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "<p>No explicit mandatory condition was automatically identified. Read the full description and verify with the employer.</p>"}</div><div class="finding"><h3>Preferred qualifications</h3>${preferredLines.length ? `<ul>${preferredLines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "<p>No preferred qualification was automatically identified from the pasted text.</p>"}</div><div class="finding"><h3>Preferences or details to verify</h3>${[...preferenceNotes, ...unknowns].length ? `<ul>${[...preferenceNotes, ...unknowns].map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "<p>Your profile has useful detail, but you should still verify location, eligibility, and timelines from the official posting.</p>"}</div><p class="disclaimer"><strong>Your review, not a prediction.</strong> These findings use only the text and profile information you entered. Unknown information remains unknown. Add skills or experience only when they accurately reflect your background.</p><div class="form-actions"><button type="button" class="button" data-action="save-assessed">Save assessed opportunity to tracker</button>${data.officialUrl ? '<button type="button" class="button button--secondary" data-action="open-assessment-link">Open employer website</button>' : ""}</div></div>`;
    announce("Opportunity review is ready.");
  }

  function extractRelevantLines(text, pattern) {
    return text.split(/\n|(?<=[.!?])\s+/).map(line => line.trim()).filter(line => line && pattern.test(line)).slice(0, 4);
  }

  function saveAssessedOpportunity() {
    const draft = state.assessmentDraft;
    if (!draft) return;
    const now = new Date().toISOString();
    const record = normalizeOpportunity({
      id: uid("assessed"), isDemo: false, company: draft.company, title: draft.title, opportunityType: draft.opportunityType,
      officialUrl: draft.officialUrl, notes: "Saved from a SAAY opportunity review.", stage: "Saved", applicationDate: "", stageChangedAt: isoDate(),
      followUpHistory: [], assessment: draft.assessment, createdAt: now, updatedAt: now
    });
    saveOpportunities([...state.opportunities, record]);
    state.view = "tracker";
    renderApp();
    showToast("Assessed opportunity saved to your tracker.");
    if (!localStorage.getItem(SHARED_KEY)) showSharePrompt();
  }

  function showSharePrompt() {
    if (localStorage.getItem(SHARED_KEY) || document.querySelector(".share-prompt")) return;
    const prompt = document.createElement("aside");
    prompt.className = "share-prompt";
    prompt.setAttribute("aria-label", "Optional sharing prompt");
    prompt.innerHTML = `<h2>You’ve taken your first step with SAAY.</h2><p>Know someone navigating their job search? Share SAAY and help them organize their next steps.</p><div class="share-actions"><button type="button" class="button button--small" data-action="share-saay">Share SAAY</button><button type="button" class="button button--secondary button--small" data-action="dismiss-share">Maybe later</button></div>`;
    document.body.append(prompt);
  }

  function maybeShowSharePrompt() { /* prompt is only triggered after a first user record is saved */ }

  async function shareSaay() {
    const shareText = "SAAY (سعي) helps job seekers organize opportunities and next steps.";
    try {
      if (navigator.share) await navigator.share({ title: "SAAY", text: shareText });
      else if (navigator.clipboard) await navigator.clipboard.writeText(shareText);
      else window.prompt("Copy this message to share SAAY:", shareText);
      showToast("SAAY sharing message is ready—no application data was included.");
    } catch (error) {
      if (error.name !== "AbortError") showToast("Sharing was not completed. Your application data remains private.");
    }
    dismissShare();
  }

  function dismissShare() {
    localStorage.setItem(SHARED_KEY, "true");
    document.querySelector(".share-prompt")?.remove();
  }

  async function copyMessage() {
    const area = document.getElementById("copy-message");
    if (!area) return;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(area.value);
      else { area.select(); document.execCommand("copy"); }
      showToast("Follow-up message copied. SAAY did not send anything.");
    } catch { showToast("Copy was not available. Select the message and copy it manually."); }
  }

  function applyEmployerLink(record) {
    if (!record?.officialUrl) return;
    try {
      const url = new URL(record.officialUrl);
      if (!/^https?:$/.test(url.protocol)) throw new Error("invalid protocol");
      window.open(url.href, "_blank", "noopener,noreferrer");
      showToast("Opening the employer website. SAAY does not submit applications.");
    } catch { showToast("This opportunity link is not a valid web address."); }
  }

  function confirmDelete(id) {
    const record = getRecord(id);
    if (!record) return;
    const allowed = window.confirm(`Delete ${record.title} at ${record.company}? This cannot be undone.`);
    if (!allowed) return;
    saveOpportunities(state.opportunities.filter(item => item.id !== id));
    closeDialog();
    renderApp();
    showToast("Opportunity deleted.");
  }

  function completeFollowUp(form) {
    const record = getRecord(form.dataset.id);
    if (!record) return;
    const note = String(new FormData(form).get("note") || "").trim();
    const updated = normalizeOpportunity({ ...record, followUpHistory: [...record.followUpHistory, { id: uid("follow-up"), completedAt: isoDate(), note }], nextReminderDate: "", updatedAt: new Date().toISOString() });
    saveOpportunities(state.opportunities.map(item => item.id === record.id ? updated : item));
    openDialog(recordDetail(updated), "Opportunity details");
    renderApp();
    showToast("Follow-up recorded and removed from unfinished reminders.");
  }

  function setView(view) {
    state.view = view;
    renderApp();
    const title = document.querySelector("#main-content h1");
    if (title) { title.setAttribute("tabindex", "-1"); title.focus({ preventScroll: true }); }
  }

  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const action = trigger.dataset.action;
    const id = trigger.dataset.id;
    if (action === "open-app") { state.view = "dashboard"; renderApp(); }
    if (action === "go-landing") { event.preventDefault(); state.view = "landing"; renderLanding(); }
    if (action === "navigate") setView(trigger.dataset.view);
    if (action === "add-opportunity") openDialog(opportunityForm(), "Add opportunity");
    if (action === "close-dialog") closeDialog();
    if (action === "view-record") { const record = getRecord(id); if (record) openDialog(recordDetail(record), "Opportunity details"); }
    if (action === "edit-record") { const record = getRecord(id); if (record) openDialog(opportunityForm(record), "Edit opportunity"); }
    if (action === "confirm-delete") confirmDelete(id);
    if (action === "apply-link") applyEmployerLink(getRecord(id));
    if (action === "load-samples") { state.opportunities = repository.loadSamples(); renderApp(); showToast("Fictional example data loaded."); }
    if (action === "clear-data") { if (window.confirm("Clear all records stored in this browser?")) { state.opportunities = repository.clear(); renderApp(); showToast("All browser-only records were cleared."); } }
    if (action === "open-copy") { const record = getRecord(id); if (record) openCopyDialog(record); }
    if (action === "copy-message") copyMessage();
    if (action === "save-assessed") saveAssessedOpportunity();
    if (action === "open-assessment-link") { if (state.assessmentDraft?.officialUrl) applyEmployerLink({ officialUrl: state.assessmentDraft.officialUrl }); }
    if (action === "share-saay") shareSaay();
    if (action === "dismiss-share") dismissShare();
  });

  document.addEventListener("input", event => {
    if (event.target.dataset.filter === "query") { state.query = event.target.value; renderApp(); document.getElementById("search-records")?.focus(); document.getElementById("search-records")?.setSelectionRange(state.query.length, state.query.length); }
  });

  document.addEventListener("change", event => {
    const filter = event.target.dataset.filter;
    if (!filter || filter === "query") return;
    if (filter === "stage") state.stageFilter = event.target.value;
    if (filter === "type") state.typeFilter = event.target.value;
    if (filter === "sort") state.sort = event.target.value;
    renderApp();
  });

  document.addEventListener("submit", event => {
    if (event.target.id === "opportunity-form") { event.preventDefault(); saveOpportunityFromForm(event.target); }
    if (event.target.id === "followup-form") { event.preventDefault(); completeFollowUp(event.target); }
    if (event.target.id === "profile-form") { event.preventDefault(); const profile = Object.fromEntries(new FormData(event.target).entries()); repository.saveProfile(profile); showToast("Your profile preferences were saved in this browser."); }
    if (event.target.id === "assessment-form") { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target).entries()); renderAssessmentResult(data); }
  });

  state.opportunities = repository.get();
  renderLanding();
})();
