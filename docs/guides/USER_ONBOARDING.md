# ResearchFlow User Onboarding Guide

> **Comprehensive step-by-step guide for researchers getting started with ResearchFlow**
> Last Updated: 2026-01-28 | Version: 1.0

## Table of Contents

1. [Account Creation and Login](#account-creation-and-login)
2. [Understanding User Roles](#understanding-user-roles)
3. [Creating Your First Project](#creating-your-first-project)
4. [Using the Analysis Page](#using-the-analysis-page)
5. [Working with Manuscript Studio](#working-with-manuscript-studio)
6. [Understanding Governance Workflows](#understanding-governance-workflows)
7. [Exporting and Sharing Results](#exporting-and-sharing-results)
8. [Getting Help](#getting-help)

---

## Account Creation and Login

### Creating an Account

1. Navigate to the ResearchFlow login page
2. Click **"Create Account"** or **"Sign Up"**
3. Enter your information:
   - **Full Name**: Your first and last name
   - **Email Address**: Your institutional or work email (required for verification)
   - **Password**: Minimum 12 characters with uppercase, lowercase, numbers, and symbols
   - **Organization**: Select your institution or research organization
4. Review and accept the Terms of Service and Privacy Policy
5. Click **"Create Account"**
6. Check your email for a verification link
7. Click the verification link to activate your account
8. You will be redirected to set up additional security

### Logging In

1. Go to the ResearchFlow login page
2. Enter your email address
3. Enter your password
4. If **Multi-Factor Authentication (MFA)** is enabled:
   - Enter the 6-digit code from your authenticator app
   - Or use your backup recovery codes if you don't have access to your app
5. Click **"Sign In"**
6. You will be directed to the Dashboard

### Password Management

- **Changing Your Password**: Go to Settings → Security → Change Password
- **Resetting Your Password**: Click "Forgot Password?" on the login page and follow email instructions
- **Password Requirements**:
  - Minimum 12 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character (!@#$%^&*)

### Multi-Factor Authentication (MFA)

MFA adds an extra layer of security to your account:

1. Go to Settings → Security → Multi-Factor Authentication
2. Click **"Enable MFA"**
3. Choose your authentication method:
   - **Authenticator App** (Recommended): Use Google Authenticator, Microsoft Authenticator, or Authy
   - **SMS**: Receive codes via text message
4. Scan the QR code with your authenticator app or enter the setup key manually
5. Enter a test code to verify setup
6. Save your backup recovery codes in a secure location
7. Click **"Enable MFA"**

---

## Understanding User Roles

ResearchFlow uses role-based access control (RBAC) to manage permissions. Your role determines what features and data you can access.

### Role Types

#### VIEWER
- **Permissions**: Read-only access to assigned projects
- **Features**:
  - View project data and analysis results
  - Read manuscripts and reports
  - View audit logs and governance decisions
  - Download read-only exports
- **Limitations**:
  - Cannot create new projects
  - Cannot modify data or analyses
  - Cannot approve governance requests
- **Use Case**: Stakeholders, reviewers, collaborators reviewing completed work

#### RESEARCHER
- **Permissions**: Full project access and analysis capabilities
- **Features**:
  - Create and manage projects
  - Upload datasets
  - Run analyses
  - Use Analysis and Manuscript Studio
  - Create governance review requests
  - Manage team members
  - Export data (subject to governance approval)
- **Limitations**:
  - Cannot approve own governance requests
  - Cannot manage system-wide settings
  - Cannot access admin tools
- **Use Case**: Primary research team members conducting analyses

#### STEWARD
- **Permissions**: Governance oversight and compliance enforcement
- **Features**:
  - Approve/reject governance review requests
  - Review audit logs and access patterns
  - Manage compliance workflows
  - Override certain restrictions
  - Access governance dashboards
- **Limitations**:
  - Limited to governance functions
  - Cannot perform analyses
  - Cannot access all system settings
- **Use Case**: Compliance officers, governance committee members, IRB representatives

#### ADMIN
- **Permissions**: Full system administration and management
- **Features**:
  - All RESEARCHER and STEWARD capabilities
  - User management and role assignment
  - System configuration and settings
  - Access to audit logs and system monitoring
  - Backup and restore operations
  - Feature flag management
  - API key management
- **Limitations**: None (full access)
- **Use Case**: System administrators, IT team leads, senior institutional representatives

### Checking Your Role

1. Click your profile icon in the top-right corner
2. Select "Profile Settings"
3. Your current role(s) will be displayed under "Account Information"
4. If you need to request additional permissions, contact your organization's admin

---

## Creating Your First Project

### Project Basics

A project in ResearchFlow is a container for your research data, analyses, and outputs. Each project has its own:
- Datasets and uploads
- Analysis configurations
- Manuscript drafts
- Governance workflows
- Team members and permissions

### Creating a New Project

1. Click **"New Project"** from the Dashboard
2. Fill in the project details:
   - **Project Name**: Descriptive title (e.g., "Heart Disease Risk Factors 2025")
   - **Description**: Brief overview of your research
   - **Organization**: Your institution (auto-filled)
   - **Start Date**: When you're beginning this research
   - **Visibility**:
     - **Private**: Only team members you explicitly add can access
     - **Internal**: All researchers in your organization can view (not edit)
     - **Public**: Visible to external users (requires governance approval)
3. Click **"Create Project"**
4. You will be taken to the project overview page

### Adding Team Members

1. From your project, click **"Settings"** → **"Team"**
2. Click **"Invite Team Member"**
3. Enter the email address or search for team members
4. Select their role in this project:
   - **Editor**: Can modify project data and analyses
   - **Viewer**: Can view but not modify
   - **Steward**: Can approve governance requests
5. Click **"Send Invite"**
6. Team members will receive an email invitation
7. They can accept the invitation and join your project

### Uploading Datasets

1. From your project, click **"Datasets"** or **"Upload Data"**
2. Click **"Upload New Dataset"**
3. Choose your upload method:
   - **File Upload**: Select CSV, Excel, or JSON files from your computer
   - **Cloud Storage**: Connect to Google Drive, OneDrive, or AWS S3
   - **Direct Entry**: Paste data directly (for small datasets)
4. Select your file(s) and click **"Upload"**
5. ResearchFlow will scan for Protected Health Information (PHI):
   - If PHI is detected, a governance review will be required
   - You will be notified of any issues
6. Once validated, your data will be added to the project
7. Review the data preview and confirm it looks correct
8. Click **"Confirm"** to complete the upload

**PHI Notice**: If your governance mode is LIVE, you may upload real data containing PHI. All PHI access will be logged and audited. In DEMO mode, PHI is automatically redacted.

---

## Using the Analysis Page

The Analysis page is where you configure and run statistical analyses on your data.

### Overview

The Analysis interface is divided into:
- **Data Panel** (left): Your uploaded datasets
- **Analysis Builder** (center): Configure your analysis
- **Results Panel** (right): View results and outputs

### Running a Basic Analysis

1. From your project, click **"Analysis"**
2. Select a dataset from the left panel
3. Review the data preview to ensure it's correct
4. In the center panel, choose your analysis type:
   - **Descriptive Statistics**: Summary statistics and distributions
   - **Comparative Analysis**: T-tests, ANOVA, Chi-square
   - **Correlation Analysis**: Pearson, Spearman correlations
   - **Regression Analysis**: Linear, logistic, multilevel models
   - **Custom Analysis**: Define your own workflow
5. Configure your analysis:
   - Select variables (columns) to include
   - Set parameters (e.g., significance level α=0.05)
   - Choose output format
6. Click **"Run Analysis"**
7. ResearchFlow will process your request:
   - Your data will be scanned for PHI
   - The analysis will be executed on secure compute workers
   - Results will be validated before display
8. View results in the right panel
9. Click **"Download Results"** or **"Export to Manuscript"** to save

### Working with Variables

1. Click **"Variable Manager"** in the Analysis panel
2. For each variable, configure:
   - **Type**: Continuous, categorical, binary, date
   - **Handling**: Include, exclude, transform
   - **Label**: Human-readable name for outputs
   - **Units**: If numeric (e.g., mmHg, mg/dL)
3. Click **"Apply Changes"**

### Understanding Results

- **Summary Statistics**: Mean, SD, median, quartiles, n
- **Statistical Tests**: Test statistic, p-value, confidence interval, effect size
- **Visualizations**: Automatically generated charts and plots
- **Assumptions**: Checks for statistical assumptions (normality, homogeneity)

### Exporting Analysis Results

1. In the Results panel, click **"Export"**
2. Choose format:
   - **PDF Report**: Professional formatted report
   - **CSV Data**: Raw numerical results
   - **JSON**: Machine-readable format
   - **To Manuscript**: Import directly into Manuscript Studio
3. Click **"Export"**
4. Results will be processed and available for download

---

## Working with Manuscript Studio

Manuscript Studio is ResearchFlow's integrated document editor for creating research papers, reports, and manuscripts.

### Accessing Manuscript Studio

1. From your project, click **"Manuscript"** or **"Manuscript Studio"**
2. Choose to:
   - **Create New Manuscript**: Start a blank manuscript
   - **Open Existing**: Work on a draft in progress
   - **From Template**: Use a predefined structure (IMRaD, Case Report, etc.)

### Manuscript Structure

ResearchFlow supports the standard IMRaD structure:

- **Introduction**: Background, literature review, research question
- **Methods**: Study design, participants, procedures, statistical methods
- **Results**: Findings, tables, figures
- **Discussion**: Interpretation, implications, limitations
- **Conclusion/Abstract**: Summary and conclusions
- **References**: Citation list

### Creating a Manuscript

1. Click **"Create New Manuscript"**
2. Enter manuscript details:
   - **Title**: Working title of your paper
   - **Authors**: Add co-authors from your team
   - **Type**: Select manuscript type (Research Article, Review, Case Report, etc.)
   - **Journal**: Target journal (optional, auto-fills some formatting)
3. Click **"Create"**
4. You'll be taken to the editing interface

### Using the Editor

The Manuscript editor includes:

- **Rich Text Editor**: Format text with bold, italics, strikethrough, superscript
- **Equation Editor**: Insert mathematical equations using LaTeX
- **Reference Manager**: Add and manage citations
- **Table Builder**: Create and format data tables
- **Figure Insertion**: Add images, charts, and plots
- **Collaboration Tools**: Real-time collaboration with team members
- **Version Control**: Track changes and revisions

### Adding Content

1. Click in the section where you want to add content
2. Start typing or use the toolbar to:
   - **Insert Equation**: Click the Σ symbol and enter LaTeX
   - **Insert Table**: Specify rows and columns
   - **Insert Figure**: Upload an image or select from Analysis results
   - **Insert Citation**: Search your reference library
3. Format text using the toolbar or keyboard shortcuts

### Managing References

1. Click **"References"** at the bottom of the editor
2. Add citations:
   - **Paste DOI**: Enter a DOI and ResearchFlow will fetch citation data
   - **Manual Entry**: Type author, year, title, journal
   - **Import**: Upload a BibTeX or RIS file
   - **Search**: Search PubMed, CrossRef, or Google Scholar
3. In your document, use [1], [Author Year], or your preferred style
4. ResearchFlow will auto-format citations according to your journal's style

### Importing Analysis Results

1. From your Analysis, click **"Export to Manuscript"**
2. Choose which results to import (tables, figures, statistics)
3. Select your manuscript and section (Results, Methods, etc.)
4. Click **"Import"**
5. Results will be inserted with proper formatting and table numbering

### Real-Time Collaboration

When multiple team members are editing:

1. You'll see other users' cursors and selections in color
2. Changes are synchronized in real-time
3. You can see who is editing each section
4. Comments and suggestions appear in the margin
5. Track changes to see all modifications

### Version Control and History

1. Click **"Version History"** to see all changes
2. You can:
   - **View Previous Version**: See how the document looked at any point
   - **Restore Version**: Revert to an earlier version
   - **Compare Versions**: See what changed between versions
   - **Track Changes**: See who made each change and when

### Exporting Manuscripts

1. Click **"File"** → **"Export"**
2. Choose your format:
   - **Word (.docx)**: For further editing or submission
   - **PDF**: For review or sharing
   - **LaTeX**: For advanced formatting control
   - **Plain Text**: For archival
3. Configure export options:
   - Include/exclude references
   - Include/exclude figures
   - Citation format
   - Page numbering
4. Click **"Export"**
5. Your file will download automatically

---

## Understanding Governance Workflows

Governance workflows ensure your research complies with institutional policies, ethical guidelines, and regulatory requirements (like HIPAA).

### Governance Modes

ResearchFlow operates in different modes that affect how you can work with data:

#### DEMO Mode
- **PHI Status**: All protected health information is automatically redacted
- **Purpose**: Training, testing, demonstrations
- **Restrictions**: No real patient data
- **AI Access**: Mocked responses
- **When to Use**: Learning the system, developing protocols

#### LIVE Mode
- **PHI Status**: Real patient data can be processed and accessed
- **Purpose**: Production research with actual data
- **Restrictions**: All PHI access is logged and requires governance approval
- **AI Access**: Real AI models integrated
- **When to Use**: Conducting actual research

#### STANDBY Mode
- **PHI Status**: Read-only access, no analysis possible
- **Purpose**: Maintenance, system updates
- **Restrictions**: No new analyses can be started
- **When to Use**: During system maintenance windows

### Governance Review Process

When your analysis involves PHI or other sensitive considerations, you may need governance approval:

1. **Automatic Trigger**: When you attempt to:
   - Upload real PHI in LIVE mode
   - Export results containing sensitive information
   - Modify team access to sensitive projects
   - Change governance-related settings

2. **Submit for Review**:
   - You'll be prompted with a governance review form
   - Complete the required information:
     - Purpose of analysis/export
     - Data elements being accessed
     - Team members who will access results
     - Justification for the requested action
   - Click **"Submit for Governance Review"**

3. **Steward Review**:
   - A designated Steward will review your request
   - They may ask for clarification or request modifications
   - Review typically takes 1-2 business days
   - You'll be notified via email of the decision

4. **Approval Outcomes**:
   - **Approved**: You can proceed with your requested action
   - **Conditional Approval**: Proceed with modifications (e.g., restricted access)
   - **Denied**: Request was denied; you can appeal or modify your request

### Audit Logs

All activities in ResearchFlow are logged for compliance purposes:

1. To view audit logs, click **"Settings"** → **"Audit Logs"** (Steward/Admin only)
2. Logs contain:
   - **User**: Who performed the action
   - **Action**: What was done (upload, analysis, export, etc.)
   - **Resource**: What was affected (dataset, manuscript, etc.)
   - **Timestamp**: When the action occurred
   - **Result**: Success or failure
   - **Details**: Additional context
3. You can filter logs by:
   - Date range
   - User
   - Action type
   - Resource type
4. Export logs for compliance reporting

### PHI Scanning

PHI (Protected Health Information) is protected by law. ResearchFlow automatically scans for PHI:

- **Scan Points**: Upload, analysis, export, collaboration edits
- **Detection Method**: Regex patterns + machine learning
- **Redaction**: When detected in DEMO mode, automatically replaced with [PHI-REDACTED]
- **In LIVE Mode**: PHI is allowed but flagged in audit logs
- **False Positives**: If legitimate data is flagged, contact your admin to whitelist patterns

---

## Exporting and Sharing Results

### Export Options

#### 1. Direct Export
1. From your Analysis or Manuscript, click **"Export"**
2. Choose format:
   - **PDF**: Professional formatted document
   - **Word**: Editable document format
   - **CSV/Excel**: Data format for further analysis
   - **JSON**: Machine-readable format
3. Configure options (author names, dates, branding)
4. Click **"Export"** and download

#### 2. Sharing Within ResearchFlow
1. Click **"Share"** on your project, analysis, or manuscript
2. Add team members by email:
   - Select their access level (Viewer, Editor, Steward)
   - Add an optional message
3. Click **"Send Invitations"**
4. They'll receive an email and can access from their Dashboard

#### 3. Publishing to External Platforms
1. Click **"Publish"** → **"External Platform"**
2. Choose destination:
   - **DOI/Repository**: Zenodo, OSF, Figshare
   - **Institutional Repository**: Your university's IR
   - **Journal Submission**: Compatible journals
3. Enter publication metadata:
   - Authors, keywords, abstract
   - License (CC0, CC-BY, CC-BY-SA, etc.)
   - Embargo period (if applicable)
4. Click **"Publish"**
5. Your results will be uploaded and assigned a DOI

### Managing Access Control

#### Project-Level Access
1. From your project, click **"Settings"** → **"Access Control"**
2. Manage visibility:
   - **Private**: Only explicit members
   - **Internal**: All organization members
   - **Public**: Anyone with the link
3. Manage member permissions:
   - Select member → adjust their role
   - Remove members if needed
4. Click **"Save"**

#### Specific Document Sharing
1. Open your manuscript or analysis
2. Click **"Share"** → **"Link Settings"**
3. Configure:
   - **Can View**: Can only read
   - **Can Comment**: Can suggest changes
   - **Can Edit**: Full editing access
   - **Viewer List**: See who has access
4. Generate a shareable link or email invitations

### Restricted Data Handling

If your export contains PHI or restricted data:

1. Your export will be scanned automatically
2. If sensitive information is detected:
   - A governance review may be required
   - You'll be notified of any restrictions
   - In DEMO mode, PHI will be automatically redacted
3. Download will proceed once approved/redacted
4. A record of the export will be logged for audit

### Compliance Reporting

To generate compliance reports:

1. Click **"Reports"** → **"Compliance Report"**
2. Select report type:
   - **HIPAA Audit Trail**: PHI access logs
   - **Data Usage**: What data was accessed when
   - **Access Control**: Who has permissions
   - **Custom Report**: Define your own criteria
3. Set date range
4. Click **"Generate"**
5. Report will download as PDF

---

## Getting Help

### Built-in Help Resources

- **Help Icon (?)**:Located throughout the interface
  - Hover or click for context-specific help
  - Links to relevant documentation
  - Video tutorials for features

- **Tutorial Mode**:
  - Click **"Help"** → **"Start Tutorial"**
  - Interactive walkthroughs of key features
  - Can be run in a sandbox environment

### Documentation

- **Knowledge Base**: Full documentation at docs.researchflow.io
- **FAQ**: Common questions and answers
- **Video Library**: Tutorial videos for all features

### Support Channels

- **Email Support**: support@researchflow.io
  - Response time: 24 hours
  - Technical issues, account problems

- **Live Chat**: Available Monday-Friday, 9 AM-5 PM EST
  - Quick questions and troubleshooting

- **Community Forum**: community.researchflow.io
  - Ask questions and share solutions
  - Community-driven knowledge base

- **IT Support**: Contact your organization's IT department
  - For institutional deployment issues
  - Network or access problems

### Reporting Issues

1. Click **"Help"** → **"Report Issue"**
2. Provide:
   - What you were doing
   - What went wrong
   - Screenshots (if applicable)
   - Expected behavior
3. Click **"Submit"**
4. You'll receive a ticket number for tracking

---

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Save | Ctrl+S | Cmd+S |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Y | Cmd+Shift+Z |
| Bold | Ctrl+B | Cmd+B |
| Italic | Ctrl+I | Cmd+I |
| Underline | Ctrl+U | Cmd+U |
| Find | Ctrl+F | Cmd+F |
| Find & Replace | Ctrl+H | Cmd+H |
| New Line in Table | Tab | Tab |
| Previous Cell | Shift+Tab | Shift+Tab |

---

## Tips and Best Practices

1. **Organize Your Projects**: Use clear naming and descriptions for easy navigation
2. **Regular Backups**: Regularly export important manuscripts and data
3. **Document Decisions**: Add notes and comments explaining key decisions
4. **Use Collaborator Comments**: Leverage the collaborative features for peer review
5. **Version Control**: Check version history before major changes
6. **Read Data Carefully**: Always review data previews after upload
7. **Test Before LIVE**: Use DEMO mode to test workflows before using real data
8. **Follow Governance**: Always submit required governance reviews promptly
9. **Protect Credentials**: Never share passwords or API keys
10. **Keep Software Updated**: Use the latest version of your browser

---

## Glossary

- **PHI**: Protected Health Information - data that identifies individuals
- **HIPAA**: Health Insurance Portability and Accountability Act
- **RBAC**: Role-Based Access Control
- **MFA**: Multi-Factor Authentication
- **IMRaD**: Introduction, Methods, Results, and Discussion
- **Steward**: User responsible for governance approval
- **Governance**: Institutional oversight and approval processes
- **Audit Log**: Record of all system activities
- **Artifact**: Any output from ResearchFlow (tables, figures, reports)

---

## FAQ

**Q: Can I change my password?**
A: Yes, go to Settings → Security → Change Password. You'll need to provide your current password.

**Q: What if I forget my password?**
A: Click "Forgot Password" on the login page and follow the email instructions to reset it.

**Q: Can I have multiple roles?**
A: Yes, you can have different roles in different projects or across your organization.

**Q: How long is my data kept after project completion?**
A: Data retention policies vary by organization. Contact your institution's data steward.

**Q: Can I export my data in bulk?**
A: For bulk exports, contact support@researchflow.io with your requirements.

**Q: Is real patient data ever used in DEMO mode?**
A: No, all PHI is automatically redacted in DEMO mode.

**Q: How do I add external collaborators?**
A: Your organization's admin must set up external accounts. Contact your IT department.

**Q: What browsers are supported?**
A: Chrome, Firefox, Safari, and Edge (latest versions). Internet Explorer is not supported.

**Q: Can I access ResearchFlow on mobile?**
A: A mobile app is available for iOS and Android with limited functionality for document review and commenting.

---

## Getting Started Checklist

- [ ] Created your account and verified email
- [ ] Enabled Multi-Factor Authentication
- [ ] Understood your user role and permissions
- [ ] Created your first project
- [ ] Invited team members
- [ ] Uploaded your first dataset
- [ ] Ran a simple analysis
- [ ] Created a manuscript draft
- [ ] Reviewed governance policies
- [ ] Exported and shared results

Congratulations! You're ready to use ResearchFlow for your research.

---

For more help, visit docs.researchflow.io or contact support@researchflow.io
