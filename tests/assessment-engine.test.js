const test = require("node:test");
const assert = require("node:assert/strict");
const { assess, createInputFingerprint } = require("../assessment-engine.js");

function draft(overrides = {}) {
  return {
    sourceSelection: { profile: true, cvPaste: false, manual: false },
    profile: { status: "Student", skills: "Excel", experience: "Built Excel reporting dashboards." },
    cv: { text: "", pdfAttempt: { status: "none" } },
    manual: {},
    job: { company: "Fictional Co", title: "Analyst", description: "Applicants must be currently enrolled students. Required: Excel and SQL. Preferred: Tableau.", officialUrl: "https://example.com/role" },
    ...overrides
  };
}

test("matches direct profile evidence and keeps missing evidence separate", () => {
  const result = assess(draft());
  assert.equal(result.engineVersion, "rules-keywords-v1");
  assert.ok(result.findings.matches.some(item => item.keyword === "excel" && item.candidateEvidence[0].source === "Profile"));
  const sql = result.findings.missingEvidence.find(item => item.keyword === "sql");
  assert.equal(sql.requirementLevel, "required");
  assert.match(sql.message, /unknown/i);
  assert.ok(result.findings.missingEvidence.some(item => item.keyword === "tableau" && item.requirementLevel === "preferred"));
});

test("detects only direct eligibility contradictions", () => {
  const result = assess(draft({ profile: { status: "Graduate", skills: "Excel" } }));
  assert.ok(result.findings.eligibility.some(item => item.condition === "Current enrollment" && item.status === "possible-mismatch"));
});

test("unknown work authorization is verification, not a mismatch", () => {
  const result = assess(draft({ job: { company: "Fictional Co", title: "Intern", description: "Applicants must have work authorization. Required: Excel.", officialUrl: "" } }));
  assert.ok(result.findings.eligibility.some(item => item.condition === "Work authorization" && item.status === "needs-verification"));
  assert.equal(result.findings.eligibility.some(item => item.status === "possible-mismatch"), false);
});

test("uses pasted CV evidence only when selected", () => {
  const withCv = assess(draft({ sourceSelection: { profile: false, cvPaste: true, manual: false }, profile: {}, cv: { text: "Created SQL queries and Excel reports.", pdfAttempt: { status: "none" } } }));
  assert.ok(withCv.findings.matches.some(item => item.keyword === "sql" && item.candidateEvidence[0].source === "Pasted CV"));
  const withoutCv = assess(draft({ sourceSelection: { profile: false, cvPaste: false, manual: false }, profile: {}, cv: { text: "Created SQL queries.", pdfAttempt: { status: "none" } } }));
  assert.ok(withoutCv.findings.missingEvidence.some(item => item.keyword === "sql"));
});

test("selected PDFs do not create candidate evidence", () => {
  const result = assess(draft({ profile: {}, sourceSelection: { profile: false, cvPaste: false, manual: false }, cv: { text: "", pdfAttempt: { name: "cv.pdf", status: "selected-manual-paste-required" } } }));
  assert.ok(result.findings.missingEvidence.some(item => item.keyword === "excel"));
  assert.ok(result.findings.verification.some(item => item.topic === "Selected PDF"));
});

test("fingerprints change when source material changes", () => {
  const first = createInputFingerprint(draft());
  const changed = createInputFingerprint(draft({ profile: { status: "Student", skills: "Excel, SQL" } }));
  assert.notEqual(first, changed);
  assert.equal(first, createInputFingerprint(draft()));
});
