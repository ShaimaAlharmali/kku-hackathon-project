(() => {
  "use strict";

  const CHECKLIST_KEYS = ["understandRole", "strongExample", "prepareQuestions", "confirmDetails"];

  function normalizeInterviewPrep(prep = {}) {
    const checklist = prep && typeof prep.checklist === "object" ? prep.checklist : {};
    const star = prep && typeof prep.star === "object" ? prep.star : {};
    return {
      schemaVersion: 1,
      company: String(prep?.company || "").trim(),
      title: String(prep?.title || "").trim(),
      interviewDate: String(prep?.interviewDate || ""),
      interviewTime: String(prep?.interviewTime || ""),
      meetingDetails: String(prep?.meetingDetails || "").trim(),
      checklist: CHECKLIST_KEYS.reduce((result, key) => ({ ...result, [key]: Boolean(checklist[key]) }), {}),
      privateNotes: String(prep?.privateNotes || ""),
      star: {
        situation: String(star.situation || ""),
        task: String(star.task || ""),
        action: String(star.action || ""),
        result: String(star.result || "")
      },
      updatedAt: String(prep?.updatedAt || "")
    };
  }

  function completedChecklistCount(prep) {
    const normalized = normalizeInterviewPrep(prep);
    return CHECKLIST_KEYS.filter(key => normalized.checklist[key]).length;
  }

  function hasInterviewPrepProgress(prep) {
    const normalized = normalizeInterviewPrep(prep);
    return completedChecklistCount(normalized) > 0 || Boolean(
      normalized.company || normalized.title || normalized.interviewDate || normalized.interviewTime ||
      normalized.meetingDetails || normalized.privateNotes || Object.values(normalized.star).some(Boolean)
    );
  }

  function mergeInterviewPrepIntoRecord(record, prep, updatedAt) {
    const timestamp = updatedAt || new Date().toISOString();
    const normalized = normalizeInterviewPrep({ ...prep, updatedAt: timestamp });
    return {
      ...record,
      interviewDate: normalized.interviewDate || record.interviewDate || "",
      interviewPrep: normalized,
      updatedAt: timestamp
    };
  }

  const api = { CHECKLIST_KEYS, normalizeInterviewPrep, completedChecklistCount, hasInterviewPrepProgress, mergeInterviewPrepIntoRecord };
  if (typeof window !== "undefined") window.SAAYInterviewPrep = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
