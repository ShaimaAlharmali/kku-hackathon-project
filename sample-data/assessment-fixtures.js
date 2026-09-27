/* Clearly labelled fictional fixtures for verifying SAAY's local assessment rules. */
(function () {
  const analystPosting = {
    company: "Fictional Northstar Analytics",
    title: "Graduate Data Analyst",
    opportunityType: "Graduate Program",
    officialUrl: "https://example.com/northstar-graduate-data-analyst",
    description: "Applicants must be currently enrolled students or recent graduates. Required: Excel and SQL for reporting and data analysis. Preferred: Tableau. Candidates should be available to start in September."
  };

  window.SAAY_ASSESSMENT_FIXTURES = [
    {
      id: "fixture-student-excel",
      label: "Fictional student: Excel evidence",
      profile: { education: "Business Analytics", status: "Student", experience: "Built monthly reporting dashboards using Excel.", skills: "Excel, communication", availability: "September", locations: "Riyadh", workstyle: "Hybrid" },
      sourceSelection: { profile: true, cvPaste: false, manual: false },
      cv: { text: "", pdfAttempt: { status: "none" } },
      manual: {},
      job: analystPosting
    },
    {
      id: "fixture-graduate-conflict",
      label: "Fictional graduate: enrollment mismatch",
      profile: { education: "Information Systems", status: "Graduate", experience: "Prepared reports using Excel.", skills: "Excel", availability: "Flexible" },
      sourceSelection: { profile: true, cvPaste: false, manual: false },
      cv: { text: "", pdfAttempt: { status: "none" } },
      manual: {},
      job: analystPosting
    },
    {
      id: "fixture-cv-keywords",
      label: "Fictional pasted CV: SQL evidence",
      profile: { education: "Computer Science", status: "Recent graduate", skills: "Python" },
      sourceSelection: { profile: true, cvPaste: true, manual: false },
      cv: { text: "Coursework and internship work included SQL data analysis, Excel reporting, and stakeholder presentations.", pdfAttempt: { status: "none" } },
      manual: {},
      job: analystPosting
    },
    {
      id: "fixture-marketing-unknown",
      label: "Fictional marketing role: unknown authorization",
      profile: { education: "Marketing", status: "Student", skills: "Research, communication" },
      sourceSelection: { profile: true, cvPaste: false, manual: false },
      cv: { text: "", pdfAttempt: { status: "none" } },
      manual: {},
      job: {
        company: "Fictional Harbor Studio",
        title: "Marketing Intern",
        opportunityType: "Internship",
        officialUrl: "",
        description: "Required: strong communication and research skills. Preferred: Figma. Applicants must have work authorization and be able to work onsite in Jeddah."
      }
    },
    {
      id: "fixture-pdf-fallback",
      label: "Fictional PDF fallback",
      profile: { education: "Design", status: "Student", skills: "" },
      sourceSelection: { profile: true, cvPaste: false, manual: false },
      cv: { text: "", pdfAttempt: { name: "fictional-cv.pdf", size: 120000, type: "application/pdf", status: "selected-manual-paste-required" } },
      manual: {},
      job: {
        company: "Fictional Cedar Design",
        title: "UX Research Intern",
        opportunityType: "Internship",
        officialUrl: "https://example.com/cedar-ux-intern",
        description: "Required: user research and presentation skills. Preferred: Figma."
      }
    }
  ];
}());
