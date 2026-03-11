import nodemailer from "nodemailer";

/**
 * @fileoverview Email Service
 * @description Provides email sending functionality using Gmail SMTP.
 * @module services/email.service
 */

let transporter;
let isInitialized = false;

/**
 * Create Email Transporter
 * 
 * @description Initializes Nodemailer transporter with Gmail SMTP.
 * Requires EMAIL_USER and EMAIL_PASSWORD environment variables.
 * 
 * @private
 * @async
 */
const createTransporter = async () => {
  if (isInitialized) return;

  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error("⚠️ EMAIL_USER and EMAIL_PASSWORD must be set in environment variables");
    console.error("⚠️ Password reset and email features will NOT work");
    
    // Create a dummy transporter that throws errors
    transporter = {
      sendMail: async () => {
        throw new Error("Email service not configured. Set EMAIL_USER and EMAIL_PASSWORD environment variables.");
      }
    };
    isInitialized = true;
    return;
  }

  // Production: Use Gmail SMTP
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  
  console.log(`📧 Email service ready (${process.env.EMAIL_USER})`);
  isInitialized = true;
};

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
    // Ensure transporter is initialized
    if (!isInitialized) {
      await createTransporter();
    }

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
    console.error("📧 Error details:", error);
    throw new Error("Failed to send email");
  }
};
