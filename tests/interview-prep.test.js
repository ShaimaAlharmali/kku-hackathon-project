"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeInterviewPrep,
  completedChecklistCount,
  hasInterviewPrepProgress,
  mergeInterviewPrepIntoRecord
} = require("../interview-prep.js");

test("normalizes missing interview prep fields safely", () => {
  const prep = normalizeInterviewPrep({ checklist: { strongExample: 1 }, star: { action: "Explained the approach" } });

  assert.equal(prep.schemaVersion, 1);
  assert.deepEqual(prep.checklist, {
    understandRole: false,
    strongExample: true,
    prepareQuestions: false,
    confirmDetails: false
  });
  assert.deepEqual(prep.star, {
    situation: "",
    task: "",
    action: "Explained the approach",
    result: ""
  });
});

test("tracks checklist progress separately from tracker records", () => {
  const prep = normalizeInterviewPrep({ checklist: { understandRole: true, prepareQuestions: true } });

  assert.equal(completedChecklistCount(prep), 2);
  assert.equal(hasInterviewPrepProgress(prep), true);
  assert.equal(hasInterviewPrepProgress(normalizeInterviewPrep({})), false);
});

test("connected prep merge preserves unrelated tracker fields", () => {
  const record = {
    id: "opportunity-1",
    company: "Northwind Labs",
    title: "Graduate Analyst",
    stage: "Interview",
    stageChangedAt: "2026-09-20",
    notes: "Keep this note",
    nextReminderDate: "2026-10-02",
    followUpHistory: [{ id: "follow-up-1", note: "Checked in" }],
    assessment: { schemaVersion: 2 },
    interviewDate: "2026-10-01"
  };
  const prep = normalizeInterviewPrep({
    interviewDate: "2026-10-03",
    privateNotes: "Bring a portfolio example.",
    checklist: { strongExample: true }
  });

  const updated = mergeInterviewPrepIntoRecord(record, prep, "2026-09-29T12:00:00.000Z");

  assert.equal(updated.interviewDate, "2026-10-03");
  assert.equal(updated.interviewPrep.privateNotes, "Bring a portfolio example.");
  assert.equal(updated.stage, "Interview");
  assert.equal(updated.stageChangedAt, "2026-09-20");
  assert.equal(updated.notes, "Keep this note");
  assert.equal(updated.nextReminderDate, "2026-10-02");
  assert.deepEqual(updated.followUpHistory, record.followUpHistory);
  assert.deepEqual(updated.assessment, record.assessment);
});
