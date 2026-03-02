import nodemailer from "nodemailer";

/**
 * @fileoverview Email Service
 * @description Provides email sending functionality using Ethereal Email for development.
 * Handles password reset emails and other transactional emails.
 * @module services/email.service
 */

let transporter;

/**
 * Create Email Transporter
 * 
 * @description Initializes Nodemailer transporter with Ethereal Email test account.
 * Ethereal Email is a development/testing service providing fake SMTP server.
 * 
 * @private
 * @async
 * 
 * @note In production, replace with real SMTP service (SendGrid, AWS SES, etc.)
 * @note Ethereal emails are not delivered - use preview URL to view
 */
const createTransporter = async () => {
  const testAccount = await nodemailer.createTestAccount();

  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  console.log("📧 Ethereal Email ready");
};

await createTransporter();

/**
 * Send Email
 * 
 * @description Sends HTML email using configured transporter. Currently uses Ethereal
 * Email for development - emails not actually delivered but preview URL provided.
 * 
 * @async
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - Email body HTML content
 * 
 * @returns {Promise<void>}
 * 
 * @example
 * await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Password Reset',
 *   html: '<p>Click <a href="...">here</a> to reset your password</p>'
 * });
 * 
 * @logging Logs preview URL to console for development testing
 * 
 * @production
 * - Replace Ethereal with production SMTP service
 * - Configure real SMTP credentials via environment variables
 * - Consider email templates for consistent styling
 * - Add email queuing for high volume (Bull, BullMQ)
 * - Implement retry logic for failed sends
 * - Track email delivery status
 */
export const sendEmail = async ({ to, subject, html }) => {
  const info = await transporter.sendMail({
    from: '"GreenCommute" <no-reply@greencommute.dev>',
    to,
    subject,
    html,
  });

  console.log("📨 Preview URL:", nodemailer.getTestMessageUrl(info));
};
