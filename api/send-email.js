/**
 * Backend API Endpoint for sending emails using nodemailer
 * 
 * This file should be placed in your backend server (e.g., Express.js, Next.js API route, etc.)
 * 
 * Example setup for Express.js:
 * 
 * 1. Install nodemailer: npm install nodemailer
 * 2. Create this endpoint in your backend
 * 3. Set up environment variables for email configuration
 * 
 * Environment variables needed:
 * - EMAIL_HOST (e.g., smtp.gmail.com)
 * - EMAIL_PORT (e.g., 587)
 * - EMAIL_USER (e.g., venu79000@gmail.com)
 * - EMAIL_PASS (Gmail App Password or SMTP password)
 */

const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || 'venu79000@gmail.com',
    pass: process.env.EMAIL_PASS // Gmail App Password or SMTP password
  }
});

/**
 * API Endpoint Handler
 * POST /api/send-email
 */
async function sendEmailHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, from, subject, html, text } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: 'Missing required fields: to, subject' });
    }

    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: from || process.env.EMAIL_USER || 'venu79000@gmail.com',
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, '') // Fallback to text if not provided
    });

    console.log('Email sent successfully:', info.messageId);
    
    return res.status(200).json({ 
      success: true, 
      messageId: info.messageId,
      message: 'Email sent successfully' 
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send email' 
    });
  }
}

// Export for different frameworks
module.exports = sendEmailHandler;

/**
 * Example usage in Express.js:
 * 
 * const express = require('express');
 * const router = express.Router();
 * const sendEmailHandler = require('./send-email');
 * 
 * router.post('/send-email', sendEmailHandler);
 * 
 * Example usage in Next.js API route (pages/api/send-email.js):
 * 
 * import sendEmailHandler from '../../api/send-email';
 * export default sendEmailHandler;
 * 
 * Example usage in Vercel Serverless Function:
 * 
 * export default async function handler(req, res) {
 *   return sendEmailHandler(req, res);
 * }
 */

