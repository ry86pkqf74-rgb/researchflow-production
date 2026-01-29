import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Database, Mail, Linkedin, Twitter, Github,
  ShieldCheck
} from "lucide-react";

const footerLinks = {
  product: [
    { label: "Features", href: "#features", testId: "link-footer-features" },
    { label: "Pricing", href: "#", testId: "link-footer-pricing" },
    { label: "Use Cases", href: "#", testId: "link-footer-usecases" },
    { label: "Integrations", href: "#", testId: "link-footer-integrations" },
  ],
  resources: [
    { label: "Documentation", href: "#", testId: "link-footer-docs" },
    { label: "API Reference", href: "#", testId: "link-footer-api" },
    { label: "Tutorials", href: "#", testId: "link-footer-tutorials" },
    { label: "Blog", href: "#", testId: "link-footer-blog" },
  ],
  company: [
    { label: "About Us", href: "#", testId: "link-footer-about" },
    { label: "Careers", href: "#", testId: "link-footer-careers" },
    { label: "Press", href: "#", testId: "link-footer-press" },
    { label: "Contact", href: "#", testId: "link-footer-contact" },
  ],
  legal: [
    { label: "Privacy Policy", href: "#", testId: "link-footer-privacy" },
    { label: "Terms of Service", href: "#", testId: "link-footer-terms" },
    { label: "HIPAA Compliance", href: "#compliance", testId: "link-footer-hipaa" },
    { label: "Security", href: "#", testId: "link-footer-security" },
  ],
};

const certifications = [
  { name: "HIPAA", icon: ShieldCheck },
  { name: "SOC 2", icon: ShieldCheck },
  { name: "GDPR", icon: ShieldCheck },
];

export function FooterSection() {
  return (
    <footer className="bg-card border-t border-border" data-testid="footer-main">
      <div className="container mx-auto px-6 lg:px-24 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 lg:gap-12">
          <div className="col-span-2">
            <a href="/" className="flex items-center gap-2 mb-4" data-testid="link-footer-logo">
              <div className="w-10 h-10 rounded-lg bg-ros-primary flex items-center justify-center">
                <Database className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl" data-testid="text-footer-brand">ResearchFlow</span>
            </a>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs" data-testid="text-footer-description">
              Transforming complex research workflows into accessible, 
              automated platforms for non-technical researchers.
            </p>
            <div className="flex gap-3" data-testid="list-social-links">
              <a 
                href="#" 
                className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover-elevate"
                aria-label="Twitter"
                data-testid="link-social-twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a 
                href="#" 
                className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover-elevate"
                aria-label="LinkedIn"
                data-testid="link-social-linkedin"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a 
                href="#" 
                className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover-elevate"
                aria-label="GitHub"
                data-testid="link-social-github"
              >
                <Github className="h-4 w-4" />
              </a>
              <a 
                href="mailto:contact@researchops.io" 
                className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover-elevate"
                aria-label="Email"
                data-testid="link-social-email"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4" data-testid="text-footer-product-heading">Product</h4>
            <ul className="space-y-3" data-testid="list-footer-product">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href} 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={link.testId}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4" data-testid="text-footer-resources-heading">Resources</h4>
            <ul className="space-y-3" data-testid="list-footer-resources">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href} 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={link.testId}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4" data-testid="text-footer-company-heading">Company</h4>
            <ul className="space-y-3" data-testid="list-footer-company">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href} 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={link.testId}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4" data-testid="text-footer-legal-heading">Legal</h4>
            <ul className="space-y-3" data-testid="list-footer-legal">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href} 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={link.testId}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground" data-testid="text-footer-copyright">
              © 2026 ResearchFlow. All rights reserved.
            </p>
          </div>

          <div className="flex items-center gap-3" data-testid="list-footer-certifications">
            <span className="text-xs text-muted-foreground">Certified:</span>
            {certifications.map((cert) => (
              <Badge 
                key={cert.name} 
                variant="secondary" 
                className="gap-1"
                data-testid={`badge-footer-cert-${cert.name.toLowerCase().replace(' ', '-')}`}
              >
                <cert.icon className="h-3 w-3" />
                {cert.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
