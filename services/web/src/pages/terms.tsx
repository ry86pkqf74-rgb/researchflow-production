/**
 * Terms of Service Page
 *
 * Legal terms and conditions for using ResearchFlow Canvas.
 */

import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-slate-400">Last updated: January 2026</p>
        </div>

        {/* Content */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur p-8">
          <div className="prose prose-invert prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-slate-300 mb-4">
                By accessing and using ResearchFlow Canvas ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Service</h2>
              <p className="text-slate-300 mb-4">
                ResearchFlow Canvas is a research operating system designed to facilitate academic and clinical research workflows. The Service provides tools for:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Research protocol development and manuscript authoring</li>
                <li>Data analysis and statistical workflow management</li>
                <li>Collaboration and version control for research teams</li>
                <li>Compliance monitoring and audit trail generation</li>
                <li>AI-assisted content generation with governance controls</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">3. User Accounts</h2>
              <p className="text-slate-300 mb-4">
                To use certain features of the Service, you must register for an account. You agree to:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain the security of your password and account</li>
                <li>Promptly update any information to keep it accurate and current</li>
                <li>Accept all risks of unauthorized access to your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">4. Acceptable Use</h2>
              <p className="text-slate-300 mb-4">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Upload or share content that violates applicable laws or regulations</li>
                <li>Infringe on intellectual property rights of others</li>
                <li>Attempt to gain unauthorized access to any portion of the Service</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Use the Service for any unlawful or fraudulent purpose</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">5. Data and Privacy</h2>
              <p className="text-slate-300 mb-4">
                Your use of the Service is also governed by our Privacy Policy. In summary:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>We collect and process data as described in our Privacy Policy</li>
                <li>You retain ownership of your research data and content</li>
                <li>We implement appropriate security measures to protect your data</li>
                <li>We comply with applicable data protection regulations including HIPAA</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">6. Protected Health Information (PHI)</h2>
              <p className="text-slate-300 mb-4">
                When operating in LIVE mode with PHI access:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>You certify that you have appropriate IRB approval and authorization</li>
                <li>You agree to comply with HIPAA and applicable privacy regulations</li>
                <li>All PHI access is logged and auditable</li>
                <li>You are responsible for proper de-identification when required</li>
                <li>Unauthorized PHI access or disclosure may result in account termination</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">7. Intellectual Property</h2>
              <p className="text-slate-300 mb-4">
                The Service and its original content, features, and functionality are owned by ResearchFlow and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p className="text-slate-300 mb-4">
                You retain all rights to your research content and data. By using the Service, you grant us a limited license to host, store, and process your content solely for the purpose of providing the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">8. AI-Generated Content</h2>
              <p className="text-slate-300 mb-4">
                The Service uses artificial intelligence to assist with content generation:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>AI-generated content should be reviewed and validated by qualified researchers</li>
                <li>You are responsible for the accuracy and appropriateness of AI-generated content</li>
                <li>We do not guarantee the correctness of AI-generated suggestions or outputs</li>
                <li>AI usage is subject to governance controls and audit logging</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">9. Termination</h2>
              <p className="text-slate-300 mb-4">
                We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                <li>Breach of these Terms of Service</li>
                <li>Violation of applicable laws or regulations</li>
                <li>Fraudulent, abusive, or illegal activity</li>
                <li>Request by law enforcement or regulatory authorities</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">10. Limitation of Liability</h2>
              <p className="text-slate-300 mb-4">
                In no event shall ResearchFlow, its directors, employees, or agents be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data or research results, arising from your use of the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">11. Changes to Terms</h2>
              <p className="text-slate-300 mb-4">
                We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through the Service. Your continued use of the Service after such modifications constitutes acceptance of the updated terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">12. Governing Law</h2>
              <p className="text-slate-300 mb-4">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which ResearchFlow operates, without regard to its conflict of law provisions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">13. Contact Information</h2>
              <p className="text-slate-300 mb-4">
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="text-slate-300">
                Email: legal@researchflow.dev<br />
                Address: [Your Business Address]
              </p>
            </section>

            <div className="mt-12 p-6 bg-slate-900/50 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-sm">
                By clicking "I agree" or by accessing or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
