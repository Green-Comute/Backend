import nodemailer from "nodemailer";

/**
 * @fileoverview Email Service
 * @description Provides email sending functionality using Gmail SMTP for production
 * or Ethereal Email for development.
 * @module services/email.service
 */

let transporter;

/**
 * Create Email Transporter
 * 
 * @description Initializes Nodemailer transporter with production SMTP or test account.
 * Uses Gmail SMTP in production (via environment variables) or Ethereal for testing.
 * 
 * @private
 * @async
 * 
 * @note Production requires EMAIL_USER and EMAIL_PASSWORD environment variables
 * @note For Gmail: use App Password, not regular password
 */
const createTransporter = async () => {
  // Production: Use real SMTP service
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    console.log("📧 Production email service ready");
    return;
  }

  // Development: Use Ethereal Email with timeout
  try {
    const testAccount = await Promise.race([
      nodemailer.createTestAccount(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Ethereal timeout')), 5000)
      )
    ]);

    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log("📧 Ethereal Email ready (development mode)");
  } catch (error) {
    console.error("⚠️ Email service initialization failed:", error.message);
    console.error("⚠️ Emails will NOT be sent. Configure EMAIL_USER and EMAIL_PASSWORD in production.");
    
    // Fallback: create a dummy transporter that logs instead of sending
    transporter = {
      sendMail: async (mailOptions) => {
        console.log("📧 [EMAIL NOT SENT] To:", mailOptions.to);
        console.log("📧 [EMAIL NOT SENT] Subject:", mailOptions.subject);
        return { messageId: 'dummy-id' };
      }
    };
  }
};

await createTransporter();

/**
 * Send Email
 * 
 * @description Sends HTML email using configured transporter.
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
 */
export const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"GreenCommute" <no-reply@greencommute.dev>',
      to,
      subject,
      html,
    });

    // Log preview URL for Ethereal Email
    if (info.messageId && !process.env.EMAIL_USER) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log("📨 Preview URL:", previewUrl);
      }
    } else {
      console.log("📨 Email sent successfully to:", to);
    }
  } catch (error) {
    console.error("📧 Email sending failed:", error.message);
    throw new Error("Failed to send email");
  }
};
