/**
 * Privacy Policy Page
 *
 * HIPAA-compliant privacy policy for ResearchFlow Canvas.
 */

import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/login">
            <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-blue-400" />
            <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
          </div>
          <p className="text-slate-400">Last updated: January 2026</p>
          <p className="text-slate-400 mt-2">HIPAA Compliant | GDPR Compliant</p>
        </div>

        {/* Content */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur p-8">
          <div className="prose prose-invert prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">Introduction</h2>
              <p className="text-slate-300 mb-4">
                ResearchFlow Canvas ("we", "our", or "us") is committed to protecting your privacy and complying with applicable data protection laws, including the Health Insurance Portability and Accountability Act (HIPAA) and the General Data Protection Regulation (GDPR).
              </p>
              <p className="text-slate-300 mb-4">
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our research operating system.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">1. Information We Collect</h2>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.1 Account Information</h3>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Name and email address</li>
                <li>Institutional affiliation</li>
                <li>Role and credentials</li>
                <li>Account preferences and settings</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.2 Research Data</h3>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Research protocols and manuscripts</li>
                <li>Data files and analysis artifacts</li>
                <li>Collaboration and annotation data</li>
                <li>Version history and change logs</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.3 Protected Health Information (PHI)</h3>
              <p className="text-slate-300 mb-4">
                In LIVE mode with proper authorization, the Service may process PHI as defined under HIPAA:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Clinical and patient data uploaded for research purposes</li>
                <li>De-identified datasets subject to HIPAA Privacy Rule</li>
                <li>All PHI is encrypted at rest and in transit</li>
                <li>PHI access is strictly controlled and audited</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.4 Usage Information</h3>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Log data (IP address, browser type, access times)</li>
                <li>Feature usage and interaction patterns</li>
                <li>AI service invocation records</li>
                <li>System performance metrics</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">2. How We Use Your Information</h2>
              <p className="text-slate-300 mb-4">
                We use the collected information for the following purposes:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Provide, operate, and maintain the Service</li>
                <li>Process and facilitate research workflows</li>
                <li>Enable collaboration between research team members</li>
                <li>Generate audit trails and compliance reports</li>
                <li>Improve and optimize Service functionality</li>
                <li>Communicate with you about your account and the Service</li>
                <li>Detect, prevent, and address security or technical issues</li>
                <li>Comply with legal obligations and regulatory requirements</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">3. HIPAA Compliance</h2>
              <p className="text-slate-300 mb-4">
                As a covered entity or business associate handling PHI, we comply with HIPAA regulations:
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.1 Security Safeguards</h3>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li><strong>Administrative:</strong> Access controls, workforce training, incident response procedures</li>
                <li><strong>Physical:</strong> Secure data centers, access controls, device encryption</li>
                <li><strong>Technical:</strong> Encryption (AES-256), access logging, audit trails, automatic logoff</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.2 Privacy Rule Compliance</h3>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Minimum necessary standard for PHI access</li>
                <li>Patient rights to access and amend their information</li>
                <li>Business Associate Agreements (BAA) with third-party vendors</li>
                <li>Breach notification procedures as required by law</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.3 Audit Controls</h3>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Comprehensive audit logging of all PHI access</li>
                <li>Tamper-proof audit trail with cryptographic hashing</li>
                <li>Regular audit log reviews and compliance monitoring</li>
                <li>Retention of audit logs for 6 years as required by HIPAA</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">4. Data Sharing and Disclosure</h2>
              <p className="text-slate-300 mb-4">
                We do not sell, trade, or rent your personal information or research data. We may share information in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li><strong>With Your Consent:</strong> When you explicitly authorize sharing</li>
                <li><strong>Collaboration:</strong> With team members you invite to your research projects</li>
                <li><strong>Service Providers:</strong> With vendors under Business Associate Agreements who assist in providing the Service</li>
                <li><strong>Legal Compliance:</strong> When required by law, subpoena, or court order</li>
                <li><strong>Protection:</strong> To protect our rights, privacy, safety, or property</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">5. Third-Party AI Services</h2>
              <p className="text-slate-300 mb-4">
                The Service integrates with third-party AI providers (Anthropic Claude, OpenAI) for content generation:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>PHI is scanned and redacted before being sent to AI services</li>
                <li>AI providers operate under Business Associate Agreements</li>
                <li>All AI interactions are logged and auditable</li>
                <li>You can opt out of AI features while retaining core functionality</li>
                <li>AI-generated content does not include PHI unless explicitly approved</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">6. Data Security</h2>
              <p className="text-slate-300 mb-4">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Encryption in transit (TLS 1.3) and at rest (AES-256)</li>
                <li>Multi-factor authentication support</li>
                <li>Role-based access controls (RBAC)</li>
                <li>Regular security audits and penetration testing</li>
                <li>Secure development practices and code reviews</li>
                <li>Automated vulnerability scanning</li>
                <li>Incident response and breach notification procedures</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">7. Data Retention</h2>
              <p className="text-slate-300 mb-4">
                We retain your information as follows:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li><strong>Account Data:</strong> Until you request deletion or account closure</li>
                <li><strong>Research Data:</strong> As long as needed for your research or as required by institutional policies</li>
                <li><strong>Audit Logs:</strong> 6 years minimum (HIPAA requirement), up to 7 years for compliance</li>
                <li><strong>Backup Data:</strong> Up to 90 days in encrypted backups</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">8. Your Rights</h2>
              <p className="text-slate-300 mb-4">
                Under GDPR and HIPAA, you have the following rights:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
                <li><strong>Erasure:</strong> Request deletion of your data (subject to legal retention requirements)</li>
                <li><strong>Portability:</strong> Export your research data in machine-readable formats</li>
                <li><strong>Object:</strong> Opt out of certain data processing activities</li>
                <li><strong>Restrict:</strong> Request limitation of data processing</li>
                <li><strong>Accounting:</strong> Receive an accounting of PHI disclosures</li>
              </ul>
              <p className="text-slate-300 mt-4">
                To exercise these rights, contact us at privacy@researchflow.dev
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">9. Cookies and Tracking</h2>
              <p className="text-slate-300 mb-4">
                We use cookies and similar technologies for:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li><strong>Essential Cookies:</strong> Required for authentication and core functionality</li>
                <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                <li><strong>Analytics Cookies:</strong> Understand how the Service is used (with your consent)</li>
              </ul>
              <p className="text-slate-300 mt-4">
                You can control cookie preferences through your browser settings. Note that disabling essential cookies may impact Service functionality.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">10. International Data Transfers</h2>
              <p className="text-slate-300 mb-4">
                Your data may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Standard Contractual Clauses (SCCs) for EU data transfers</li>
                <li>Adequate data protection measures as required by GDPR</li>
                <li>PHI remains within HIPAA-compliant infrastructure</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">11. Children's Privacy</h2>
              <p className="text-slate-300 mb-4">
                The Service is not intended for users under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">12. Changes to Privacy Policy</h2>
              <p className="text-slate-300 mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Posting the updated policy with a new "Last updated" date</li>
                <li>Sending email notification to registered users</li>
                <li>Displaying a prominent notice in the Service</li>
              </ul>
              <p className="text-slate-300 mt-4">
                Your continued use of the Service after changes constitutes acceptance of the updated Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">13. Data Breach Notification</h2>
              <p className="text-slate-300 mb-4">
                In the event of a data breach involving PHI, we will:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Notify affected individuals without unreasonable delay (within 60 days as required by HIPAA)</li>
                <li>Notify the Department of Health and Human Services if applicable</li>
                <li>Provide information about the breach and mitigation steps</li>
                <li>Take corrective actions to prevent future breaches</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">14. Contact Information</h2>
              <p className="text-slate-300 mb-4">
                For privacy-related questions, concerns, or requests:
              </p>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-300">
                  <strong>Privacy Officer:</strong> [Name]<br />
                  <strong>Email:</strong> privacy@researchflow.dev<br />
                  <strong>Address:</strong> [Your Business Address]<br />
                  <strong>Phone:</strong> [Contact Number]
                </p>
              </div>
              <p className="text-slate-300 mt-4">
                For HIPAA-related complaints, you may also contact the Office for Civil Rights (OCR) at the U.S. Department of Health and Human Services.
              </p>
            </section>

            <div className="mt-12 p-6 bg-blue-900/20 rounded-lg border border-blue-700">
              <div className="flex items-start gap-3">
                <Shield className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Your Privacy is Protected</h3>
                  <p className="text-slate-300 text-sm">
                    We are committed to maintaining the highest standards of data protection and privacy. Our HIPAA-compliant infrastructure, comprehensive audit logging, and governance-first design ensure that your research data and PHI are secure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
