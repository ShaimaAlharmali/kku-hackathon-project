(() => {
  "use strict";

  const STORAGE_KEY = "saay-opportunities-v1";
  const PROFILE_KEY = "saay-profile-v1";
  const SHARED_KEY = "saay-first-share-seen-v1";
  const DRAFT_KEY = "saay-assessment-draft-v1";
  const CV_LIMIT = 50000;
  const PDF_LIMIT = 8 * 1024 * 1024;
  const ENGINE = window.SAAYAssessmentEngine;
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
    assessmentStep: 1,
    assessmentDraft: null,
    storageNoticeShown: false
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

  function normalizeProfile(profile = {}) {
    const cv = profile.cv && typeof profile.cv === "object" ? profile.cv : { text: "", updatedAt: "" };
    return {
      schemaVersion: 2,
      updatedAt: profile.updatedAt || "",
      education: String(profile.education || ""),
      status: String(profile.status || ""),
      experience: String(profile.experience || ""),
      skills: String(profile.skills || ""),
      desiredType: String(profile.desiredType || ""),
      roles: String(profile.roles || ""),
      locations: String(profile.locations || ""),
      workstyle: String(profile.workstyle || ""),
      availability: String(profile.availability || ""),
      linkedin: String(profile.linkedin || ""),
      cv: { text: String(cv.text || "").slice(0, CV_LIMIT), updatedAt: String(cv.updatedAt || "") }
    };
  }

  function normalizeAssessment(assessment) {
    if (!assessment) return null;
    if (assessment.schemaVersion === 2) return assessment;
    return { ...assessment, schemaVersion: 1, status: "legacy" };
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
      assessment: normalizeAssessment(record.assessment),
      createdAt: record.createdAt || now,
      updatedAt: record.updatedAt || now
    };
  }

  const sessionStorageFallback = new Map();

  function showStorageNotice() {
    if (state.storageNoticeShown) return;
    state.storageNoticeShown = true;
    window.setTimeout(() => showToast("Browser storage is unavailable. Your changes will only last until this tab closes."), 0);
  }

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch { showStorageNotice(); return sessionStorageFallback.get(key) || null; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, value); } catch { sessionStorageFallback.set(key, value); showStorageNotice(); }
  }

  function removeStorage(key) {
    try { localStorage.removeItem(key); } catch { sessionStorageFallback.delete(key); showStorageNotice(); }
  }

  const repository = {
    get() {
      try {
        const saved = readStorage(STORAGE_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.map(normalizeOpportunity) : [];
      } catch { return []; }
    },
    save(records) {
      writeStorage(STORAGE_KEY, JSON.stringify(records));
    },
    loadSamples(existingRecords = []) {
      const samples = cloneSamples().map(normalizeOpportunity);
      const personalRecords = existingRecords.filter(record => !record.isDemo);
      const records = [...personalRecords, ...samples];
      this.save(records);
      return records;
    },
    clear() {
      this.save([]);
      return [];
    },
    profile() {
      try { return normalizeProfile(JSON.parse(readStorage(PROFILE_KEY)) || {}); } catch { return normalizeProfile({}); }
    },
    saveProfile(profile) {
      const normalized = normalizeProfile({ ...profile, updatedAt: new Date().toISOString() });
      writeStorage(PROFILE_KEY, JSON.stringify(normalized));
      return normalized;
    },
    clearProfile() {
      removeStorage(PROFILE_KEY);
      return normalizeProfile({});
    },
    shareSeen() { return Boolean(readStorage(SHARED_KEY)); },
    setShareSeen() { writeStorage(SHARED_KEY, "true"); },
    draft() {
      try { return JSON.parse(readStorage(DRAFT_KEY)) || null; } catch { return null; }
    },
    saveDraft(draft, step) {
      if (!draft) return;
      const { result, errorMessage, ...safeDraft } = draft;
      writeStorage(DRAFT_KEY, JSON.stringify({ draft: safeDraft, step }));
    },
    clearDraft() { removeStorage(DRAFT_KEY); }
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

  function emptyState(title, text, actionLabel, action, secondaryLabel = "", secondaryAction = "") {
    return `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${actionLabel ? `<div class="empty-state__actions"><button class="button button--small" type="button" data-action="${action}">${escapeHtml(actionLabel)}</button>${secondaryLabel ? `<button class="button button--secondary button--small" type="button" data-action="${secondaryAction}">${escapeHtml(secondaryLabel)}</button>` : ""}</div>` : ""}</div>`;
  }

  function renderLanding() {
    app.innerHTML = `
      <div class="shell">
        <header class="site-header">
          <div class="container header-row">
            ${brand("landing")}
            <nav class="site-nav" aria-label="Main navigation">
              <a class="nav-link" href="#how-it-works">How it works</a>
              <button class="button button--small" type="button" data-action="open-tracker">Track an existing application</button>
            </nav>
          </div>
        </header>
        <main id="main-content">
          <section class="hero hero--welcome">
            <div class="container welcome-layout">
              <div class="welcome-copy">
                <p class="eyebrow">SAAY for purposeful job-search progress</p>
                <h1>Understand the opportunity. Plan your next step.</h1>
                <p class="hero-copy">Compare a job posting with your background, identify matches and gaps, and keep your applications and follow-ups organized in one place.</p>
                <div class="hero-actions">
                  <button class="button" type="button" data-action="start-assessment">Check a job’s fit</button>
                  <button class="button button--text welcome-secondary" type="button" data-action="open-tracker">Track an existing application</button>
                </div>
                <p class="trust-note">SAAY helps you organize your decisions and applications. It does not submit applications, promise employment, guarantee interviews, or predict hiring outcomes.</p>
              </div>
              <aside class="welcome-steps" aria-labelledby="welcome-steps-title">
                <p class="eyebrow">A simple place to begin</p>
                <h2 id="welcome-steps-title">Your next career move, in 3 clear steps.</h2>
                <ol><li>Add your background.</li><li>Check the opportunity.</li><li>Track your next move.</li></ol>
              </aside>
            </div>
          </section>
          <section class="page-section how-it-works" id="how-it-works" aria-labelledby="how-title">
            <div class="container"><p class="eyebrow">How it works</p><h2 class="section-heading" id="how-title">A clear process, without an overwhelming dashboard first.</h2>
              <div class="steps"><article class="step"><h3>Add your background.</h3><p>Share only the information you want to use when reviewing an opportunity.</p></article><article class="step"><h3>Assess a job posting.</h3><p>Review clear matches, unknowns, and details you may need to verify.</p></article><article class="step"><h3>Save and track your next steps.</h3><p>Keep the opportunity, its status, and follow-ups together when you choose to apply.</p></article></div>
              <div class="welcome-demo"><p><strong>Want to explore first?</strong> Load clearly labelled fictional records without adding anything to your own tracker.</p><button class="button button--secondary" type="button" data-action="try-demo">Try a demo</button></div>
            </div>
          </section>
        </main>
        <footer class="site-footer"><div class="container footer-row"><span>SAAY (سَعْي) — purposeful job-search progress.</span><span>Browser-only prototype · your data stays on this device.</span></div></footer>
      </div>`;
  }

  function brand(currentView) {
    return `<a class="brand" href="#" data-action="go-landing" aria-label="SAAY home"><span class="brand__latin">SAAY</span><span class="brand__arabic" lang="ar" dir="rtl">سَعْي</span></a>`;
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
          <section class="panel" aria-labelledby="next-move-title"><div class="panel__header"><div><h2 id="next-move-title">My Next Move</h2><p>Useful actions based on your dates, reminders, and application stage.</p></div><button type="button" class="button button--text" data-action="navigate" data-view="tracker">View tracker</button></div><div class="panel__content">${moves.length ? moves.map(renderNextMove).join("") : emptyState("Nothing urgent right now", "Add an opportunity or a reminder to see focused next-step guidance here.", "Add opportunity", "add-opportunity", records.length ? "" : "Try a demo", records.length ? "" : "try-demo")}</div></section>
          <div class="mini-list">
            <section class="panel" aria-labelledby="recent-title"><div class="panel__header"><div><h2 id="recent-title">Recent applications</h2><p>Your latest records.</p></div></div><div class="panel__content">${records.length ? recordsByRecent(records).slice(0, 4).map(renderMiniRecord).join("") : emptyState("No records yet", "Start with one opportunity you want to keep organized, or explore with fictional examples.", "Add opportunity", "add-opportunity", "Try a demo", "try-demo")}</div></section>
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
      <section class="tracker-section" aria-labelledby="saved-title"><div class="tracker-section__heading"><div><h2 id="saved-title">Saved opportunities</h2><p>Roles you are considering, before you submit an application.</p></div><span class="badge badge--Saved">${saved.length} saved</span></div>${saved.length ? `<div class="record-list">${saved.map(renderRecord).join("")}</div>` : emptyState("No saved opportunities", "Save a role you want to assess or apply to later.", "Add saved opportunity", "add-opportunity", state.opportunities.length ? "" : "Try a demo", state.opportunities.length ? "" : "try-demo")}</section>
      <section class="tracker-section" aria-labelledby="applications-title"><div class="tracker-section__heading"><div><h2 id="applications-title">Applications & progress</h2><p>Submitted applications, assessments, interviews, offers, and outcomes.</p></div><span class="badge badge--Applied">${active.length} records</span></div>${active.length ? `<div class="record-list">${active.map(renderRecord).join("")}</div>` : emptyState("No applications in progress", "When you apply through an employer website, update the record here.", "Add opportunity", "add-opportunity")}</section>
    </section>`;
  }

  function assessmentIsStale(assessment) {
    return assessment?.schemaVersion === 2 && assessment.profileRevisionUsed && assessment.sourceSelection?.profile && assessment.profileRevisionUsed !== repository.profile().updatedAt;
  }

  function assessmentBadge(record) {
    if (!record.assessment) return "";
    if (record.assessment.schemaVersion !== 2) return '<span class="badge badge--assessment">Earlier assessment</span>';
    return `<span class="badge badge--assessment">${assessmentIsStale(record.assessment) ? "Assessment needs refresh" : "Assessment saved"}</span>`;
  }

  function renderRecord(record) {
    const waiting = isAttention(record);
    return `<article class="record-card"><div class="record-main"><div class="record-title-row"><h3 class="record-title">${escapeHtml(record.title)}</h3>${stageBadge(record.stage)}${demoBadge(record)}${assessmentBadge(record)}${waiting ? '<span class="badge badge--attention">Needs attention</span>' : ""}</div><p class="record-company">${escapeHtml(record.company)}</p><div class="record-meta"><span>${escapeHtml(record.opportunityType)}</span><span>${record.applicationDate ? `Applied ${formatDate(record.applicationDate)}` : "Not applied yet"}</span><span>Stage updated ${formatDate(record.stageChangedAt)}</span>${record.nextReminderDate ? `<span>Reminder ${dateValueLabel(record.nextReminderDate)}</span>` : ""}</div>${waiting ? `<p class="attention-message"><span class="attention-dot" aria-hidden="true"></span>${escapeHtml(attentionText(record))}</p>` : ""}</div><div class="record-actions"><button type="button" class="button button--secondary button--small" data-action="view-record" data-id="${record.id}">View</button><button type="button" class="button button--secondary button--small" data-action="reassess-record" data-id="${record.id}">${record.assessment ? "Reassess" : "Assess"}</button>${record.officialUrl ? `<button type="button" class="button button--small" data-action="apply-link" data-id="${record.id}">Employer website</button>` : ""}</div></article>`;
  }

  function blankManualDetails() {
    return { education: "", status: "", experience: "", skills: "", desiredType: "", roles: "", locations: "", workstyle: "", availability: "", linkedin: "" };
  }

  function blankAssessmentDraft(record = null) {
    const assessment = record?.assessment?.schemaVersion === 2 ? record.assessment : null;
    const savedProfile = repository.profile();
    const snapshot = assessment?.jobSnapshot || {};
    const job = record || assessment ? {
      company: record?.company || snapshot.company || "",
      title: record?.title || snapshot.title || "",
      opportunityType: record?.opportunityType || snapshot.opportunityType || "Internship",
      officialUrl: record?.officialUrl || snapshot.officialUrl || "",
      description: snapshot.description || ""
    } : { company: "", title: "", opportunityType: "Internship", officialUrl: "", description: "" };
    return {
      targetRecordId: record?.id || null,
      targetMode: record ? "reassess" : "new",
      profile: assessment?.candidateSnapshot?.profile ? normalizeProfile(assessment.candidateSnapshot.profile) : savedProfile,
      sourceSelection: assessment?.sourceSelection || { profile: true, cvPaste: Boolean(savedProfile.cv.text), manual: false },
      cv: { text: assessment?.candidateSnapshot?.cvText || savedProfile.cv.text || "", saveToProfile: Boolean(savedProfile.cv.text), pdfAttempt: { status: "none" } },
      manual: assessment?.candidateSnapshot?.manual || blankManualDetails(),
      job,
      result: null,
      inputFingerprint: "",
      runStatus: "idle",
      runId: 0,
      fixtureLabel: ""
    };
  }

  function restoreAssessmentDraft() {
    const saved = repository.draft();
    if (!saved?.draft || !saved.draft.job) return false;
    state.assessmentDraft = {
      ...blankAssessmentDraft(),
      ...saved.draft,
      profile: normalizeProfile(saved.draft.profile),
      sourceSelection: { profile: true, cvPaste: false, manual: false, ...saved.draft.sourceSelection },
      cv: { text: "", saveToProfile: false, pdfAttempt: { status: "none" }, ...saved.draft.cv, pdfAttempt: { status: "none" } },
      manual: { ...blankManualDetails(), ...saved.draft.manual },
      job: { company: "", title: "", opportunityType: "Internship", officialUrl: "", description: "", ...saved.draft.job },
      result: null,
      runStatus: "idle"
    };
    state.assessmentStep = Math.min(2, Math.max(1, Number(saved.step) || 1));
    return true;
  }

  function persistAssessmentDraft() {
    if (state.assessmentDraft) repository.saveDraft(state.assessmentDraft, state.assessmentStep);
  }

  function ensureAssessmentDraft() {
    if (!state.assessmentDraft && !restoreAssessmentDraft()) state.assessmentDraft = blankAssessmentDraft();
    return state.assessmentDraft;
  }

  function isDraftStale(draft) {
    return draft.runStatus === "complete" && draft.result && ENGINE && draft.result.inputFingerprint !== ENGINE.createInputFingerprint(draft);
  }

  function renderAssessment() {
    const draft = ensureAssessmentDraft();
    if (isDraftStale(draft)) draft.runStatus = "stale";
    const step = state.assessmentStep;
    const content = step === 1 ? renderBackgroundStep(draft) : step === 2 ? renderJobStep(draft) : renderAssessmentStep(draft);
    const reassess = draft.targetMode === "reassess" ? `<p class="assessment-context">Reassessing saved opportunity: <strong>${escapeHtml(draft.job.title)}</strong> at ${escapeHtml(draft.job.company)}.</p>` : "";
    return `<section class="wizard" aria-labelledby="assessment-title"><div class="wizard__intro"><p class="eyebrow">Check a job’s fit</p><h1 id="assessment-title">${step === 1 ? "Your background" : step === 2 ? "Job posting" : "Your assessment"}</h1><p>${step === 1 ? "Choose the background evidence you want to review. Everything stays in this browser." : step === 2 ? "Confirm the posting details and paste the only job text SAAY will assess." : "Here’s what to review before you decide."}</p>${reassess}${draft.fixtureLabel ? `<p class="fixture-label">Fictional verification example: ${escapeHtml(draft.fixtureLabel)}</p>` : ""}</div>${renderProgress(step)}<div class="wizard-card">${content}</div></section>`;
  }

  function renderProgress(current) {
    const labels = ["Your background", "Job posting", "Your assessment"];
    return `<ol class="progress" aria-label="Assessment progress">${labels.map((label, index) => `<li class="progress__step ${current === index + 1 ? "is-current" : current > index + 1 ? "is-complete" : ""}" ${current === index + 1 ? 'aria-current="step"' : ""}><span>${index + 1}</span><strong>${label}</strong></li>`).join("")}</ol>`;
  }

  function quickProfileFields(profile) {
    return `<div class="form-grid"><div class="field"><label for="profile-education">Field of study <span class="field-help">(optional)</span></label><input class="input" id="profile-education" name="education" value="${escapeAttr(profile.education || "")}" placeholder="e.g. Business administration"></div><div class="field field--full"><label for="profile-skills">Key skills <span class="field-help">(optional)</span></label><input class="input" id="profile-skills" name="skills" value="${escapeAttr(profile.skills || "")}" placeholder="e.g. research, Excel, communication"></div><div class="field field--full"><label for="profile-experience">Short experience summary <span class="field-help">(optional)</span></label><textarea class="textarea" id="profile-experience" name="experience" placeholder="Describe relevant experience accurately and briefly.">${escapeHtml(profile.experience || "")}</textarea></div></div>`;
  }

  function optionalProfileFields(profile) {
    return `<div class="form-grid"><div class="field"><label for="profile-status">Student or graduate status <span class="field-help">(optional)</span></label><select class="select" id="profile-status" name="status"><option value="">Choose if helpful</option>${["Student", "Recent graduate", "Graduate", "Other"].map(value => `<option value="${value}" ${(profile.status || "") === value ? "selected" : ""}>${value}</option>`).join("")}</select></div><div class="field"><label for="profile-type">Desired opportunity type <span class="field-help">(optional)</span></label><select class="select" id="profile-type" name="desiredType"><option value="">No preference set</option>${TYPES.map(value => `<option value="${value}" ${(profile.desiredType || "") === value ? "selected" : ""}>${value}</option>`).join("")}</select></div><div class="field"><label for="profile-roles">Preferred roles / fields <span class="field-help">(optional)</span></label><input class="input" id="profile-roles" name="roles" value="${escapeAttr(profile.roles || "")}"></div><div class="field"><label for="profile-locations">Preferred locations <span class="field-help">(optional)</span></label><input class="input" id="profile-locations" name="locations" value="${escapeAttr(profile.locations || "")}"></div><div class="field"><label for="profile-workstyle">Work style / relocation <span class="field-help">(optional)</span></label><input class="input" id="profile-workstyle" name="workstyle" value="${escapeAttr(profile.workstyle || "")}" placeholder="e.g. remote, willing to relocate"></div><div class="field"><label for="profile-availability">Availability to start <span class="field-help">(optional)</span></label><input class="input" id="profile-availability" name="availability" value="${escapeAttr(profile.availability || "")}"></div><div class="field"><label for="profile-linkedin">LinkedIn URL <span class="field-help">(optional reference only)</span></label><input class="input" id="profile-linkedin" name="linkedin" type="url" value="${escapeAttr(profile.linkedin || "")}" placeholder="https://..."></div></div>`;
  }

  function renderBackgroundStep(draft) {
    const profile = draft.profile;
    const fixtureOptions = (window.SAAY_ASSESSMENT_FIXTURES || []).map(item => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.label)}</option>`).join("");
    return `<form id="background-step-form" novalidate><div class="wizard-card__header"><h2>Step 1: Your background</h2><p>Add a few details you want SAAY to use for this review. Everything stays in this browser.</p></div><div class="error-summary" id="wizard-errors" tabindex="-1"><p>Review the highlighted field.</p><ul></ul></div><div class="profile-section profile-section--quick"><div class="section-label"><h3>Quick profile</h3><p>Saved only in this browser and reusable for future assessments.</p></div>${quickProfileFields(profile)}<details class="optional-profile-fields"><summary>Add more details (optional)</summary><div class="optional-profile-fields__content">${optionalProfileFields(profile)}</div></details><div class="form-actions form-actions--compact"><button type="button" class="button button--secondary button--small" data-action="clear-profile">Clear saved profile and CV</button></div></div><details class="fixture-loader"><summary>Load a fictional verification example</summary><p>For testing only. This replaces the current assessment draft and never creates a tracker record automatically.</p><label for="assessment-fixture">Example</label><select class="select" id="assessment-fixture"><option value="">Choose a fictional example</option>${fixtureOptions}</select><button type="button" class="button button--secondary button--small" data-action="load-assessment-fixture">Load example</button></details><p class="disclaimer"><strong>Local evidence review only.</strong> SAAY does not read LinkedIn, upload files, access external websites, or use AI. Add information only when it accurately describes your experience.</p><div class="form-actions"><button type="submit" class="button">Continue to job posting</button></div></form>`;
  }

  function renderJobStep(job) {
    return `<form id="job-step-form" novalidate><div class="wizard-card__header"><h2>Step 2: Job posting</h2><p>Confirm the details yourself. Only pasted job text is assessed; SAAY does not browse, read, or verify the URL.</p></div><div class="error-summary" id="wizard-errors" tabindex="-1"><p>Review the highlighted fields.</p><ul></ul></div><div class="form-grid"><div class="field"><label for="assess-company">Company name <span class="required">*</span></label><input class="input" id="assess-company" name="company" value="${escapeAttr(job.company || "")}" aria-describedby="assess-company-error"><span class="field-error" id="assess-company-error" data-wizard-error-for="company"></span></div><div class="field"><label for="assess-title">Job title <span class="required">*</span></label><input class="input" id="assess-title" name="title" value="${escapeAttr(job.title || "")}" aria-describedby="assess-title-error"><span class="field-error" id="assess-title-error" data-wizard-error-for="title"></span></div><div class="field"><label for="assess-type">Opportunity type <span class="field-help">(optional)</span></label><select class="select" id="assess-type" name="opportunityType">${TYPES.map(type => `<option value="${type}" ${job.opportunityType === type ? "selected" : ""}>${type}</option>`).join("")}</select></div><div class="field"><label for="assess-url">Official opportunity link <span class="field-help">(optional)</span></label><input class="input" id="assess-url" name="officialUrl" type="url" value="${escapeAttr(job.officialUrl || "")}" placeholder="https://employer.example/role" aria-describedby="assess-url-error"><small>Stored for you to open later; it is not retrieved or verified.</small><span class="field-error" id="assess-url-error" data-wizard-error-for="officialUrl"></span></div><div class="field field--full"><label for="assess-description">Pasted job description <span class="required">*</span></label><textarea class="textarea" id="assess-description" name="description" placeholder="Paste role requirements, responsibilities, and qualifications here." aria-describedby="assess-description-help assess-description-error">${escapeHtml(job.description || "")}</textarea><small id="assess-description-help">SAAY compares this pasted text locally using transparent rule and keyword checks. It does not fetch the URL or use AI.</small><span class="field-error" id="assess-description-error" data-wizard-error-for="description"></span></div></div><div class="form-actions"><button type="button" class="button button--secondary" data-action="assessment-back">Back</button><button type="submit" class="button">Run local assessment</button></div></form>`;
  }

  function evidenceList(items, render) {
    return items.length ? `<div class="evidence-list">${items.map(render).join("")}</div>` : "";
  }

  function renderEvidenceQuotes(items = []) {
    return items.map(item => `<p class="evidence-quote"><strong>${escapeHtml(item.source)}:</strong> “${escapeHtml(item.quote)}”</p>`).join("");
  }

  function renderAssessmentStep(draft) {
    if (draft.runStatus === "processing") return `<div class="processing-state" role="status" aria-live="polite" aria-busy="true"><h2>Reviewing your evidence</h2><p>SAAY is comparing the profile and pasted text you selected using local rules and keywords. It is not using AI or an external service.</p></div>`;
    if (draft.runStatus === "error") return `<div class="processing-state processing-state--error" role="alert"><h2>Assessment could not run</h2><p>${escapeHtml(draft.errorMessage || "Review your information and try again.")}</p><div class="form-actions"><button type="button" class="button button--secondary" data-action="assessment-back">Back to job posting</button></div></div>`;
    if (draft.runStatus !== "complete" || !draft.result) return `<div class="processing-state"><h2>Assessment not ready</h2><p>Return to the job posting, confirm the required information, and run the local assessment.</p><div class="form-actions"><button type="button" class="button button--secondary" data-action="assessment-back">Back to job posting</button></div></div>`;
    const findings = draft.result.findings;
    const missing = findings.missingEvidence || [];
    const mismatches = (findings.eligibility || []).filter(item => item.status === "possible-mismatch");
    const verified = (findings.eligibility || []).filter(item => item.status === "confirmed");
    const verification = findings.verification || [];
    const needsReview = missing.length || mismatches.length || verification.length;
    const nextStep = needsReview ? "Update your profile and check again." : "Save this opportunity to your tracker.";
    const technicalMatches = evidenceList(findings.matches || [], item => `<article class="evidence-card"><h4>${escapeHtml(item.keyword)} <span>${escapeHtml(item.requirementLevel)}</span></h4>${renderEvidenceQuotes(item.jobEvidence)}${renderEvidenceQuotes(item.candidateEvidence)}</article>`) || "<p>No direct keyword evidence was found in the selected material.</p>";
    const technicalMissing = evidenceList(missing, item => `<article class="evidence-card"><h4>${escapeHtml(item.keyword)} <span>${escapeHtml(item.requirementLevel)}</span></h4>${renderEvidenceQuotes(item.jobEvidence)}<p>${escapeHtml(item.message)}</p></article>`) || "<p>All recognized job keywords had supporting evidence in the material you selected.</p>";
    const technicalMismatches = evidenceList(mismatches, item => `<article class="evidence-card evidence-card--attention"><h4>${escapeHtml(item.condition)}</h4>${renderEvidenceQuotes(item.jobEvidence)}${renderEvidenceQuotes(item.candidateEvidence)}<p>${escapeHtml(item.explanation)}</p></article>`) || "<p>No direct contradiction was found between explicit job conditions and the details you entered.</p>";
    const technicalVerification = evidenceList(verification, item => `<article class="evidence-card"><h4>${escapeHtml(item.topic)}</h4>${renderEvidenceQuotes(item.jobEvidence)}<p>${escapeHtml(item.reason)}</p></article>`) || "<p>Nothing else needs confirmation from this check.</p>";
    return `<div class="assessment-result assessment-result--simple" aria-live="polite"><div class="assessment-cards"><section class="assessment-card"><h2>What already matches</h2>${findings.matches?.length ? `<ul>${findings.matches.map(item => `<li>${escapeHtml(item.keyword)}</li>`).join("")}</ul>` : "<p>No matching terms found yet.</p>"}</section><section class="assessment-card"><h2>Things to check</h2>${mismatches.length || verification.length ? `<ul>${mismatches.map(item => `<li>Check ${escapeHtml(item.condition)}</li>`).join("")}${verification.map(item => `<li>Confirm ${escapeHtml(item.topic)}</li>`).join("")}</ul>` : "<p>Nothing important to check yet.</p>"}</section><section class="assessment-card"><h2>Skills you could mention</h2><p class="assessment-card__note">Only add these if they are true for you.</p>${missing.length ? `<ul>${missing.map(item => `<li>${escapeHtml(item.keyword)}</li>`).join("")}</ul>` : "<p>No skills to add from this check yet.</p>"}</section><section class="assessment-card assessment-card--next"><h2>Your next step</h2><p>${nextStep}</p></section></div><details class="assessment-how-it-works"><summary>How this check works</summary><div class="assessment-how-it-works__content"><p>SAAY compares only the information you entered with the pasted job description using local keyword and rule matching. It does not use AI, browse the web, read links, or make a hiring prediction.</p><p>A missing term means it was not found in the material used for this check. It does not prove that you lack the skill. Add or change information only when it is accurate, then check again.</p><section class="finding"><h3>Matching details</h3>${technicalMatches}</section><section class="finding"><h3>Terms not found</h3>${technicalMissing}</section><section class="finding"><h3>Direct conflicts to review</h3>${technicalMismatches}${verified.length ? `<p class="assessment-note">Confirmed from entered details: ${verified.map(item => escapeHtml(item.condition)).join(", ")}.</p>` : ""}</section><section class="finding"><h3>Other details to confirm</h3>${technicalVerification}</section></div></details><div class="form-actions"><button type="button" class="button button--secondary" data-action="assessment-back">Back</button><button type="button" class="button button--secondary" data-action="edit-background">Edit your background</button>${draft.job.officialUrl ? '<button type="button" class="button button--secondary" data-action="open-assessment-link">Open employer website</button>' : ""}<button type="button" class="button" data-action="save-assessed">${draft.targetMode === "reassess" ? "Update assessment" : "Save to tracker"}</button></div></div>`;
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

  function assessmentSummary(record) {
    const assessment = record.assessment;
    if (!assessment) return "";
    if (assessment.schemaVersion !== 2) return `<section class="detail-section"><h3>Assessment</h3><p>This opportunity has an earlier assessment format. Reassess it to see current evidence-based results.</p><div class="form-actions"><button type="button" class="button button--secondary" data-action="reassess-record" data-id="${record.id}">Reassess opportunity</button></div></section>`;
    const findings = assessment.findings || {};
    const mismatchCount = (findings.eligibility || []).filter(item => item.status === "possible-mismatch").length;
    const stale = assessmentIsStale(assessment);
    return `<section class="detail-section"><h3>Assessment summary</h3><p>${stale ? "Your saved profile changed after this review. Reassess to refresh profile-based evidence." : `Last assessed ${formatDate(assessment.assessedAt?.slice(0, 10))}.`}</p><div class="detail-grid"><div class="detail-data"><span>Matches</span><strong>${(findings.matches || []).length}</strong></div><div class="detail-data"><span>Not evidenced</span><strong>${(findings.missingEvidence || []).length}</strong></div><div class="detail-data"><span>Verify</span><strong>${(findings.verification || []).length + mismatchCount}</strong></div></div><div class="form-actions"><button type="button" class="button button--secondary" data-action="view-assessment" data-id="${record.id}">View assessment</button><button type="button" class="button" data-action="reassess-record" data-id="${record.id}">Reassess opportunity</button></div></section>`;
  }

  function recordDetail(record) {
    const attention = isAttention(record);
    const history = record.followUpHistory.length ? record.followUpHistory.map(item => `<li class="history-item"><strong>Follow-up completed ${formatDate(item.completedAt)}</strong>${item.note ? `<br>${escapeHtml(item.note)}` : ""}</li>`).join("") : "<li class=\"history-item\">No completed follow-ups yet.</li>";
    return `<div class="modal-header"><h2>${escapeHtml(record.title)}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="Close dialog">×</button></div><div class="modal-body"><section class="detail-section"><div class="detail-header"><div><p class="record-company">${escapeHtml(record.company)}</p></div><div>${stageBadge(record.stage)} ${demoBadge(record)} ${assessmentBadge(record)}</div></div>${attention ? `<p class="attention-message"><span class="attention-dot" aria-hidden="true"></span>${escapeHtml(attentionText(record))}</p>` : ""}<div class="detail-grid" style="margin-top:14px"><div class="detail-data"><span>Type</span><strong>${escapeHtml(record.opportunityType)}</strong></div><div class="detail-data"><span>Application date</span><strong>${formatDate(record.applicationDate)}</strong></div><div class="detail-data"><span>Stage changed</span><strong>${formatDate(record.stageChangedAt)}</strong></div></div></section>${assessmentSummary(record)}<section class="detail-section"><h3>Suggested next step</h3><p class="guidance">${escapeHtml(stageAdvice[record.stage])}</p></section>${record.notes ? `<section class="detail-section"><h3>Your notes</h3><p>${escapeHtml(record.notes)}</p></section>` : ""}<section class="detail-section"><h3>Dates & reminders</h3><div class="detail-grid"><div class="detail-data"><span>Closing</span><strong>${dateValueLabel(record.closingDate)}</strong></div><div class="detail-data"><span>Interview</span><strong>${dateValueLabel(record.interviewDate)}</strong></div><div class="detail-data"><span>Next reminder</span><strong>${dateValueLabel(record.nextReminderDate)}</strong></div></div></section><section class="detail-section"><h3>Follow-up history</h3><p>Complete a follow-up to keep it out of unfinished tasks. This only records your action; SAAY never sends anything.</p><form id="followup-form" class="followup-form" data-id="${record.id}"><label class="sr-only" for="followup-note">Follow-up note</label><input class="input" id="followup-note" name="note" placeholder="Optional note, e.g. sent a polite check-in"><button class="button button--small" type="submit">Mark follow-up complete</button></form><ul class="followup-history">${history}</ul>${attention ? `<div style="margin-top:14px"><button type="button" class="button button--secondary button--small" data-action="open-copy" data-id="${record.id}">Copy follow-up message</button></div>` : ""}</section><section class="detail-section"><div class="form-actions">${record.officialUrl ? `<button type="button" class="button" data-action="apply-link" data-id="${record.id}">Apply on employer website</button>` : ""}<button type="button" class="button button--secondary" data-action="edit-record" data-id="${record.id}">Edit opportunity</button></div></section></div>`;
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
    if (!existing && !repository.shareSeen() && !updated.isDemo) showSharePrompt();
  }

  function validateWizardProfile(profile) {
    const errors = {};
    if (profile.linkedin) {
      try {
        const url = new URL(profile.linkedin);
        if (!/^https?:$/.test(url.protocol)) errors.linkedin = "Use an http or https web address.";
      } catch { errors.linkedin = "Enter a complete web address, such as https://linkedin.com/in/name."; }
    }
    return errors;
  }

  function validateWizardJob(job) {
    const errors = {};
    if (!job.company.trim()) errors.company = "Enter the company name.";
    if (!job.title.trim()) errors.title = "Enter the job title.";
    if (!job.description.trim()) errors.description = "Paste the job description before continuing.";
    if (job.officialUrl) {
      try {
        const url = new URL(job.officialUrl);
        if (!/^https?:$/.test(url.protocol)) errors.officialUrl = "Use an http or https web address.";
      } catch { errors.officialUrl = "Enter a complete web address, such as https://employer.example/role."; }
    }
    return errors;
  }

  function showWizardErrors(errors) {
    document.querySelectorAll("[data-wizard-error-for]").forEach(element => { element.textContent = ""; });
    document.querySelectorAll("[data-wizard-invalid]").forEach(element => {
      element.removeAttribute("aria-invalid");
      element.removeAttribute("data-wizard-invalid");
    });
    const summary = document.getElementById("wizard-errors");
    if (summary) summary.classList.remove("is-visible");
    if (!Object.keys(errors).length) return false;
    Object.entries(errors).forEach(([name, message]) => {
      const messageTarget = document.querySelector(`[data-wizard-error-for="${name}"]`);
      const field = document.querySelector(`[name="${name}"]`);
      if (messageTarget) messageTarget.textContent = message;
      if (field) {
        field.setAttribute("aria-invalid", "true");
        field.setAttribute("data-wizard-invalid", "true");
      }
    });
    if (summary) {
      summary.classList.add("is-visible");
      summary.querySelector("ul").innerHTML = Object.entries(errors).map(([name, message]) => `<li><a href="#${name === "description" ? "assess-description" : name === "officialUrl" ? "assess-url" : name === "linkedin" ? "profile-linkedin" : name === "cvText" ? "cv-text" : `assess-${name}`}">${escapeHtml(message)}</a></li>`).join("");
      summary.focus();
    }
    return true;
  }

  function startAssessment(recordId = "") {
    const record = recordId ? getRecord(recordId) : null;
    state.assessmentDraft = blankAssessmentDraft(record);
    state.assessmentStep = 1;
    repository.clearDraft();
    setView("assessment");
    announce(record ? "Step 1 of 3: Reassess your background." : "Step 1 of 3: Your background.");
  }

  function moveAssessmentBack() {
    const draft = ensureAssessmentDraft();
    if (draft.runStatus === "processing") return;
    if (state.assessmentStep <= 1) return;
    state.assessmentStep -= 1;
    persistAssessmentDraft();
    renderApp();
    focusMainTitle();
    announce(`Step ${state.assessmentStep} of 3.`);
  }

  function readNamedFields(form, names) {
    const values = Object.fromEntries(new FormData(form).entries());
    return names.reduce((result, name) => ({ ...result, [name]: values[name] || "" }), {});
  }

  function captureBackgroundDraft(form = document.getElementById("background-step-form")) {
    const draft = ensureAssessmentDraft();
    if (!form) return draft;
    const profile = readNamedFields(form, ["education", "status", "experience", "skills", "desiredType", "roles", "locations", "workstyle", "availability", "linkedin"]);
    draft.profile = normalizeProfile({ ...profile, updatedAt: draft.profile.updatedAt || "" });
    // The simplified screen intentionally leaves existing CV/manual evidence choices unchanged.
    // This keeps resumed drafts and saved assessments compatible while those controls are hidden.
    if (draft.result && ENGINE && draft.result.inputFingerprint !== ENGINE.createInputFingerprint(draft)) draft.runStatus = "stale";
    return draft;
  }

  function saveBackgroundStep(form) {
    const draft = captureBackgroundDraft(form);
    if (showWizardErrors(validateWizardProfile(draft.profile))) return;
    if (draft.cv.text.length > CV_LIMIT) {
      showWizardErrors({ cvText: `Keep pasted CV text under ${CV_LIMIT.toLocaleString()} characters.` });
      return;
    }
    const saved = repository.saveProfile({
      ...draft.profile,
      cv: draft.cv.saveToProfile
        ? { text: draft.cv.text, updatedAt: new Date().toISOString() }
        : repository.profile().cv
    });
    draft.profile = saved;
    draft.result = null;
    draft.runStatus = "idle";
    state.assessmentStep = 2;
    persistAssessmentDraft();
    renderApp();
    focusMainTitle();
    announce("Step 2 of 3: Job posting.");
  }

  function captureJobDraft(form = document.getElementById("job-step-form")) {
    const draft = ensureAssessmentDraft();
    if (!form) return draft;
    draft.job = { ...draft.job, ...Object.fromEntries(new FormData(form).entries()) };
    if (draft.result && ENGINE && draft.result.inputFingerprint !== ENGINE.createInputFingerprint(draft)) draft.runStatus = "stale";
    return draft;
  }

  function captureCurrentAssessmentForm() {
    if (state.assessmentStep === 1) return captureBackgroundDraft();
    if (state.assessmentStep === 2) return captureJobDraft();
    return ensureAssessmentDraft();
  }

  function saveJobStep(form) {
    const draft = captureJobDraft(form);
    const job = draft.job;
    if (showWizardErrors(validateWizardJob(job))) return;
    draft.result = null;
    draft.runStatus = "processing";
    const runId = draft.runId + 1;
    draft.runId = runId;
    state.assessmentStep = 3;
    repository.clearDraft();
    renderApp();
    focusMainTitle();
    announce("Reviewing your entered evidence locally.");
    window.setTimeout(() => {
      const current = state.assessmentDraft;
      if (!current || current.runId !== runId || current.runStatus !== "processing") return;
      try {
        if (!ENGINE) throw new Error("The local assessment engine was not available.");
        current.result = ENGINE.assess(current);
        current.inputFingerprint = current.result.inputFingerprint;
        current.runStatus = "complete";
        renderApp();
        focusMainTitle();
        announce("Step 3 of 3: Your assessment is ready.");
      } catch (error) {
        current.runStatus = "error";
        current.errorMessage = "SAAY could not analyze the entered text. Your information is still here—review it and try again.";
        renderApp();
        announce("Assessment could not run.");
      }
    }, 250);
  }

  function assessmentOfficialUrl() {
    return state.assessmentDraft?.job?.officialUrl || "";
  }

  function saveAssessedOpportunity() {
    const draft = state.assessmentDraft;
    if (!draft?.job || draft.runStatus !== "complete" || !draft.result || isDraftStale(draft)) {
      showToast("Run the assessment again after any changes before saving.");
      return;
    }
    const now = new Date().toISOString();
    const existing = draft.targetRecordId ? getRecord(draft.targetRecordId) : null;
    const identityChanged = existing && ["company", "title", "opportunityType", "officialUrl"].some(key => String(existing[key] || "") !== String(draft.job[key] || ""));
    const updateIdentity = !identityChanged || window.confirm("Update this saved opportunity’s company, title, type, or official link with the reviewed posting details?");
    if (identityChanged && !updateIdentity) showToast("Assessment updated without changing the saved opportunity details.");
    const record = normalizeOpportunity({
      ...(existing || {}),
      id: existing?.id || uid("assessed"),
      isDemo: existing?.isDemo || false,
      company: !existing || !identityChanged || updateIdentity ? draft.job.company : existing.company,
      title: !existing || !identityChanged || updateIdentity ? draft.job.title : existing.title,
      opportunityType: !existing || !identityChanged || updateIdentity ? draft.job.opportunityType : existing.opportunityType,
      officialUrl: !existing || !identityChanged || updateIdentity ? draft.job.officialUrl : existing.officialUrl,
      notes: existing?.notes || "Saved from a SAAY opportunity review.",
      stage: existing?.stage || "Saved",
      applicationDate: existing?.applicationDate || "",
      stageChangedAt: existing?.stageChangedAt || isoDate(),
      followUpHistory: existing?.followUpHistory || [],
      assessment: draft.result,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    });
    saveOpportunities(existing ? state.opportunities.map(item => item.id === existing.id ? record : item) : [...state.opportunities, record]);
    state.assessmentDraft = null;
    state.assessmentStep = 1;
    repository.clearDraft();
    state.view = "tracker";
    renderApp();
    showToast(existing ? "Assessment updated in your tracker." : "Assessed opportunity saved to your tracker.");
    if (!existing && !repository.shareSeen()) showSharePrompt();
  }

  function showSharePrompt() {
    if (repository.shareSeen() || document.querySelector(".share-prompt")) return;
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
    repository.setShareSeen();
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

  function focusMainTitle() {
    const title = document.querySelector("#main-content h1");
    if (title) {
      title.setAttribute("tabindex", "-1");
      title.focus({ preventScroll: true });
    }
  }

  function setView(view) {
    state.view = view;
    renderApp();
    focusMainTitle();
  }

  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const action = trigger.dataset.action;
    const id = trigger.dataset.id;
    if (action === "open-app") { state.view = "dashboard"; renderApp(); }
    if (action === "go-landing") { event.preventDefault(); state.view = "landing"; state.assessmentDraft = null; state.assessmentStep = 1; renderLanding(); }
    if (action === "navigate") {
      if (state.view === "assessment") captureCurrentAssessmentForm();
      setView(trigger.dataset.view);
    }
    if (action === "start-assessment") startAssessment();
    if (action === "reassess-record") { const record = getRecord(id); if (record) { closeDialog(); startAssessment(record.id); } }
    if (action === "view-assessment") { const record = getRecord(id); if (record) { closeDialog(); state.assessmentDraft = blankAssessmentDraft(record); state.assessmentDraft.result = record.assessment; state.assessmentDraft.runStatus = record.assessment?.schemaVersion === 2 ? "complete" : "idle"; state.assessmentStep = 3; setView("assessment"); } }
    if (action === "open-tracker") {
      if (state.view === "assessment") captureCurrentAssessmentForm();
      setView("tracker");
    }
    if (action === "try-demo") { state.opportunities = repository.loadSamples(state.opportunities); state.view = "dashboard"; renderApp(); showToast("Fictional example data loaded."); }
    if (action === "assessment-back") moveAssessmentBack();
    if (action === "edit-background") { state.assessmentStep = 1; state.assessmentDraft.runStatus = "stale"; renderApp(); focusMainTitle(); announce("Step 1 of 3: Your background."); }
    if (action === "clear-cv-pdf") { const draft = captureBackgroundDraft(); draft.cv.pdfAttempt = { status: "none" }; renderApp(); showToast("Selected PDF cleared. It was never uploaded or saved."); }
    if (action === "clear-profile") { if (window.confirm("Clear your saved profile and pasted CV text from this browser? Your tracker records will remain.")) { const draft = captureBackgroundDraft(); draft.profile = repository.clearProfile(); draft.cv = { ...draft.cv, text: "", saveToProfile: false }; renderApp(); showToast("Saved profile and CV text cleared from this browser."); } }
    if (action === "load-assessment-fixture") { const fixtureId = document.getElementById("assessment-fixture")?.value; const fixture = (window.SAAY_ASSESSMENT_FIXTURES || []).find(item => item.id === fixtureId); if (fixture) { state.assessmentDraft = { ...blankAssessmentDraft(), profile: normalizeProfile(fixture.profile), sourceSelection: { ...fixture.sourceSelection }, cv: { ...fixture.cv, saveToProfile: false }, manual: { ...fixture.manual }, job: { ...fixture.job }, fixtureLabel: fixture.label }; state.assessmentStep = 1; renderApp(); showToast("Fictional verification example loaded into this assessment only."); } }
    if (action === "add-opportunity") openDialog(opportunityForm(), "Add opportunity");
    if (action === "close-dialog") closeDialog();
    if (action === "view-record") { const record = getRecord(id); if (record) openDialog(recordDetail(record), "Opportunity details"); }
    if (action === "edit-record") { const record = getRecord(id); if (record) openDialog(opportunityForm(record), "Edit opportunity"); }
    if (action === "confirm-delete") confirmDelete(id);
    if (action === "apply-link") applyEmployerLink(getRecord(id));
    if (action === "load-samples") { state.opportunities = repository.loadSamples(state.opportunities); renderApp(); showToast("Fictional example data loaded."); }
    if (action === "clear-data") { if (window.confirm("Clear all records stored in this browser?")) { state.opportunities = repository.clear(); renderApp(); showToast("All browser-only records were cleared."); } }
    if (action === "open-copy") { const record = getRecord(id); if (record) openCopyDialog(record); }
    if (action === "copy-message") copyMessage();
    if (action === "save-assessed") saveAssessedOpportunity();
    if (action === "open-assessment-link") applyEmployerLink({ officialUrl: assessmentOfficialUrl() });
    if (action === "share-saay") shareSaay();
    if (action === "dismiss-share") dismissShare();
  });

  document.addEventListener("input", event => {
    if (event.target.dataset.filter === "query") { state.query = event.target.value; renderApp(); document.getElementById("search-records")?.focus(); document.getElementById("search-records")?.setSelectionRange(state.query.length, state.query.length); }
    if (event.target.id === "cv-text") document.getElementById("cv-character-count")?.replaceChildren(String(event.target.value.length));
  });

  document.addEventListener("change", event => {
    if (event.target.id === "cv-pdf") {
      const file = event.target.files?.[0];
      if (!file) return;
      const draft = captureBackgroundDraft();
      const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!looksLikePdf) { showToast("Choose a PDF file, or paste CV text instead."); event.target.value = ""; return; }
      if (file.size > PDF_LIMIT) { showToast("Choose a PDF smaller than 8 MB, or paste CV text instead."); event.target.value = ""; return; }
      draft.cv.pdfAttempt = { name: file.name, size: file.size, type: file.type || "application/pdf", status: "selected-manual-paste-required" };
      renderApp();
      showToast("PDF selected locally. SAAY did not upload or read its text.");
      return;
    }
    if (["useProfile", "useCv", "useManual"].includes(event.target.name)) {
      const draft = captureBackgroundDraft();
      document.querySelector('[data-source-panel="cv"]')?.classList.toggle("is-hidden", !draft.sourceSelection.cvPaste);
      document.querySelector('[data-source-panel="manual"]')?.classList.toggle("is-hidden", !draft.sourceSelection.manual);
      return;
    }
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
    if (event.target.id === "background-step-form") { event.preventDefault(); saveBackgroundStep(event.target); }
    if (event.target.id === "job-step-form") { event.preventDefault(); saveJobStep(event.target); }
  });

  state.opportunities = repository.get();
  renderLanding();
})();
