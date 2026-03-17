const nodemailer = require('nodemailer');
const SibApiV3Sdk = require('sib-api-v3-sdk');



console.log("BREVO_API_KEY", process.env.BREVO_API_KEY);
let transporter = null;

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

// Get or create transporter with connection pooling
const getTransporter = () => {
    if (transporter) {
        return transporter;
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true'; // Usually false for 587, true for 465
    const service = process.env.EMAIL_SERVICE; // Optional, e.g. 'gmail'

    log('INFO', 'Creating new email transporter', { host, port, secure, service });

    const config = {
        host,
        port,
        secure,
        auth: {
            user: process.env.SMTP_USER || process.env.EMAIL_USER,
            pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
        },
        connectionTimeout: 10000, // 10 seconds
        socketTimeout: 10000,
        greetingTimeout: 10000,
        tls: {
            rejectUnauthorized: isProduction // Only strict in production
        },
        pool: {
            maxConnections: 5,
            maxMessages: 100,
            rateLimit: 10 
        },
        logger: !isProduction,
        debug: !isProduction
    };

    // If service is specified (like 'gmail'), use it to simplify config
    if (service && !process.env.SMTP_HOST) {
        config.service = service;
    }

    transporter = nodemailer.createTransport(config);

    // Test connection
    transporter.verify((error, success) => {
        if (error) {
            log('ERROR', 'SMTP Verification Failed', {
                error: error.message,
                code: error.code
            });
        } else {
            log('INFO', 'SMTP Server Connected Successfully');
        }
    });

    return transporter;
};

// Main email sending logic
const sendEmailAsync = async (options) => {
    const provider = process.env.EMAIL_PROVIDER || (process.env.BREVO_API_KEY ? 'brevo' : 'smtp');

    if (provider === 'brevo' && process.env.BREVO_API_KEY) {
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

            log('INFO', 'Email sent successfully via Brevo');
            return true;
        } catch (err) {
            log('WARNING', 'Brevo email error, falling back to SMTP', { error: err.message });
            // Fallback to SMTP handled below
        }
    }

    // SMTP Sending (Primary or Fallback)
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

        log('INFO', 'Email sent successfully via SMTP', {
            to: options.email,
            messageId: info.messageId
        });
        return true;
    } catch (smtpError) {
        log('ERROR', 'Email sending failed', { error: smtpError.message });
        throw new Error(`Email sending failed: ${smtpError.message}`);
    }
};

// Blocking email - waits for response
const sendEmailSync = async (options) => {
    try {
        const provider = process.env.EMAIL_PROVIDER || (process.env.BREVO_API_KEY ? 'brevo' : 'smtp');

        if (provider === 'brevo' && process.env.BREVO_API_KEY) {
            log('INFO', 'Sending email sync via Brevo SDK', { to: options.email });
            const client = SibApiV3Sdk.ApiClient.instance;
            client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

            const api = new SibApiV3Sdk.TransactionalEmailsApi();

            const result = await api.sendTransacEmail({
                sender: { email: process.env.EMAIL_FROM || process.env.EMAIL_USER, name: process.env.SENDER_NAME || "Luxury Hotel" },
                to: [{ email: options.email }],
                subject: options.subject,
                htmlContent: options.html || options.message.replace(/\n/g, '<br>')
            });

            log('INFO', 'Email sent successfully sync via Brevo');
            return result;
        }

        if (!validateEmailConfig()) {
            log('ERROR', 'Email not sent - missing credentials', { to: options.email });
            return null;
        }

        if (!options.email || !options.subject) {
            log('ERROR', 'Email not sent - missing required fields', {
                email: options.email,
                subject: options.subject
            });
            return null;
        }

        log('INFO', 'Sending email via SMTP (sync/blocking)', { to: options.email, subject: options.subject });

        const info = await getTransporter().sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html || options.message.replace(/\n/g, '<br>')
        });

        log('INFO', 'Email sent successfully via SMTP (sync)', {
            to: options.email,
            messageId: info.messageId,
            response: info.response
        });
        return info;
    } catch (error) {
        log('ERROR', 'Email sending failed (sync)', {
            to: options.email,
            subject: options.subject,
            error: error.message,
            code: error.code
        });

        return null;
    }
};

// Default export for backwards compatibility
const sendEmail = async (options) => {
    return sendEmailAsync(options);
};

module.exports = sendEmail;
module.exports.sendEmailAsync = sendEmailAsync;
module.exports.sendEmailSync = sendEmailSync;