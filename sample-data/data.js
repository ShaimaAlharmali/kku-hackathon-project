/* Made-up example records. Dates are generated relative to the browser's local day. */
(function () {
  function dateOffset(days) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function daysFromNow(days) {
    return dateOffset(days);
  }

  window.SAAY_SAMPLE_DATA = function createSampleData() {
    const createdAt = new Date().toISOString();
    return [
      {
        id: "demo-14-days-applied",
        isDemo: true,
        company: "Northstar Studio",
        title: "Graduate Product Intern",
        opportunityType: "Internship",
        officialUrl: "https://example.com/northstar-product-intern",
        notes: "Fictional demo record. Saved a tailored portfolio outline.",
        stage: "Applied",
        applicationDate: daysFromNow(-20),
        stageChangedAt: daysFromNow(-14),
        closingDate: "",
        interviewDate: "",
        expectedResponseDate: "",
        nextReminderDate: "",
        followUpHistory: [],
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "demo-13-days-interview",
        isDemo: true,
        company: "Cedar & Co.",
        title: "People Operations Coordinator",
        opportunityType: "Full-Time Job",
        officialUrl: "https://example.com/cedar-people-ops",
        notes: "Fictional demo record. Interview notes are ready to review.",
        stage: "Interview",
        applicationDate: daysFromNow(-18),
        stageChangedAt: daysFromNow(-13),
        closingDate: "",
        interviewDate: daysFromNow(2),
        expectedResponseDate: "",
        nextReminderDate: "",
        followUpHistory: [],
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "demo-saved",
        isDemo: true,
        company: "Harbor Labs",
        title: "Cooperative Training — UX Research",
        opportunityType: "Cooperative Training",
        officialUrl: "https://example.com/harbor-coop",
        notes: "Fictional demo record. Review requirements before applying.",
        stage: "Saved",
        applicationDate: "",
        stageChangedAt: daysFromNow(-3),
        closingDate: daysFromNow(1),
        interviewDate: "",
        expectedResponseDate: "",
        nextReminderDate: "",
        followUpHistory: [],
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "demo-reminder",
        isDemo: true,
        company: "Lumen Health",
        title: "Graduate Program Associate",
        opportunityType: "Graduate Program",
        officialUrl: "https://example.com/lumen-graduate-program",
        notes: "Fictional demo record. A next reminder is due today.",
        stage: "Applied",
        applicationDate: daysFromNow(-7),
        stageChangedAt: daysFromNow(-7),
        closingDate: "",
        interviewDate: "",
        expectedResponseDate: daysFromNow(4),
        nextReminderDate: daysFromNow(0),
        followUpHistory: [
          { id: "follow-up-demo-1", completedAt: daysFromNow(-4), note: "Checked application confirmation." }
        ],
        createdAt,
        updatedAt: createdAt
      }
    ];
  };
}());
