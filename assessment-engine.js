/* SAAY's local, explainable fit-assessment engine. It uses rules and keywords only. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SAAYAssessmentEngine = api;
}(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const KEYWORDS = [
    "excel", "google sheets", "powerpoint", "word", "sql", "python", "javascript", "typescript", "java", "c++",
    "tableau", "power bi", "figma", "photoshop", "illustrator", "salesforce", "hubspot", "sap", "jira", "confluence",
    "research", "data analysis", "data visualization", "project management", "communication", "presentation", "reporting",
    "customer service", "leadership", "teamwork", "problem solving", "agile", "scrum", "marketing", "accounting",
    "human resources", "recruitment", "ux research", "user research", "product management", "financial analysis",
    "microsoft office", "arabic", "english"
  ];

  const ALIASES = {
    "ms excel": "excel",
    "microsoft excel": "excel",
    "ms office": "microsoft office",
    "google sheet": "google sheets",
    "js": "javascript",
    "powerbi": "power bi",
    "user experience research": "ux research"
  };

  const REQUIRED_PATTERN = /\b(must|required|requirement|mandatory|minimum|applicants? must|need to|eligib(?:le|ility))\b/i;
  const PREFERRED_PATTERN = /\b(preferred|nice to have|bonus|plus|desired|advantage)\b/i;
  const VERIFY_PATTERN = /\b(work authorization|visa|eligible to work|enrolled|enrollment|student|graduat(?:e|ion)|location|relocat|remote|hybrid|on[ -]?site|start date|available to start|deadline|contract)\b/i;

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9+#.\s/-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\bms excel\b|\bmicrosoft excel\b/g, "excel")
      .replace(/\bms office\b/g, "microsoft office")
      .replace(/\bgoogle sheet\b/g, "google sheets")
      .replace(/\bpowerbi\b/g, "power bi")
      .replace(/\buser experience research\b/g, "ux research");
  }

  function canonicalKeyword(value) {
    const normalized = normalizeText(value);
    return ALIASES[normalized] || normalized;
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function includesPhrase(text, phrase) {
    const normalizedText = normalizeText(text);
    const normalizedPhrase = canonicalKeyword(phrase);
    if (!normalizedPhrase) return false;
    return new RegExp(`(^|[^a-z0-9+#])${escapeRegex(normalizedPhrase)}(?=$|[^a-z0-9+#])`, "i").test(normalizedText);
  }

  function splitEvidenceUnits(text, source) {
    return String(text || "")
      .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9•-])/)
      .map(unit => unit.replace(/^\s*[•*-]\s*/, "").trim())
      .filter(Boolean)
      .map(quote => ({ source, quote, normalized: normalizeText(quote) }));
  }

  function profileText(profile) {
    return [
      profile.education, profile.status, profile.experience, profile.skills, profile.desiredType,
      profile.roles, profile.locations, profile.workstyle, profile.availability
    ].filter(Boolean).join("\n");
  }

  function collectCandidateEvidence(draft) {
    const selection = draft.sourceSelection || {};
    const candidate = [];
    if (selection.profile !== false) candidate.push(...splitEvidenceUnits(profileText(draft.profile || {}), "Profile"));
    if (selection.cvPaste && draft.cv?.text) candidate.push(...splitEvidenceUnits(draft.cv.text, "Pasted CV"));
    if (selection.manual && draft.manual) candidate.push(...splitEvidenceUnits(profileText(draft.manual), "Manual details"));
    return candidate;
  }

  function requirementLevel(text) {
    if (REQUIRED_PATTERN.test(text)) return "required";
    if (PREFERRED_PATTERN.test(text)) return "preferred";
    return "unclassified";
  }

  function extractJobRequirements(jobText) {
    return splitEvidenceUnits(jobText, "Job posting").map(unit => ({
      ...unit,
      level: requirementLevel(unit.quote),
      verificationHeavy: VERIFY_PATTERN.test(unit.quote)
    }));
  }

  function explicitSkills(profile) {
    return String(profile?.skills || "")
      .split(/[;,\n]/)
      .map(canonicalKeyword)
      .filter(Boolean);
  }

  function collectKeywords(requirements, profile) {
    const seen = new Set();
    const keywords = [...KEYWORDS, ...explicitSkills(profile)];
    const output = [];
    requirements.forEach(requirement => {
      keywords.forEach(keyword => {
        const canonical = canonicalKeyword(keyword);
        if (!canonical || seen.has(`${canonical}|${requirement.quote}`) || !includesPhrase(requirement.normalized, canonical)) return;
        seen.add(`${canonical}|${requirement.quote}`);
        output.push({ keyword: canonical, requirement });
      });
    });
    return output;
  }

  function findEvidence(units, keyword) {
    return units.filter(unit => includesPhrase(unit.normalized, keyword)).map(unit => ({ source: unit.source, quote: unit.quote }));
  }

  function getJobConditions(requirements) {
    return requirements.filter(item => item.verificationHeavy);
  }

  function evaluateEligibility(requirements, profile) {
    const results = [];
    const status = normalizeText(profile?.status);
    const workstyle = normalizeText(profile?.workstyle);
    const locations = normalizeText(profile?.locations);
    const availability = normalizeText(profile?.availability);

    getJobConditions(requirements).forEach(requirement => {
      const job = requirement.quote;
      const text = requirement.normalized;
      let condition = "Job-detail confirmation";
      let statusValue = "needs-verification";
      let explanation = "This condition needs confirmation from the employer or more information in your profile.";
      let candidateEvidence = [];

      if (/\b(enrolled|enrollment|current student|students? only)\b/.test(text)) {
        condition = "Current enrollment";
        if (status.includes("student")) {
          statusValue = "confirmed";
          candidateEvidence = [{ source: "Profile", quote: profile.status }];
          explanation = "Your profile identifies you as a student.";
        } else if (status.includes("graduate") && !status.includes("recent")) {
          statusValue = "possible-mismatch";
          candidateEvidence = [{ source: "Profile", quote: profile.status }];
          explanation = "The posting asks for current enrollment while your profile identifies you as a graduate.";
        } else if (!status) explanation = "Your student or graduate status is not set in your profile.";
      } else if (/\b(recent graduate|graduate)\b/.test(text)) {
        condition = "Graduate status";
        if (status.includes("graduate")) {
          statusValue = "confirmed";
          candidateEvidence = [{ source: "Profile", quote: profile.status }];
          explanation = "Your profile identifies you as a graduate or recent graduate.";
        } else if (status.includes("student")) {
          statusValue = "possible-mismatch";
          candidateEvidence = [{ source: "Profile", quote: profile.status }];
          explanation = "The posting asks for graduate status while your profile identifies you as a student.";
        } else if (!status) explanation = "Your student or graduate status is not set in your profile.";
      } else if (/\b(remote|hybrid|on site|onsite|relocat|location)\b/.test(text)) {
        condition = "Location or work arrangement";
        if (workstyle || locations) {
          candidateEvidence = [{ source: "Profile", quote: [profile.locations, profile.workstyle].filter(Boolean).join(" · ") }];
          statusValue = "needs-verification";
          explanation = "Compare your stated location/work-style preference with the employer's exact arrangement.";
        } else explanation = "Your location or work-style preference is not set in your profile.";
      } else if (/\b(start date|available to start)\b/.test(text)) {
        condition = "Start availability";
        if (availability) {
          candidateEvidence = [{ source: "Profile", quote: availability }];
          explanation = "Compare your stated availability with the employer's exact start date.";
        } else explanation = "Your availability to start is not set in your profile.";
      } else if (/\b(visa|work authorization|eligible to work)\b/.test(text)) {
        condition = "Work authorization";
        explanation = "SAAY does not infer work authorization. Confirm this requirement directly with the employer.";
      }

      results.push({ condition, status: statusValue, jobEvidence: [{ source: "Job posting", quote: job }], candidateEvidence, explanation });
    });
    return results;
  }

  function buildVerificationChecklist(requirements, missingEvidence, eligibility, draft) {
    const items = [];
    eligibility.filter(item => item.status === "needs-verification").forEach(item => {
      items.push({ topic: item.condition, reason: item.explanation, jobEvidence: item.jobEvidence });
    });
    requirements.filter(item => item.verificationHeavy && item.level === "unclassified").forEach(item => {
      items.push({ topic: "Posting detail", reason: "The posting mentions a detail that needs direct confirmation.", jobEvidence: [{ source: "Job posting", quote: item.quote }] });
    });
    if (!draft.job?.officialUrl) items.push({ topic: "Official source", reason: "No official link was entered. Confirm the role details on the employer's official source if available.", jobEvidence: [] });
    if (draft.cv?.pdfAttempt?.status === "selected-manual-paste-required") items.push({ topic: "Selected PDF", reason: "SAAY did not read PDF text. Paste selectable CV text or use profile/manual details if you want it included as evidence.", jobEvidence: [] });
    if (!missingEvidence.length && !items.length) items.push({ topic: "Full posting review", reason: "Read the full official posting for requirements that are not captured by local keyword rules.", jobEvidence: [] });
    return items.slice(0, 10);
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  function createInputFingerprint(draft) {
    const input = {
      sourceSelection: draft.sourceSelection || {},
      profile: draft.profile || {},
      cvText: draft.cv?.text || "",
      manual: draft.manual || {},
      job: draft.job || {}
    };
    let hash = 2166136261;
    const source = stableStringify(input);
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `saay-${(hash >>> 0).toString(36)}`;
  }

  function assess(draft) {
    const requirements = extractJobRequirements(draft.job?.description || "");
    const candidateEvidence = collectCandidateEvidence(draft);
    const keywordRequirements = collectKeywords(requirements, draft.profile || {});
    const matches = [];
    const missingEvidence = [];
    const handled = new Set();

    keywordRequirements.forEach(({ keyword, requirement }) => {
      const key = `${keyword}|${requirement.quote}`;
      if (handled.has(key)) return;
      handled.add(key);
      const evidence = findEvidence(candidateEvidence, keyword);
      if (evidence.length) {
        matches.push({ keyword, requirementLevel: requirement.level, jobEvidence: [{ source: "Job posting", quote: requirement.quote }], candidateEvidence: evidence.slice(0, 3) });
      } else {
        missingEvidence.push({ keyword, requirementLevel: requirement.level, jobEvidence: [{ source: "Job posting", quote: requirement.quote }], message: "No supporting evidence was found in the profile, CV text, or manual details you selected. This is unknown—not proof that you lack this skill." });
      }
    });

    const eligibility = evaluateEligibility(requirements, draft.profile || {});
    const verification = buildVerificationChecklist(requirements, missingEvidence, eligibility, draft);
    return {
      schemaVersion: 2,
      engineVersion: "rules-keywords-v1",
      status: "complete",
      assessedAt: new Date().toISOString(),
      inputFingerprint: createInputFingerprint(draft),
      profileRevisionUsed: draft.profile?.updatedAt || "",
      sourceSelection: { ...draft.sourceSelection },
      candidateSnapshot: {
        profile: { ...draft.profile },
        cvText: draft.cv?.text || "",
        manual: { ...draft.manual },
        pdfAttempt: { ...(draft.cv?.pdfAttempt || { status: "none" }) }
      },
      jobSnapshot: { ...draft.job },
      findings: { matches, missingEvidence, eligibility, verification }
    };
  }

  return { normalizeText, canonicalKeyword, splitEvidenceUnits, collectCandidateEvidence, extractJobRequirements, findEvidence, createInputFingerprint, assess };
}));
