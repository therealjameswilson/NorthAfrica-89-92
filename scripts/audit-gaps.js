#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const reportDir = path.join(repoRoot, "reports");
const reportPath = path.join(reportDir, "gap-audit.json");
const selectionReportPath = path.join(reportDir, "selection-matrix-build.json");
const compilerBriefReportPath = path.join(reportDir, "compiler-brief-build.json");
const sourceNotePacketReportPath = path.join(reportDir, "source-note-packet-build.json");
const decisionWorksheetsReportPath = path.join(reportDir, "decision-worksheets-build.json");
const researchRunbookReportPath = path.join(reportDir, "research-runbook-build.json");
const countryDossiersReportPath = path.join(reportDir, "country-dossiers-build.json");
const draftDocumentListReportPath = path.join(reportDir, "draft-document-list-build.json");
const documentReadinessReportPath = path.join(reportDir, "document-readiness-packet-build.json");
const blockerResolutionReportPath = path.join(reportDir, "blocker-resolution-packet-build.json");
const documentStubsReportPath = path.join(reportDir, "document-stubs-packet-build.json");
const diaryControlReportPath = path.join(reportDir, "diary-control-packet-build.json");
const annotationLeadsReportPath = path.join(reportDir, "annotation-leads-packet-build.json");
const publicationAssemblyReportPath = path.join(reportDir, "publication-assembly-packet-build.json");
const compilerHandoffReportPath = path.join(reportDir, "compiler-handoff-build.json");
const personsAuthorityPacketReportPath = path.join(reportDir, "persons-authority-packet-build.json");

const meta = readJson("volume-meta.json");
const records = readJson("records.json");
const boundaryRecords = readJson("boundary-records.json");
const policyFiles = readJson("policy-files.json");
const publicReferences = readJson("public-references.json");
const persons = readJson("persons.json");
const gapTracker = readJson("gap-tracker.json");
const sourceCopyLedger = readJson("source-copy-ledger.json");
const selectionReport = readOptionalJson(selectionReportPath) || {};
const compilerBriefReport = readOptionalJson(compilerBriefReportPath) || {};
const sourceNotePacketReport = readOptionalJson(sourceNotePacketReportPath) || {};
const decisionWorksheetsReport = readOptionalJson(decisionWorksheetsReportPath) || {};
const researchRunbookReport = readOptionalJson(researchRunbookReportPath) || {};
const countryDossiersReport = readOptionalJson(countryDossiersReportPath) || {};
const draftDocumentListReport = readOptionalJson(draftDocumentListReportPath) || {};
const documentReadinessReport = readOptionalJson(documentReadinessReportPath) || {};
const blockerResolutionReport = readOptionalJson(blockerResolutionReportPath) || {};
const documentStubsReport = readOptionalJson(documentStubsReportPath) || {};
const diaryControlReport = readOptionalJson(diaryControlReportPath) || {};
const annotationLeadsReport = readOptionalJson(annotationLeadsReportPath) || {};
const publicationAssemblyReport = readOptionalJson(publicationAssemblyReportPath) || {};
const compilerHandoffReport = readOptionalJson(compilerHandoffReportPath) || {};
const personsAuthorityPacketReport = readOptionalJson(personsAuthorityPacketReportPath) || {};

const GAP_PERSON_TERMS = [
  "Babangida",
  "Baker",
  "Bashir",
  "Ben Ali",
  "Bendjedid",
  "Buyoya",
  "Diouf",
  "Doe",
  "Filali",
  "Gaddafi",
  "Gadhafi",
  "Habyarimana",
  "Hassan II",
  "Mengistu",
  "Mobutu",
  "Moi",
  "Museveni",
  "Qaddafi",
  "Qadhafi",
  "Taylor"
];

const personHaystacks = persons.map((person) =>
  normalize([person.name, person.displayName, person.entry, ...(person.aliases || [])].join(" "))
);

const chronologyParticipants = uniqueSorted(records.flatMap((record) => record.participants || []));
const boundaryParticipants = uniqueSorted(boundaryRecords.flatMap((record) => record.participants || []));
const gapText = JSON.stringify(gapTracker);
const gapPersonTerms = GAP_PERSON_TERMS.filter((term) => gapText.includes(term));
const unresolvedTerms = ["Abdelhamid"].filter((term) => gapText.includes(term));
const expectedSelectionMatrixCount = records.length + boundaryRecords.length + policyFiles.length + publicReferences.length;
const expectedSourceNotePacketCount = records.length + boundaryRecords.length + policyFiles.length;
const expectedCriticalGapCount = gapTracker.filter((gap) => gap.priority === "Critical").length;
const expectedCountryDossierCount = new Set((meta.chapters || []).flatMap((chapter) => chapter.countries || [])).size;
const expectedDraftProposedCount = (selectionReport.byRecommendation?.["Candidate core document"] || 0) + (selectionReport.byRecommendation?.["Policy anchor candidate"] || 0);
const expectedDraftConditionalCount =
  (selectionReport.byRecommendation?.["Source-copy search"] || 0) +
  (selectionReport.byRecommendation?.["Declassification review"] || 0) +
  (selectionReport.byRecommendation?.["Cross-volume review"] || 0);

const reportBody = {
  personsCount: persons.length,
  selectionMatrixCount: selectionReport.selectionCount || 0,
  expectedSelectionMatrixCount,
  compilerBriefSelectionCount: compilerBriefReport.selectionCount || 0,
  compilerBriefQueueCount: compilerBriefReport.queueCount || 0,
  compilerBriefSourceNoteRows: compilerBriefReport.sourceNoteRows || 0,
  sourceNotePacketCount: sourceNotePacketReport.sourceRows || 0,
  expectedSourceNotePacketCount,
  sourceNotePacketFrusSourceNoteRows: sourceNotePacketReport.frusSourceNoteRows || 0,
  sourceNotePacketGroupCount: sourceNotePacketReport.groupCount || 0,
  sourceNotePacketMissingFrusSourceNoteRows: sourceNotePacketReport.missingFrusSourceNoteRows || 0,
  decisionWorksheetCount: decisionWorksheetsReport.worksheetCount || 0,
  decisionWorksheetSelectionRows: decisionWorksheetsReport.selectionDecisionRows || 0,
  decisionWorksheetAuthorityReviewRows: decisionWorksheetsReport.authorityReviewRows || 0,
  decisionWorksheetCsvFiles: decisionWorksheetsReport.csvFiles || [],
  researchRunbookGapCount: researchRunbookReport.gapCount || 0,
  expectedResearchRunbookGapCount: gapTracker.length,
  researchRunbookCriticalGapCount: researchRunbookReport.criticalGapCount || 0,
  expectedResearchRunbookCriticalGapCount: expectedCriticalGapCount,
  researchRunbookQueryCount: researchRunbookReport.queryCount || 0,
  researchRunbookStateDepartmentQueryCount: researchRunbookReport.stateDepartmentQueryCount || 0,
  researchRunbookCsvFiles: researchRunbookReport.csvFiles || [],
  countryDossierCount: countryDossiersReport.dossierCount || 0,
  expectedCountryDossierCount,
  countryDossierNoChronologyCount: countryDossiersReport.noChronologyCountries || 0,
  countryDossierQueryRows: countryDossiersReport.queryRows || 0,
  countryDossierCsvFiles: countryDossiersReport.csvFiles || [],
  draftDocumentProposedCount: draftDocumentListReport.proposedCount || 0,
  expectedDraftDocumentProposedCount: expectedDraftProposedCount,
  draftDocumentConditionalCount: draftDocumentListReport.conditionalCount || 0,
  expectedDraftDocumentConditionalCount: expectedDraftConditionalCount,
  draftDocumentMissingSourceNoteCount: draftDocumentListReport.missingSourceNoteCount || 0,
  draftDocumentChapterCount: draftDocumentListReport.chapterCount || 0,
  draftDocumentCsvFiles: draftDocumentListReport.csvFiles || [],
  documentReadinessCount: documentReadinessReport.documentCount || 0,
  documentReadinessProposedCount: documentReadinessReport.proposedCount || 0,
  documentReadinessConditionalCount: documentReadinessReport.conditionalCount || 0,
  documentReadinessReadyForReadCount: documentReadinessReport.readyForReadCount || 0,
  documentReadinessReadyWithAuthorityCheckCount: documentReadinessReport.readyWithAuthorityCheckCount || 0,
  documentReadinessBlockerCount: documentReadinessReport.blockerCount || 0,
  documentReadinessSourceCopyCount: documentReadinessReport.sourceCopyCount || 0,
  documentReadinessDeclassificationCount: documentReadinessReport.declassificationCount || 0,
  documentReadinessCrossVolumeCount: documentReadinessReport.crossVolumeCount || 0,
  documentReadinessMissingSourceNoteCount: documentReadinessReport.missingSourceNoteCount || 0,
  documentReadinessDiaryMatchedCount: documentReadinessReport.diaryMatchedCount || 0,
  documentReadinessCsvFiles: documentReadinessReport.csvFiles || [],
  blockerResolutionCount: blockerResolutionReport.blockerCount || 0,
  blockerResolutionSourceCopyCount: blockerResolutionReport.sourceCopyCount || 0,
  blockerResolutionDeclassificationCount: blockerResolutionReport.declassificationCount || 0,
  blockerResolutionCrossVolumeCount: blockerResolutionReport.crossVolumeCount || 0,
  blockerResolutionDiaryControlledCount: blockerResolutionReport.diaryControlledCount || 0,
  blockerResolutionFrusSourceNoteCount: blockerResolutionReport.frusSourceNoteCount || 0,
  blockerResolutionQueryLinkedCount: blockerResolutionReport.queryLinkedCount || 0,
  blockerResolutionComparatorLinkedCount: blockerResolutionReport.comparatorLinkedCount || 0,
  blockerResolutionCsvFiles: blockerResolutionReport.csvFiles || [],
  documentStubsCount: documentStubsReport.stubCount || 0,
  documentStubsReadyCount: documentStubsReport.readyStubCount || 0,
  documentStubsAuthorityCount: documentStubsReport.authorityStubCount || 0,
  documentStubsBlockerCount: documentStubsReport.blockerStubCount || 0,
  documentStubsSourceNoteCount: documentStubsReport.sourceNoteStubCount || 0,
  documentStubsDiaryControlledCount: documentStubsReport.diaryControlledStubCount || 0,
  documentStubsAuthorityReviewCount: documentStubsReport.authorityReviewStubCount || 0,
  documentStubsSourceCopyCount: documentStubsReport.sourceCopyStubCount || 0,
  documentStubsDeclassificationCount: documentStubsReport.declassificationStubCount || 0,
  documentStubsCrossVolumeCount: documentStubsReport.crossVolumeStubCount || 0,
  documentStubsFiles: documentStubsReport.stubFiles || [],
  documentStubsCsvFiles: documentStubsReport.csvFiles || [],
  diaryControlSourceSeriesNaid: diaryControlReport.sourceSeriesNaid || "",
  diaryControlRows: diaryControlReport.controlRows || 0,
  diaryControlMatchedRows: diaryControlReport.matchedRows || 0,
  diaryControlMissingRows: diaryControlReport.missingRows || 0,
  diaryControlVolumeRows: diaryControlReport.volumeRows || 0,
  diaryControlBoundaryRows: diaryControlReport.boundaryRows || 0,
  diaryControlReadyRows: diaryControlReport.readyRows || 0,
  diaryControlBlockerRows: diaryControlReport.blockerRows || 0,
  diaryControlReferenceCount: diaryControlReport.diaryReferenceCount || 0,
  diaryControlUniqueReferenceCount: diaryControlReport.uniqueDiaryReferenceCount || 0,
  diaryControlDailyDiaryReferenceCount: diaryControlReport.dailyDiaryReferenceCount || 0,
  diaryControlDailyBackupReferenceCount: diaryControlReport.dailyBackupReferenceCount || 0,
  diaryControlCallRows: diaryControlReport.callRows || 0,
  diaryControlMeetingRows: diaryControlReport.meetingRows || 0,
  diaryControlMarkdown: diaryControlReport.markdown || "",
  diaryControlCsvFiles: diaryControlReport.csvFiles || [],
  annotationLeadsDocumentCount: annotationLeadsReport.documentCount || 0,
  annotationLeadsPublicReferencePoolCount: annotationLeadsReport.publicReferencePoolCount || 0,
  annotationLeadsDocumentsWithPublicLeads: annotationLeadsReport.documentsWithPublicLeads || 0,
  annotationLeadsDocumentsWithDirectPublicLeads: annotationLeadsReport.documentsWithDirectPublicLeads || 0,
  annotationLeadsContextOnlyPublicLeadRows: annotationLeadsReport.contextOnlyPublicLeadRows || 0,
  annotationLeadsDocumentsWithoutPublicLeads: annotationLeadsReport.documentsWithoutPublicLeads || 0,
  annotationLeadsPublicReferenceLinkCount: annotationLeadsReport.publicReferenceLinkCount || 0,
  annotationLeadsUniquePublicReferenceCount: annotationLeadsReport.uniquePublicReferenceCount || 0,
  annotationLeadsReadyRows: annotationLeadsReport.readyAnnotationRows || 0,
  annotationLeadsAuthorityReviewRows: annotationLeadsReport.authorityReviewRows || 0,
  annotationLeadsBlockerRows: annotationLeadsReport.blockerRows || 0,
  annotationLeadsDiaryControlledRows: annotationLeadsReport.diaryControlledRows || 0,
  annotationLeadsSourceNoteRows: annotationLeadsReport.sourceNoteRows || 0,
  annotationLeadsMarkdown: annotationLeadsReport.markdown || "",
  annotationLeadsCsvFiles: annotationLeadsReport.csvFiles || [],
  publicationAssemblyRows: publicationAssemblyReport.assemblyRows || 0,
  publicationAssemblyProposedRows: publicationAssemblyReport.proposedRows || 0,
  publicationAssemblyConditionalRows: publicationAssemblyReport.conditionalRows || 0,
  publicationAssemblyReadyToNumberRows: publicationAssemblyReport.readyToNumberRows || 0,
  publicationAssemblyAuthorityRows: publicationAssemblyReport.authorityCheckRows || 0,
  publicationAssemblyBlockerRows: publicationAssemblyReport.blockerRows || 0,
  publicationAssemblyChapterCount: publicationAssemblyReport.chapterCount || 0,
  publicationAssemblySourceNoteRows: publicationAssemblyReport.sourceNoteRows || 0,
  publicationAssemblyDiaryControlledRows: publicationAssemblyReport.diaryControlledRows || 0,
  publicationAssemblyDirectPublicLeadRows: publicationAssemblyReport.directPublicLeadRows || 0,
  publicationAssemblyPublicLineGapRows: publicationAssemblyReport.publicLineGapRows || 0,
  publicationAssemblyMarkdown: publicationAssemblyReport.markdown || "",
  publicationAssemblyCsvFiles: publicationAssemblyReport.csvFiles || [],
  compilerHandoffChronologyRows: compilerHandoffReport.chronologyRows || 0,
  compilerHandoffDocumentStubs: compilerHandoffReport.documentStubs || 0,
  compilerHandoffAssemblyRows: compilerHandoffReport.assemblyRows || 0,
  compilerHandoffAssemblyReadyToNumberRows: compilerHandoffReport.assemblyReadyToNumberRows || 0,
  compilerHandoffAssemblyAuthorityRows: compilerHandoffReport.assemblyAuthorityRows || 0,
  compilerHandoffAssemblyBlockerRows: compilerHandoffReport.assemblyBlockerRows || 0,
  compilerHandoffDiaryControlRows: compilerHandoffReport.diaryControlRows || 0,
  compilerHandoffDiaryReferenceFiles: compilerHandoffReport.diaryReferenceFiles || 0,
  compilerHandoffAnnotationRows: compilerHandoffReport.annotationRows || 0,
  compilerHandoffDirectAnnotationRows: compilerHandoffReport.directAnnotationRows || 0,
  compilerHandoffContextOnlyAnnotationRows: compilerHandoffReport.contextOnlyAnnotationRows || 0,
  compilerHandoffPublicLineGapRows: compilerHandoffReport.publicLineGapRows || 0,
  compilerHandoffReadyForReadRows: compilerHandoffReport.readyForReadRows || 0,
  compilerHandoffReadyWithAuthorityCheckRows: compilerHandoffReport.readyWithAuthorityCheckRows || 0,
  compilerHandoffBlockerRows: compilerHandoffReport.blockerRows || 0,
  compilerHandoffAuthorityReviewRows: compilerHandoffReport.authorityReviewRows || 0,
  compilerHandoffSourceNoteRows: compilerHandoffReport.sourceNoteRows || 0,
  compilerHandoffSectionCount: compilerHandoffReport.sectionCount || 0,
  compilerHandoffPacketCount: compilerHandoffReport.packetCount || 0,
  compilerHandoffReportCount: compilerHandoffReport.reportCount || 0,
  compilerHandoffCsvCount: compilerHandoffReport.csvCount || 0,
  compilerHandoffLiveSectionIds: compilerHandoffReport.liveSectionIds || [],
  compilerHandoffRefreshCommandCount: compilerHandoffReport.refreshCommandCount || 0,
  compilerHandoffRefreshCommands: compilerHandoffReport.refreshCommands || [],
  compilerHandoffMarkdown: compilerHandoffReport.markdown || "",
  compilerHandoffLinksCsv: compilerHandoffReport.linksCsv || "",
  personsAuthorityPacketPersonCount: personsAuthorityPacketReport.personCount || 0,
  personsAuthorityPacketAuthorityMode: personsAuthorityPacketReport.authorityMode || "",
  personsAuthorityPacketAuthorityEntryCount: personsAuthorityPacketReport.authorityEntryCount || 0,
  personsAuthorityPacketReviewCount: personsAuthorityPacketReport.reviewCount || 0,
  personsAuthorityPacketDocumentLinkCount: personsAuthorityPacketReport.documentLinkCount || 0,
  personsAuthorityPacketReviewDocumentLinkCount: personsAuthorityPacketReport.reviewDocumentLinkCount || 0,
  personsAuthorityPacketHighPriorityReviewCount: personsAuthorityPacketReport.highPriorityReviewCount || 0,
  personsAuthorityPacketCsvFiles: personsAuthorityPacketReport.csvFiles || [],
  selectionMatrixByRecommendation: selectionReport.byRecommendation || {},
  sourceCopyLedgerCount: sourceCopyLedger.length,
  sourceCopyLedgerByIssue: countBy(sourceCopyLedger.map((item) => item.issueType)),
  missingChronologyParticipants: chronologyParticipants.filter((name) => !included(name)),
  missingBoundaryParticipants: boundaryParticipants.filter((name) => !included(name)),
  missingGapPersonTerms: gapPersonTerms.filter((term) => !included(term)),
  unresolvedPersonTargets: unresolvedTerms,
  personsNeedingAuthorityReview: persons
    .filter((person) => person.needsReview)
    .map((person) => ({
      name: person.name,
      entry: person.entry,
      reviewReason: person.reviewReason,
      scopes: person.scopes,
      aliases: person.aliases || []
    }))
};
const previousReport = readOptionalJson(reportPath);
const report = {
  generatedAt: sameReportBody(previousReport, reportBody) ? previousReport.generatedAt : new Date().toISOString(),
  ...reportBody
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const failures = [
  ...(report.selectionMatrixCount === report.expectedSelectionMatrixCount
    ? []
    : [`selection matrix count mismatch: expected ${report.expectedSelectionMatrixCount}, found ${report.selectionMatrixCount}`]),
  ...(report.compilerBriefSelectionCount === report.expectedSelectionMatrixCount
    ? []
    : [`compiler brief selection count mismatch: expected ${report.expectedSelectionMatrixCount}, found ${report.compilerBriefSelectionCount}`]),
  ...(report.compilerBriefQueueCount >= 7 ? [] : [`compiler brief queue count too low: found ${report.compilerBriefQueueCount}`]),
  ...(report.compilerBriefSourceNoteRows === report.expectedSelectionMatrixCount
    ? []
    : [`compiler brief source-note coverage mismatch: expected ${report.expectedSelectionMatrixCount}, found ${report.compilerBriefSourceNoteRows}`]),
  ...(report.sourceNotePacketCount === report.expectedSourceNotePacketCount
    ? []
    : [`source-note packet count mismatch: expected ${report.expectedSourceNotePacketCount}, found ${report.sourceNotePacketCount}`]),
  ...(report.sourceNotePacketFrusSourceNoteRows === report.expectedSourceNotePacketCount
    ? []
    : [
        `source-note packet FRUS note coverage mismatch: expected ${report.expectedSourceNotePacketCount}, found ${report.sourceNotePacketFrusSourceNoteRows}`
      ]),
  ...(report.sourceNotePacketGroupCount >= 6 ? [] : [`source-note packet group count too low: found ${report.sourceNotePacketGroupCount}`]),
  ...(report.sourceNotePacketMissingFrusSourceNoteRows === 0
    ? []
    : [`source-note packet has missing FRUS source notes: ${report.sourceNotePacketMissingFrusSourceNoteRows}`]),
  ...(report.decisionWorksheetCount >= 7 ? [] : [`decision worksheet count too low: found ${report.decisionWorksheetCount}`]),
  ...(report.decisionWorksheetSelectionRows === report.expectedSelectionMatrixCount
    ? []
    : [`decision worksheet selection count mismatch: expected ${report.expectedSelectionMatrixCount}, found ${report.decisionWorksheetSelectionRows}`]),
  ...(report.decisionWorksheetAuthorityReviewRows === report.personsNeedingAuthorityReview.length
    ? []
    : [
        `decision worksheet authority-review count mismatch: expected ${report.personsNeedingAuthorityReview.length}, found ${report.decisionWorksheetAuthorityReviewRows}`
      ]),
  ...report.decisionWorksheetCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing decision worksheet CSV: ${filePath}`),
  ...(report.researchRunbookGapCount === report.expectedResearchRunbookGapCount
    ? []
    : [`research runbook gap count mismatch: expected ${report.expectedResearchRunbookGapCount}, found ${report.researchRunbookGapCount}`]),
  ...(report.researchRunbookCriticalGapCount === report.expectedResearchRunbookCriticalGapCount
    ? []
    : [
        `research runbook critical-gap count mismatch: expected ${report.expectedResearchRunbookCriticalGapCount}, found ${report.researchRunbookCriticalGapCount}`
      ]),
  ...(report.researchRunbookQueryCount >= report.expectedResearchRunbookGapCount
    ? []
    : [`research runbook query count too low: found ${report.researchRunbookQueryCount}`]),
  ...(report.researchRunbookStateDepartmentQueryCount > 0
    ? []
    : ["research runbook is missing State Department query rows"]),
  ...report.researchRunbookCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing research runbook CSV: ${filePath}`),
  ...(report.countryDossierCount >= report.expectedCountryDossierCount
    ? []
    : [`country dossier count mismatch: expected at least ${report.expectedCountryDossierCount}, found ${report.countryDossierCount}`]),
  ...(report.countryDossierQueryRows >= report.countryDossierNoChronologyCount
    ? []
    : [`country dossier query count too low: found ${report.countryDossierQueryRows}`]),
  ...report.countryDossierCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing country dossier CSV: ${filePath}`),
  ...(report.draftDocumentProposedCount === report.expectedDraftDocumentProposedCount
    ? []
    : [
        `draft document proposed count mismatch: expected ${report.expectedDraftDocumentProposedCount}, found ${report.draftDocumentProposedCount}`
      ]),
  ...(report.draftDocumentConditionalCount === report.expectedDraftDocumentConditionalCount
    ? []
    : [
        `draft document conditional count mismatch: expected ${report.expectedDraftDocumentConditionalCount}, found ${report.draftDocumentConditionalCount}`
      ]),
  ...(report.draftDocumentMissingSourceNoteCount === 0
    ? []
    : [`draft document list has missing FRUS source notes: ${report.draftDocumentMissingSourceNoteCount}`]),
  ...(report.draftDocumentChapterCount === (meta.chapters || []).length
    ? []
    : [`draft document chapter count mismatch: expected ${(meta.chapters || []).length}, found ${report.draftDocumentChapterCount}`]),
  ...report.draftDocumentCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing draft document CSV: ${filePath}`),
  ...(report.documentReadinessCount === report.draftDocumentProposedCount + report.draftDocumentConditionalCount
    ? []
    : [
        `document readiness count mismatch: expected ${
          report.draftDocumentProposedCount + report.draftDocumentConditionalCount
        }, found ${report.documentReadinessCount}`
      ]),
  ...(report.documentReadinessProposedCount === report.draftDocumentProposedCount
    ? []
    : [
        `document readiness proposed count mismatch: expected ${report.draftDocumentProposedCount}, found ${report.documentReadinessProposedCount}`
      ]),
  ...(report.documentReadinessConditionalCount === report.draftDocumentConditionalCount
    ? []
    : [
        `document readiness conditional count mismatch: expected ${report.draftDocumentConditionalCount}, found ${report.documentReadinessConditionalCount}`
      ]),
  ...(report.documentReadinessMissingSourceNoteCount === 0
    ? []
    : [`document readiness packet has missing FRUS source notes: ${report.documentReadinessMissingSourceNoteCount}`]),
  ...(report.documentReadinessSourceCopyCount === (draftDocumentListReport.sourceCopyBlockers || 0)
    ? []
    : [
        `document readiness source-copy count mismatch: expected ${draftDocumentListReport.sourceCopyBlockers || 0}, found ${report.documentReadinessSourceCopyCount}`
      ]),
  ...(report.documentReadinessDeclassificationCount === (draftDocumentListReport.declassificationBlockers || 0)
    ? []
    : [
        `document readiness declassification count mismatch: expected ${draftDocumentListReport.declassificationBlockers || 0}, found ${report.documentReadinessDeclassificationCount}`
      ]),
  ...(report.documentReadinessCrossVolumeCount === (draftDocumentListReport.crossVolumeScreens || 0)
    ? []
    : [
        `document readiness cross-volume count mismatch: expected ${draftDocumentListReport.crossVolumeScreens || 0}, found ${report.documentReadinessCrossVolumeCount}`
      ]),
  ...(report.documentReadinessReadyForReadCount + report.documentReadinessReadyWithAuthorityCheckCount > 0
    ? []
    : ["document readiness packet has no ready rows"]),
  ...(report.documentReadinessDiaryMatchedCount >= report.documentReadinessCount - 5
    ? []
    : [
        `document readiness diary-match count unexpectedly low: ${report.documentReadinessDiaryMatchedCount} of ${report.documentReadinessCount}`
      ]),
  ...report.documentReadinessCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing document readiness CSV: ${filePath}`),
  ...(report.blockerResolutionCount === report.documentReadinessBlockerCount
    ? []
    : [
        `blocker resolution count mismatch: expected ${report.documentReadinessBlockerCount}, found ${report.blockerResolutionCount}`
      ]),
  ...(report.blockerResolutionSourceCopyCount === report.documentReadinessSourceCopyCount
    ? []
    : [
        `blocker resolution source-copy count mismatch: expected ${report.documentReadinessSourceCopyCount}, found ${report.blockerResolutionSourceCopyCount}`
      ]),
  ...(report.blockerResolutionDeclassificationCount === report.documentReadinessDeclassificationCount
    ? []
    : [
        `blocker resolution declassification count mismatch: expected ${report.documentReadinessDeclassificationCount}, found ${report.blockerResolutionDeclassificationCount}`
      ]),
  ...(report.blockerResolutionCrossVolumeCount === report.documentReadinessCrossVolumeCount
    ? []
    : [
        `blocker resolution cross-volume count mismatch: expected ${report.documentReadinessCrossVolumeCount}, found ${report.blockerResolutionCrossVolumeCount}`
      ]),
  ...(report.blockerResolutionFrusSourceNoteCount === report.blockerResolutionCount
    ? []
    : [
        `blocker resolution FRUS source-note coverage mismatch: expected ${report.blockerResolutionCount}, found ${report.blockerResolutionFrusSourceNoteCount}`
      ]),
  ...(report.blockerResolutionDiaryControlledCount === report.blockerResolutionCount
    ? []
    : [
        `blocker resolution diary-control coverage mismatch: expected ${report.blockerResolutionCount}, found ${report.blockerResolutionDiaryControlledCount}`
      ]),
  ...(report.blockerResolutionQueryLinkedCount === report.blockerResolutionCount
    ? []
    : [
        `blocker resolution query-link coverage mismatch: expected ${report.blockerResolutionCount}, found ${report.blockerResolutionQueryLinkedCount}`
      ]),
  ...(report.blockerResolutionComparatorLinkedCount === report.blockerResolutionCrossVolumeCount
    ? []
    : [
        `blocker resolution comparator coverage mismatch: expected ${report.blockerResolutionCrossVolumeCount}, found ${report.blockerResolutionComparatorLinkedCount}`
      ]),
  ...report.blockerResolutionCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing blocker resolution CSV: ${filePath}`),
  ...(report.documentStubsCount === report.documentReadinessCount
    ? []
    : [`document stubs count mismatch: expected ${report.documentReadinessCount}, found ${report.documentStubsCount}`]),
  ...(report.documentStubsReadyCount === report.documentReadinessReadyForReadCount
    ? []
    : [
        `document stubs ready count mismatch: expected ${report.documentReadinessReadyForReadCount}, found ${report.documentStubsReadyCount}`
      ]),
  ...(report.documentStubsAuthorityCount === report.documentReadinessReadyWithAuthorityCheckCount
    ? []
    : [
        `document stubs authority count mismatch: expected ${report.documentReadinessReadyWithAuthorityCheckCount}, found ${report.documentStubsAuthorityCount}`
      ]),
  ...(report.documentStubsBlockerCount === report.blockerResolutionCount
    ? []
    : [`document stubs blocker count mismatch: expected ${report.blockerResolutionCount}, found ${report.documentStubsBlockerCount}`]),
  ...(report.documentStubsSourceNoteCount === report.documentStubsCount
    ? []
    : [
        `document stubs source-note coverage mismatch: expected ${report.documentStubsCount}, found ${report.documentStubsSourceNoteCount}`
      ]),
  ...(report.documentStubsDiaryControlledCount >= report.documentStubsCount - 5
    ? []
    : [
        `document stubs diary-control coverage unexpectedly low: ${report.documentStubsDiaryControlledCount} of ${report.documentStubsCount}`
      ]),
  ...(report.documentStubsSourceCopyCount === report.blockerResolutionSourceCopyCount
    ? []
    : [
        `document stubs source-copy count mismatch: expected ${report.blockerResolutionSourceCopyCount}, found ${report.documentStubsSourceCopyCount}`
      ]),
  ...(report.documentStubsDeclassificationCount === report.blockerResolutionDeclassificationCount
    ? []
    : [
        `document stubs declassification count mismatch: expected ${report.blockerResolutionDeclassificationCount}, found ${report.documentStubsDeclassificationCount}`
      ]),
  ...(report.documentStubsCrossVolumeCount === report.blockerResolutionCrossVolumeCount
    ? []
    : [
        `document stubs cross-volume count mismatch: expected ${report.blockerResolutionCrossVolumeCount}, found ${report.documentStubsCrossVolumeCount}`
      ]),
  ...report.documentStubsFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing document stub file: ${filePath}`),
  ...report.documentStubsCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing document stubs CSV: ${filePath}`),
  ...(report.diaryControlSourceSeriesNaid === "186322"
    ? []
    : [`diary control packet source series mismatch: ${report.diaryControlSourceSeriesNaid || "blank"}`]),
  ...(report.diaryControlRows === records.length + boundaryRecords.length
    ? []
    : [`diary control row count mismatch: expected ${records.length + boundaryRecords.length}, found ${report.diaryControlRows}`]),
  ...(report.diaryControlMatchedRows === report.diaryControlRows
    ? []
    : [`diary control matched count mismatch: expected ${report.diaryControlRows}, found ${report.diaryControlMatchedRows}`]),
  ...(report.diaryControlMissingRows === 0
    ? []
    : [`diary control packet has missing rows: ${report.diaryControlMissingRows}`]),
  ...(report.diaryControlVolumeRows === records.length
    ? []
    : [`diary control volume-row count mismatch: expected ${records.length}, found ${report.diaryControlVolumeRows}`]),
  ...(report.diaryControlBoundaryRows === boundaryRecords.length
    ? []
    : [`diary control boundary-row count mismatch: expected ${boundaryRecords.length}, found ${report.diaryControlBoundaryRows}`]),
  ...(report.diaryControlReadyRows + report.diaryControlBlockerRows === records.length
    ? []
    : [
        `diary control draft queue count mismatch: expected ${records.length}, found ${
          report.diaryControlReadyRows + report.diaryControlBlockerRows
        }`
      ]),
  ...(report.diaryControlBlockerRows === report.blockerResolutionCount
    ? []
    : [`diary control blocker count mismatch: expected ${report.blockerResolutionCount}, found ${report.diaryControlBlockerRows}`]),
  ...(report.diaryControlReferenceCount >= report.diaryControlRows
    ? []
    : [`diary control reference count too low: found ${report.diaryControlReferenceCount}`]),
  ...(report.diaryControlUniqueReferenceCount > 100
    ? []
    : [`diary control unique reference count too low: found ${report.diaryControlUniqueReferenceCount}`]),
  ...(report.diaryControlDailyDiaryReferenceCount > 0 && report.diaryControlDailyBackupReferenceCount > 0
    ? []
    : ["diary control packet is missing Daily Diary or Daily Backup reference coverage"]),
  ...(report.diaryControlCallRows > 0 && report.diaryControlMeetingRows > 0
    ? []
    : ["diary control packet is missing call or meeting rows"]),
  ...(report.diaryControlMarkdown && fs.existsSync(path.join(repoRoot, report.diaryControlMarkdown))
    ? []
    : [`missing diary control Markdown: ${report.diaryControlMarkdown || "blank"}`]),
  ...report.diaryControlCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing diary control CSV: ${filePath}`),
  ...(report.annotationLeadsDocumentCount === report.documentReadinessCount
    ? []
    : [`annotation leads document count mismatch: expected ${report.documentReadinessCount}, found ${report.annotationLeadsDocumentCount}`]),
  ...(report.annotationLeadsPublicReferencePoolCount === publicReferences.length
    ? []
    : [
        `annotation leads public-reference pool mismatch: expected ${publicReferences.length}, found ${report.annotationLeadsPublicReferencePoolCount}`
      ]),
  ...(report.annotationLeadsDocumentsWithPublicLeads + report.annotationLeadsDocumentsWithoutPublicLeads === report.annotationLeadsDocumentCount
    ? []
    : [
        `annotation leads public coverage does not sum to document count: ${
          report.annotationLeadsDocumentsWithPublicLeads + report.annotationLeadsDocumentsWithoutPublicLeads
        } of ${report.annotationLeadsDocumentCount}`
      ]),
  ...(report.annotationLeadsDocumentsWithDirectPublicLeads + report.annotationLeadsContextOnlyPublicLeadRows === report.annotationLeadsDocumentsWithPublicLeads
    ? []
    : [
        `annotation leads direct/context coverage mismatch: ${
          report.annotationLeadsDocumentsWithDirectPublicLeads + report.annotationLeadsContextOnlyPublicLeadRows
        } of ${report.annotationLeadsDocumentsWithPublicLeads}`
      ]),
  ...(report.annotationLeadsPublicReferenceLinkCount >= report.annotationLeadsDocumentsWithPublicLeads
    ? []
    : [`annotation leads public-link count too low: found ${report.annotationLeadsPublicReferenceLinkCount}`]),
  ...(report.annotationLeadsUniquePublicReferenceCount > 0
    ? []
    : ["annotation leads packet has no unique public references"]),
  ...(report.annotationLeadsReadyRows > 0
    ? []
    : ["annotation leads packet has no ready annotation rows"]),
  ...(report.annotationLeadsAuthorityReviewRows === report.documentStubsAuthorityReviewCount
    ? []
    : [
        `annotation leads authority-review count mismatch: expected ${report.documentStubsAuthorityReviewCount}, found ${report.annotationLeadsAuthorityReviewRows}`
      ]),
  ...(report.annotationLeadsBlockerRows === report.blockerResolutionCount
    ? []
    : [`annotation leads blocker count mismatch: expected ${report.blockerResolutionCount}, found ${report.annotationLeadsBlockerRows}`]),
  ...(report.annotationLeadsDiaryControlledRows === report.documentReadinessDiaryMatchedCount
    ? []
    : [
        `annotation leads diary-control count mismatch: expected ${report.documentReadinessDiaryMatchedCount}, found ${report.annotationLeadsDiaryControlledRows}`
      ]),
  ...(report.annotationLeadsSourceNoteRows === report.documentReadinessCount
    ? []
    : [
        `annotation leads source-note coverage mismatch: expected ${report.documentReadinessCount}, found ${report.annotationLeadsSourceNoteRows}`
      ]),
  ...(report.annotationLeadsMarkdown && fs.existsSync(path.join(repoRoot, report.annotationLeadsMarkdown))
    ? []
    : [`missing annotation leads Markdown: ${report.annotationLeadsMarkdown || "blank"}`]),
  ...report.annotationLeadsCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing annotation leads CSV: ${filePath}`),
  ...(report.publicationAssemblyRows === report.documentReadinessCount
    ? []
    : [
        `publication assembly row count mismatch: expected ${report.documentReadinessCount}, found ${report.publicationAssemblyRows}`
      ]),
  ...(report.publicationAssemblyProposedRows === report.draftDocumentProposedCount
    ? []
    : [
        `publication assembly proposed count mismatch: expected ${report.draftDocumentProposedCount}, found ${report.publicationAssemblyProposedRows}`
      ]),
  ...(report.publicationAssemblyConditionalRows === report.draftDocumentConditionalCount
    ? []
    : [
        `publication assembly conditional count mismatch: expected ${report.draftDocumentConditionalCount}, found ${report.publicationAssemblyConditionalRows}`
      ]),
  ...(report.publicationAssemblyReadyToNumberRows === report.documentReadinessReadyForReadCount
    ? []
    : [
        `publication assembly ready-to-number count mismatch: expected ${report.documentReadinessReadyForReadCount}, found ${report.publicationAssemblyReadyToNumberRows}`
      ]),
  ...(report.publicationAssemblyAuthorityRows === report.documentReadinessReadyWithAuthorityCheckCount
    ? []
    : [
        `publication assembly authority count mismatch: expected ${report.documentReadinessReadyWithAuthorityCheckCount}, found ${report.publicationAssemblyAuthorityRows}`
      ]),
  ...(report.publicationAssemblyBlockerRows === report.blockerResolutionCount
    ? []
    : [
        `publication assembly blocker count mismatch: expected ${report.blockerResolutionCount}, found ${report.publicationAssemblyBlockerRows}`
      ]),
  ...(report.publicationAssemblyChapterCount === (meta.chapters || []).length
    ? []
    : [
        `publication assembly chapter count mismatch: expected ${(meta.chapters || []).length}, found ${report.publicationAssemblyChapterCount}`
      ]),
  ...(report.publicationAssemblySourceNoteRows === report.documentReadinessCount
    ? []
    : [
        `publication assembly source-note coverage mismatch: expected ${report.documentReadinessCount}, found ${report.publicationAssemblySourceNoteRows}`
      ]),
  ...(report.publicationAssemblyDiaryControlledRows === report.documentReadinessDiaryMatchedCount
    ? []
    : [
        `publication assembly diary-control coverage mismatch: expected ${report.documentReadinessDiaryMatchedCount}, found ${report.publicationAssemblyDiaryControlledRows}`
      ]),
  ...(report.publicationAssemblyDirectPublicLeadRows === report.annotationLeadsDocumentsWithDirectPublicLeads
    ? []
    : [
        `publication assembly direct public lead count mismatch: expected ${report.annotationLeadsDocumentsWithDirectPublicLeads}, found ${report.publicationAssemblyDirectPublicLeadRows}`
      ]),
  ...(report.publicationAssemblyPublicLineGapRows === report.annotationLeadsDocumentsWithoutPublicLeads
    ? []
    : [
        `publication assembly public-line gap count mismatch: expected ${report.annotationLeadsDocumentsWithoutPublicLeads}, found ${report.publicationAssemblyPublicLineGapRows}`
      ]),
  ...(report.publicationAssemblyMarkdown && fs.existsSync(path.join(repoRoot, report.publicationAssemblyMarkdown))
    ? []
    : [`missing publication assembly Markdown: ${report.publicationAssemblyMarkdown || "blank"}`]),
  ...report.publicationAssemblyCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing publication assembly CSV: ${filePath}`),
  ...(report.compilerHandoffChronologyRows === records.length
    ? []
    : [`compiler handoff chronology count mismatch: expected ${records.length}, found ${report.compilerHandoffChronologyRows}`]),
  ...(report.compilerHandoffAssemblyRows === report.publicationAssemblyRows
    ? []
    : [
        `compiler handoff assembly count mismatch: expected ${report.publicationAssemblyRows}, found ${report.compilerHandoffAssemblyRows}`
      ]),
  ...(report.compilerHandoffAssemblyReadyToNumberRows === report.publicationAssemblyReadyToNumberRows
    ? []
    : [
        `compiler handoff assembly ready count mismatch: expected ${report.publicationAssemblyReadyToNumberRows}, found ${report.compilerHandoffAssemblyReadyToNumberRows}`
      ]),
  ...(report.compilerHandoffAssemblyAuthorityRows === report.publicationAssemblyAuthorityRows
    ? []
    : [
        `compiler handoff assembly authority count mismatch: expected ${report.publicationAssemblyAuthorityRows}, found ${report.compilerHandoffAssemblyAuthorityRows}`
      ]),
  ...(report.compilerHandoffAssemblyBlockerRows === report.publicationAssemblyBlockerRows
    ? []
    : [
        `compiler handoff assembly blocker count mismatch: expected ${report.publicationAssemblyBlockerRows}, found ${report.compilerHandoffAssemblyBlockerRows}`
      ]),
  ...(report.compilerHandoffDocumentStubs === report.documentStubsCount
    ? []
    : [
        `compiler handoff document-stubs count mismatch: expected ${report.documentStubsCount}, found ${report.compilerHandoffDocumentStubs}`
      ]),
  ...(report.compilerHandoffDiaryControlRows === report.diaryControlRows
    ? []
    : [
        `compiler handoff diary-control count mismatch: expected ${report.diaryControlRows}, found ${report.compilerHandoffDiaryControlRows}`
      ]),
  ...(report.compilerHandoffDiaryReferenceFiles === report.diaryControlUniqueReferenceCount
    ? []
    : [
        `compiler handoff diary-reference count mismatch: expected ${report.diaryControlUniqueReferenceCount}, found ${report.compilerHandoffDiaryReferenceFiles}`
      ]),
  ...(report.compilerHandoffAnnotationRows === report.annotationLeadsDocumentCount
    ? []
    : [
        `compiler handoff annotation count mismatch: expected ${report.annotationLeadsDocumentCount}, found ${report.compilerHandoffAnnotationRows}`
      ]),
  ...(report.compilerHandoffDirectAnnotationRows === report.annotationLeadsDocumentsWithDirectPublicLeads
    ? []
    : [
        `compiler handoff direct annotation count mismatch: expected ${report.annotationLeadsDocumentsWithDirectPublicLeads}, found ${report.compilerHandoffDirectAnnotationRows}`
      ]),
  ...(report.compilerHandoffContextOnlyAnnotationRows === report.annotationLeadsContextOnlyPublicLeadRows
    ? []
    : [
        `compiler handoff context annotation count mismatch: expected ${report.annotationLeadsContextOnlyPublicLeadRows}, found ${report.compilerHandoffContextOnlyAnnotationRows}`
      ]),
  ...(report.compilerHandoffPublicLineGapRows === report.annotationLeadsDocumentsWithoutPublicLeads
    ? []
    : [
        `compiler handoff public-line gap count mismatch: expected ${report.annotationLeadsDocumentsWithoutPublicLeads}, found ${report.compilerHandoffPublicLineGapRows}`
      ]),
  ...(report.compilerHandoffReadyForReadRows === report.documentReadinessReadyForReadCount
    ? []
    : [
        `compiler handoff ready count mismatch: expected ${report.documentReadinessReadyForReadCount}, found ${report.compilerHandoffReadyForReadRows}`
      ]),
  ...(report.compilerHandoffReadyWithAuthorityCheckRows === report.documentReadinessReadyWithAuthorityCheckCount
    ? []
    : [
        `compiler handoff authority-ready count mismatch: expected ${report.documentReadinessReadyWithAuthorityCheckCount}, found ${report.compilerHandoffReadyWithAuthorityCheckRows}`
      ]),
  ...(report.compilerHandoffBlockerRows === report.blockerResolutionCount
    ? []
    : [`compiler handoff blocker count mismatch: expected ${report.blockerResolutionCount}, found ${report.compilerHandoffBlockerRows}`]),
  ...(report.compilerHandoffAuthorityReviewRows === report.personsNeedingAuthorityReview.length
    ? []
    : [
        `compiler handoff authority-review count mismatch: expected ${report.personsNeedingAuthorityReview.length}, found ${report.compilerHandoffAuthorityReviewRows}`
      ]),
  ...(report.compilerHandoffSourceNoteRows === report.sourceNotePacketCount
    ? []
    : [
        `compiler handoff source-note count mismatch: expected ${report.sourceNotePacketCount}, found ${report.compilerHandoffSourceNoteRows}`
      ]),
  ...(report.compilerHandoffSectionCount >= 20
    ? []
    : [`compiler handoff section count too low: found ${report.compilerHandoffSectionCount}`]),
  ...(report.compilerHandoffPacketCount >= 10
    ? []
    : [`compiler handoff packet count too low: found ${report.compilerHandoffPacketCount}`]),
  ...(report.compilerHandoffReportCount >= 10
    ? []
    : [`compiler handoff report count too low: found ${report.compilerHandoffReportCount}`]),
  ...(report.compilerHandoffCsvCount >= 20
    ? []
    : [`compiler handoff CSV count too low: found ${report.compilerHandoffCsvCount}`]),
  ...(report.compilerHandoffLiveSectionIds[0] === "records"
    ? []
    : [`compiler handoff does not preserve chronology-first section order: ${report.compilerHandoffLiveSectionIds[0] || "blank"}`]),
  ...(report.compilerHandoffLiveSectionIds[1] === "publication-assembly"
    ? []
    : [
        `compiler handoff does not place publication assembly after chronology: ${report.compilerHandoffLiveSectionIds[1] || "blank"}`
      ]),
  ...(report.compilerHandoffLiveSectionIds.includes("publication-assembly")
    ? []
    : ["compiler handoff live section list is missing publication-assembly"]),
  ...(report.compilerHandoffLiveSectionIds.includes("compiler-handoff")
    ? []
    : ["compiler handoff live section list is missing compiler-handoff"]),
  ...(report.compilerHandoffLiveSectionIds.includes("diary-controls")
    ? []
    : ["compiler handoff live section list is missing diary-controls"]),
  ...(report.compilerHandoffLiveSectionIds.includes("annotation-leads")
    ? []
    : ["compiler handoff live section list is missing annotation-leads"]),
  ...(report.compilerHandoffRefreshCommands.includes("node scripts/build-diary-control-packet.js")
    ? []
    : ["compiler handoff refresh commands are missing build-diary-control-packet.js"]),
  ...(report.compilerHandoffRefreshCommands.includes("node scripts/build-annotation-leads-packet.js")
    ? []
    : ["compiler handoff refresh commands are missing build-annotation-leads-packet.js"]),
  ...(report.compilerHandoffRefreshCommands.includes("node scripts/build-publication-assembly-packet.js")
    ? []
    : ["compiler handoff refresh commands are missing build-publication-assembly-packet.js"]),
  ...(report.compilerHandoffRefreshCommands.includes("node scripts/build-compiler-handoff.js")
    ? []
    : ["compiler handoff refresh commands are missing build-compiler-handoff.js"]),
  ...(report.compilerHandoffMarkdown && fs.existsSync(path.join(repoRoot, report.compilerHandoffMarkdown))
    ? []
    : [`missing compiler handoff Markdown: ${report.compilerHandoffMarkdown || "blank"}`]),
  ...(report.compilerHandoffLinksCsv && fs.existsSync(path.join(repoRoot, report.compilerHandoffLinksCsv))
    ? []
    : [`missing compiler handoff links CSV: ${report.compilerHandoffLinksCsv || "blank"}`]),
  ...(report.personsAuthorityPacketPersonCount === report.personsCount
    ? []
    : [
        `persons authority packet count mismatch: expected ${report.personsCount}, found ${report.personsAuthorityPacketPersonCount}`
      ]),
  ...(report.personsAuthorityPacketReviewCount === report.personsNeedingAuthorityReview.length
    ? []
    : [
        `persons authority packet review count mismatch: expected ${report.personsNeedingAuthorityReview.length}, found ${report.personsAuthorityPacketReviewCount}`
      ]),
  ...(report.personsAuthorityPacketAuthorityMode === "docx"
    ? []
    : [`persons authority packet did not record DOCX authority mode: ${report.personsAuthorityPacketAuthorityMode || "blank"}`]),
  ...(report.personsAuthorityPacketAuthorityEntryCount >= 1000
    ? []
    : [`persons authority packet authority count too low: found ${report.personsAuthorityPacketAuthorityEntryCount}`]),
  ...(report.personsAuthorityPacketDocumentLinkCount > 0
    ? []
    : ["persons authority packet has no document links"]),
  ...(report.personsAuthorityPacketReviewDocumentLinkCount > 0
    ? []
    : ["persons authority packet has no review-document links"]),
  ...(report.personsAuthorityPacketHighPriorityReviewCount > 0
    ? []
    : ["persons authority packet has no high-priority review rows"]),
  ...report.personsAuthorityPacketCsvFiles
    .filter((filePath) => !fs.existsSync(path.join(repoRoot, filePath)))
    .map((filePath) => `missing persons authority CSV: ${filePath}`),
  ...report.missingChronologyParticipants.map((name) => `missing chronology participant: ${name}`),
  ...report.missingBoundaryParticipants.map((name) => `missing boundary participant: ${name}`),
  ...report.missingGapPersonTerms.map((name) => `missing gap person term: ${name}`),
  ...report.unresolvedPersonTargets.map((name) => `unresolved person target: ${name}`)
];

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Gap audit passed: ${persons.length} persons, ${report.selectionMatrixCount} selection rows, ${report.compilerBriefQueueCount} compiler brief queues, ${report.sourceNotePacketCount} source-note packet rows, ${report.decisionWorksheetCount} decision worksheets, ${report.researchRunbookQueryCount} research runbook queries, ${report.countryDossierCount} country dossiers, ${report.draftDocumentProposedCount} draft proposed rows, ${report.documentReadinessCount} readiness rows, ${report.blockerResolutionCount} blocker-resolution rows, ${report.documentStubsCount} document stubs, ${report.diaryControlRows} diary controls, ${report.annotationLeadsDocumentCount} annotation rows, ${report.publicationAssemblyRows} assembly rows, ${report.compilerHandoffPacketCount} handoff packets, ${sourceCopyLedger.length} source-copy ledger rows, ${report.personsNeedingAuthorityReview.length} authority-review entries, ${report.personsAuthorityPacketDocumentLinkCount} authority document links.`
);

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8"));
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sameReportBody(previousReport, nextBody) {
  if (!previousReport) return false;
  const { generatedAt, ...previousBody } = previousReport;
  return JSON.stringify(previousBody) === JSON.stringify(nextBody);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function included(name) {
  const tokens = normalize(name)
    .split(/\s+/)
    .filter((token) => token.length > 1);
  return tokens.length > 0 && tokens.every((token) => personHaystacks.some((haystack) => haystack.includes(token)));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}
