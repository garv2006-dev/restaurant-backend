const nodemailer = require('nodemailer');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const emailService = require('../services/emailService');

// Log level for debugging
const isProduction = process.env.NODE_ENV === 'production';
const log = (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, data);
};

// Validate email configuration
const validateEmailConfig = () => {
    const emailUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const emailPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
        log('ERROR', 'Email credentials missing', {
            emailUserExists: !!emailUser,
            emailPassExists: !!emailPass,
            env: process.env.NODE_ENV
        });
        return false;
    }
    return true;
};

let transporter = null;
const getTransporter = () => {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true';

    log('INFO', 'Creating new email transporter', { host, port, secure });

    const config = {
        host,
        port,
        secure,
        auth: {
            user: process.env.SMTP_USER || process.env.EMAIL_USER,
            pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
        },
        connectionTimeout: 10000,
        socketTimeout: 10000,
        tls: { rejectUnauthorized: isProduction },
        pool: { maxConnections: 5, maxMessages: 100, rateLimit: 10 },
        logger: !isProduction,
        debug: !isProduction
    };

    transporter = nodemailer.createTransport(config);
    return transporter;
};

/**
 * Enhanced Send Email Function
 * Primary: Resend SDK
 * Secondary: Brevo/SMTP Fallback
 */
const sendEmailAsync = async (options) => {
    // 1. Try Resend Service if configured
    if (process.env.RESEND_API_KEY) {
        log('INFO', 'Sending email via Resend Service', { to: options.email });
        const result = await emailService.send({
            to: options.email,
            subject: options.subject,
            html: options.html || options.message.replace(/\n/g, '<br>'),
            text: options.message,
            tags: options.tags || []
        });

        if (result.success) return true;
        log('WARNING', 'Resend failed, falling back to other providers', { error: result.error });
    }

    // 2. Try Brevo if configured
    if (process.env.BREVO_API_KEY) {
        try {
            log('INFO', 'Sending email via Brevo SDK', { to: options.email });
            const client = SibApiV3Sdk.ApiClient.instance;
            client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

            const api = new SibApiV3Sdk.TransactionalEmailsApi();

            await api.sendTransacEmail({
                sender: { email: process.env.EMAIL_FROM || process.env.EMAIL_USER, name: process.env.SENDER_NAME || "Luxury Hotel" },
                to: [{ email: options.email }],
                subject: options.subject,
                htmlContent: options.html || options.message.replace(/\n/g, '<br>')
            });

            return true;
        } catch (err) {
            log('WARNING', 'Brevo email error, falling back to SMTP', { error: err.message });
        }
    }

    // 3. SMTP Fallback
    try {
        if (!validateEmailConfig()) {
            throw new Error('Email configuration missing for SMTP');
        }

        const info = await getTransporter().sendMail({
            from: process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html || options.message.replace(/\n/g, '<br>')
        });

        log('INFO', 'Email sent successfully via SMTP');
        return true;
    } catch (smtpError) {
        log('ERROR', 'All email providers failed', { error: smtpError.message });
        throw new Error(`Email sending failed: ${smtpError.message}`);
    }
};

const sendEmailSync = async (options) => {
    return sendEmailAsync(options);
};

const sendEmail = async (options) => {
    return sendEmailAsync(options);
};

module.exports = sendEmail;
module.exports.sendEmailAsync = sendEmailAsync;
module.exports.sendEmailSync = sendEmailSync;