/**
 * Email Service (Task 83)
 *
 * Handles sending emails for invites and notifications.
 * In development mode, logs emails to console instead of sending.
 *
 * Production would integrate with SendGrid, AWS SES, or similar.
 */

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const NODE_ENV = process.env.NODE_ENV || "development";

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface InviteEmailParams {
  email: string;
  token: string;
  orgName: string;
  orgRole: string;
  inviterName?: string;
  expiresAt: Date;
}

/**
 * Send an email (dev mode: logs to console)
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (NODE_ENV === "development" || NODE_ENV === "test") {
    console.log("\n=== EMAIL (Development Mode) ===");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log("---");
    console.log(options.text);
    console.log("================================\n");
    return true;
  }

  // Production: integrate with email provider
  // Example with SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: options.to,
  //   from: process.env.FROM_EMAIL,
  //   subject: options.subject,
  //   text: options.text,
  //   html: options.html,
  // });

  console.warn("[emailService] Production email not configured, skipping send");
  return false;
}

/**
 * Send an organization invite email
 */
export async function sendInviteEmail(params: InviteEmailParams): Promise<boolean> {
  const { email, token, orgName, orgRole, inviterName, expiresAt } = params;

  const inviteUrl = `${APP_URL}/invite/accept?token=${token}`;
  const expiryDate = expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const inviterText = inviterName ? `${inviterName} has invited` : "You have been invited";

  const subject = `You're invited to join ${orgName} on ResearchFlow`;

  const text = `
${inviterText} you to join "${orgName}" on ResearchFlow as a ${orgRole}.

Click the link below to accept the invitation:
${inviteUrl}

This invitation expires on ${expiryDate}.

If you didn't expect this invitation, you can safely ignore this email.

---
ResearchFlow Canvas - Research Workflow Platform
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #2563eb; margin: 0; }
    .content { background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 20px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: #1d4ed8; }
    .footer { text-align: center; color: #64748b; font-size: 14px; }
    .expiry { color: #dc2626; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ResearchFlow Canvas</h1>
    </div>
    <div class="content">
      <p>${inviterText} you to join <strong>${orgName}</strong> on ResearchFlow as a <strong>${orgRole}</strong>.</p>
      <p>Click the button below to accept the invitation and join the organization:</p>
      <p style="text-align: center;">
        <a href="${inviteUrl}" class="button">Accept Invitation</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; font-size: 14px; color: #64748b;">${inviteUrl}</p>
      <p class="expiry">This invitation expires on ${expiryDate}.</p>
    </div>
    <div class="footer">
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      <p>ResearchFlow Canvas - Research Workflow Platform</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, text, html });
}

/**
 * Send a welcome email to a new organization member
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string,
  orgName: string
): Promise<boolean> {
  const dashboardUrl = `${APP_URL}/dashboard`;

  const subject = `Welcome to ${orgName} on ResearchFlow!`;

  const text = `
Hi ${userName},

Welcome to ${orgName} on ResearchFlow Canvas!

You now have access to the organization's research projects and collaboration tools.

Get started by visiting your dashboard:
${dashboardUrl}

If you have any questions, reach out to your organization administrator.

---
ResearchFlow Canvas - Research Workflow Platform
  `.trim();

  return sendEmail({ to: email, subject, text });
}

/**
 * Send notification when member is removed from org
 */
export async function sendMemberRemovedEmail(
  email: string,
  userName: string,
  orgName: string
): Promise<boolean> {
  const subject = `You have been removed from ${orgName}`;

  const text = `
Hi ${userName},

Your membership in "${orgName}" on ResearchFlow has been removed.

If you believe this was done in error, please contact the organization administrator.

---
ResearchFlow Canvas - Research Workflow Platform
  `.trim();

  return sendEmail({ to: email, subject, text });
}

/**
 * Send notification when member's role is changed
 */
export async function sendRoleChangedEmail(
  email: string,
  userName: string,
  orgName: string,
  oldRole: string,
  newRole: string
): Promise<boolean> {
  const subject = `Your role in ${orgName} has been updated`;

  const text = `
Hi ${userName},

Your role in "${orgName}" on ResearchFlow has been updated from ${oldRole} to ${newRole}.

This may affect your permissions and access within the organization.

---
ResearchFlow Canvas - Research Workflow Platform
  `.trim();

  return sendEmail({ to: email, subject, text });
}
