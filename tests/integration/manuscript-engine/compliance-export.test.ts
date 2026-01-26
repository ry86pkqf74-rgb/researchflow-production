/**
 * Phase 5: Compliance and Export Integration Tests
 * Task T100: E2E workflow testing
 */

import {
  peerReviewService,
  complianceCheckerService,
  exportService,
  finalPhiScanService,
} from '../../../packages/manuscript-engine/src/services';

describe('Phase 5: Compliance and Export Integration', () => {
  const mockManuscriptId = 'manuscript-test-phase5';
  const mockUserId = 'user-test-001';

  const sampleManuscript = {
    title: 'Exercise Reduces Blood Pressure in Hypertensive Adults: A Randomized Trial',
    abstract: `
      Background: Hypertension affects millions worldwide.
      Methods: Randomized controlled trial of 200 adults with hypertension.
      Results: Systolic BP decreased by 12 mmHg (95% CI: 8-16, p<0.001).
      Conclusions: Exercise significantly reduces blood pressure.
    `,
    keywords: 'hypertension, exercise, blood pressure, RCT',
    introduction: `
      Hypertension is a major cardiovascular risk factor affecting over 1 billion people.
      Lifestyle modifications including exercise are first-line treatment.
      We aimed to determine the effect of supervised exercise on blood pressure.
    `,
    methods: `
      Study Design: Parallel-group RCT at University Medical Center, 2022-2023.
      IRB approval: Protocol #2021-0456.

      Participants: Adults 40-70 years with stage 1 hypertension (SBP 130-139 mmHg).
      Exclusion: cardiovascular disease, diabetes.

      Randomization: 1:1 using computer-generated numbers, permuted blocks.
      Allocation concealment via opaque envelopes.

      Intervention: Supervised aerobic exercise 3x/week for 12 weeks, 45 minutes at 60-70% max HR.

      Outcomes: Primary - change in systolic BP at 12 weeks.
      Secondary - diastolic BP, weight.

      Statistics: Sample size 80/group for 10 mmHg difference, 80% power, alpha=0.05.
      Analysis by intention-to-treat. ANCOVA adjusting for baseline.
    `,
    results: `
      Participants: Of 312 screened, 200 randomized (100 per group).
      Baseline characteristics similar (Table 1). Mean age 54 years, 52% female.

      Follow-up: 95 (95%) exercise group, 92 (92%) control completed 12-week follow-up.

      Primary Outcome: SBP decreased from 136.4 to 124.1 mmHg in exercise group,
      135.8 to 133.7 mmHg in control. Between-group difference -10.2 mmHg
      (95% CI: -13.8 to -6.6, p<0.001).

      Secondary Outcomes: DBP decreased 5.3 mmHg more in exercise group
      (95% CI: -7.8 to -2.8, p<0.001). No serious adverse events.
    `,
    discussion: `
      Supervised exercise significantly reduced blood pressure in adults with hypertension.
      The 10 mmHg SBP reduction is clinically meaningful and consistent with meta-analyses
      showing 5-15 mmHg reductions.

      Findings extend prior work by using structured programs with objective monitoring.
      Smith et al. (2020) reported similar effects in smaller study.

      Limitations: single-center design, 12-week duration. Longer follow-up needed.
      Participant blinding not possible.

      Conclusion: Supervised exercise is effective for blood pressure control in
      stage 1 hypertension.
    `,
    references: '',
    acknowledgments: 'Funded by NIH grant R01HL123456. Thanks to participants.',
    supplementary: ''
  };

  // ========== T81: Peer Review Simulation ==========
  describe('T81: Peer Review Service', () => {
    it('should simulate comprehensive peer review', async () => {
      const review = await peerReviewService.simulateReview(
        sampleManuscript,
        {
          studyType: 'RCT',
          sampleSize: 200,
          hasEthicsApproval: true,
          hasCOI: false
        }
      );

      expect(review).toBeDefined();
      expect(review.overallScore).toBeGreaterThan(0);
      expect(review.overallScore).toBeLessThanOrEqual(10);
      expect(review.recommendation).toBeDefined();
      expect(['accept', 'minor_revision', 'major_revision', 'reject']).toContain(review.recommendation);
      expect(review.categoryScores).toBeDefined();
      expect(review.comments).toBeDefined();
    });

    it('should generate reviewer feedback letter', async () => {
      const review = await peerReviewService.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200,
        hasEthicsApproval: true
      });

      const letter = peerReviewService.generateReviewerLetter(review);

      expect(letter).toBeDefined();
      expect(letter).toContain('Dear Authors');
      expect(letter).toContain('Summary');
      expect(letter.length).toBeGreaterThan(100);
    });

    it('should identify methodology issues', async () => {
      const incompleteManuscript = {
        ...sampleManuscript,
        methods: 'We did a study.' // Minimal methods section
      };

      const review = await peerReviewService.simulateReview(incompleteManuscript, {
        studyType: 'RCT',
        sampleSize: 0
      });

      expect(review.overallScore).toBeLessThan(7);
      const methodologyComments = review.comments.filter(c => c.category === 'methodology');
      expect(methodologyComments.length).toBeGreaterThan(0);
    });
  });

  // ========== T82-T84: Compliance Checkers ==========
  describe('T82-T84: Compliance Checkers', () => {
    it('T82: should check CONSORT compliance for RCT', () => {
      const report = complianceCheckerService.checkCONSORT(sampleManuscript);

      expect(report).toBeDefined();
      expect(report.checklist).toBe('CONSORT');
      expect(report.compliancePercentage).toBeGreaterThan(0);
      expect(report.results.length).toBeGreaterThan(0);

      // Key CONSORT items
      const hasRandomization = report.results.some(r => r.itemId.includes('8') && r.present);
      expect(hasRandomization).toBe(true);
    });

    it('T83: should check STROBE compliance for observational study', () => {
      const observationalManuscript = {
        ...sampleManuscript,
        title: 'Hypertension and Exercise: A Cohort Study',
        methods: sampleManuscript.methods.replace(/randomized|RCT/gi, 'cohort study')
      };

      const report = complianceCheckerService.checkSTROBE(observationalManuscript);

      expect(report).toBeDefined();
      expect(report.checklist).toBe('STROBE');
      expect(report.compliancePercentage).toBeGreaterThanOrEqual(0);
    });

    it('T84: should check PRISMA compliance for systematic review', () => {
      const systematicReviewManuscript = {
        ...sampleManuscript,
        title: 'Exercise for Hypertension: A Systematic Review',
        methods: `
          Search strategy: PubMed, Embase, Cochrane searched from inception to 2023.
          Search terms: (hypertension OR blood pressure) AND (exercise OR physical activity).
          Selection: Two reviewers independently screened titles, abstracts, full-text.
          Data extraction: Standardized form for study characteristics, outcomes.
          Risk of bias: Cochrane ROB tool.
          Synthesis: Random-effects meta-analysis. Heterogeneity assessed via I-squared.
        `
      };

      const report = complianceCheckerService.checkPRISMA(systematicReviewManuscript);

      expect(report).toBeDefined();
      expect(report.checklist).toBe('PRISMA');
      expect(report.compliancePercentage).toBeGreaterThanOrEqual(0);
    });

    it('should provide compliance summary', () => {
      const report = complianceCheckerService.checkCONSORT(sampleManuscript);

      expect(report.summary).toBeDefined();
      expect(report.summary.length).toBeGreaterThan(0);
      expect(report.totalItems).toBeGreaterThan(0);
      expect(report.presentItems + report.missingItems).toBe(report.totalItems);
    });
  });

  // ========== T97: Final PHI Scan ==========
  describe('T97: Final PHI Scan Service', () => {
    it('should pass PHI scan for clean manuscript', async () => {
      const result = await finalPhiScanService.performFinalScan(
        mockManuscriptId,
        sampleManuscript,
        mockUserId
      );

      expect(result).toBeDefined();
      expect(result.passed).toBe(true);
      expect(result.phiDetections.length).toBe(0);
      expect(result.auditHash).toBeDefined();
      expect(result.attestationRequired).toBe(false);
    });

    it('should detect patient names (PHI)', async () => {
      const contaminatedManuscript = {
        ...sampleManuscript,
        methods: sampleManuscript.methods + ' Patient Mr. John Smith was enrolled.'
      };

      const result = await finalPhiScanService.performFinalScan(
        mockManuscriptId,
        contaminatedManuscript,
        mockUserId
      );

      expect(result.passed).toBe(false);
      expect(result.phiDetections.length).toBeGreaterThan(0);
      const nameDetections = result.phiDetections.filter(d => d.type === 'name');
      expect(nameDetections.length).toBeGreaterThan(0);
      expect(nameDetections[0].severity).toBe('critical');
    });

    it('should detect SSN (PHI)', async () => {
      const contaminatedManuscript = {
        ...sampleManuscript,
        methods: sampleManuscript.methods + ' SSN: 123-45-6789 was recorded.'
      };

      const result = await finalPhiScanService.performFinalScan(
        mockManuscriptId,
        contaminatedManuscript,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const ssnDetections = result.phiDetections.filter(d => d.type === 'ssn');
      expect(ssnDetections.length).toBeGreaterThan(0);
      expect(ssnDetections[0].severity).toBe('critical');
    });

    it('should detect phone numbers (PHI)', async () => {
      const contaminatedManuscript = {
        ...sampleManuscript,
        methods: sampleManuscript.methods + ' Contact: (555) 123-4567.'
      };

      const result = await finalPhiScanService.performFinalScan(
        mockManuscriptId,
        contaminatedManuscript,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const phoneDetections = result.phiDetections.filter(d => d.type === 'phone');
      expect(phoneDetections.length).toBeGreaterThan(0);
      expect(phoneDetections[0].severity).toBe('high');
    });

    it('should detect MRN (PHI)', async () => {
      const contaminatedManuscript = {
        ...sampleManuscript,
        results: sampleManuscript.results + ' MRN: 12345678 excluded.'
      };

      const result = await finalPhiScanService.performFinalScan(
        mockManuscriptId,
        contaminatedManuscript,
        mockUserId
      );

      expect(result.passed).toBe(false);
      const mrnDetections = result.phiDetections.filter(d => d.type === 'mrn');
      expect(mrnDetections.length).toBeGreaterThan(0);
    });

    it('should require attestation for critical PHI detections', async () => {
      const contaminatedManuscript = {
        ...sampleManuscript,
        methods: sampleManuscript.methods + ' Dr. Jane Doe, born 01/15/1980, MRN 12345.'
      };

      const result = await finalPhiScanService.performFinalScan(
        mockManuscriptId,
        contaminatedManuscript,
        mockUserId
      );

      expect(result.attestationRequired).toBe(true);
      expect(result.quarantinedItems.length).toBeGreaterThan(0);
    });

    it('should generate audit hash for verification chain', async () => {
      const result = await finalPhiScanService.performFinalScan(
        mockManuscriptId,
        sampleManuscript,
        mockUserId
      );

      expect(result.auditHash).toBeDefined();
      expect(result.auditHash.length).toBe(64); // SHA-256 hex string
    });
  });

  // ========== T85-T86: Export Services ==========
  describe('T85-T86: Export Services', () => {
    const exportConfig = {
      manuscriptId: mockManuscriptId,
      title: sampleManuscript.title,
      authors: [
        { name: 'Jane Doe', affiliation: 'University Medical Center', email: 'jane@example.com' }
      ],
      sections: sampleManuscript,
      formattedCitations: [],
      format: 'docx' as const
    };

    it('T85: should export to DOCX', async () => {
      const result = await exportService.exportToDocx(exportConfig);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(result.filePath).toContain('.docx');
      expect(result.error).toBeUndefined();
    });

    it('T86: should export to PDF', async () => {
      const pdfConfig = { ...exportConfig, format: 'pdf' as const };
      const result = await exportService.exportToPdf(pdfConfig);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(result.filePath).toContain('.pdf');
      expect(result.pageCount).toBeGreaterThan(0);
    });

    it('should export to LaTeX', async () => {
      const latexConfig = { ...exportConfig, format: 'latex' as const };
      const result = await exportService.exportToLatex(latexConfig);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(result.filePath).toContain('.tex');
    });

    it('should include line numbers when requested', async () => {
      const configWithLineNumbers = {
        ...exportConfig,
        lineNumbers: true,
        doubleSpaced: true
      };

      const result = await exportService.exportToDocx(configWithLineNumbers);

      expect(result.success).toBe(true);
    });

    it('should add watermark when specified', async () => {
      const configWithWatermark = {
        ...exportConfig,
        watermark: 'DRAFT'
      };

      const result = await exportService.exportToPdf(configWithWatermark);

      expect(result.success).toBe(true);
    });
  });

  // ========== Complete Workflow Integration ==========
  describe('T100: Complete End-to-End Workflow', () => {
    it('should complete full manuscript workflow', async () => {
      // 1. Run compliance check
      const consortReport = complianceCheckerService.checkCONSORT(sampleManuscript);
      expect(consortReport.compliancePercentage).toBeGreaterThan(50);

      // 2. Simulate peer review
      const review = await peerReviewService.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200,
        hasEthicsApproval: true
      });
      expect(review.overallScore).toBeGreaterThan(5);

      // 3. Final PHI scan - CRITICAL GATE
      const phiScan = await finalPhiScanService.performFinalScan(
        mockManuscriptId,
        sampleManuscript,
        mockUserId
      );
      expect(phiScan.passed).toBe(true);

      // 4. Only export if PHI scan passed
      if (phiScan.passed) {
        const exportResult = await exportService.exportToPdf({
          manuscriptId: mockManuscriptId,
          title: sampleManuscript.title,
          authors: [{ name: 'Test Author', affiliation: 'Test University' }],
          sections: sampleManuscript,
          formattedCitations: [],
          format: 'pdf'
        });

        expect(exportResult.success).toBe(true);
      }

      // Workflow completed successfully
      expect(consortReport).toBeDefined();
      expect(review).toBeDefined();
      expect(phiScan).toBeDefined();
    });

    it('should block export if PHI detected', async () => {
      const contaminatedManuscript = {
        ...sampleManuscript,
        methods: sampleManuscript.methods + ' Patient John Smith (SSN: 123-45-6789) enrolled.'
      };

      // 1. PHI scan
      const phiScan = await finalPhiScanService.performFinalScan(
        mockManuscriptId,
        contaminatedManuscript,
        mockUserId
      );

      // 2. PHI detected - MUST NOT EXPORT
      expect(phiScan.passed).toBe(false);
      expect(phiScan.phiDetections.length).toBeGreaterThan(0);

      // In production, export would be blocked here
      // This test verifies the detection works correctly
    });

    it('should track full audit trail', async () => {
      const phiScan = await finalPhiScanService.performFinalScan(
        mockManuscriptId,
        sampleManuscript,
        mockUserId
      );

      expect(phiScan.auditHash).toBeDefined();
      expect(phiScan.scanTimestamp).toBeDefined();
      expect(phiScan.totalScanned).toBeGreaterThan(0);

      // Audit log should be generated (logged to console in this implementation)
    });
  });
});
