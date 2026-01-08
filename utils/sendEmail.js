const nodemailer = require('nodemailer');

let transporter = null;

// Log level for debugging
const isProduction = process.env.NODE_ENV === 'production';
const log = (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, data);
};

// Validate email configuration
const validateEmailConfig = () => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
        log('ERROR', 'EMAIL_USER or EMAIL_PASS is missing', {
            emailUserExists: !!emailUser,
            emailPassExists: !!emailPass,
            env: process.env.NODE_ENV
        });
        return false;
    }

    log('INFO', 'Email configuration validated', {
        emailUser: emailUser.substring(0, 5) + '***',
        nodeEnv: process.env.NODE_ENV
    });
    return true;
};

// Get or create transporter with connection pooling
const getTransporter = () => {
    if (transporter) {
        return transporter;
    }

    log('INFO', 'Creating new email transporter', { service: 'gmail' });

    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        service: 'gmail',
        port: 587,
        secure: false, // Use STARTTLS, not SSL
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS // Must be App Password for Gmail, not regular password
        },
        connectionTimeout: 1000000, // 10 seconds
        socketTimeout: 1000000,     // 10 seconds
        greetingTimeout: 1000000,
        tls: {
            rejectUnauthorized: true // For production, set to true if you have proper SSL setup
        },
        pool: {
            maxConnections: 3,
            maxMessages: 100,
            rateLimit: 10 // 10 messages per second
        },
        logger: !isProduction, // Disable logger in production
        debug: !isProduction   // Disable debug in production
    });

    // Test connection
    transporter.verify((error, success) => {
        if (error) {
            log('ERROR', 'SMTP Verification Failed', {
                error: error.message,
                code: error.code,
                command: error.command
            });
        } else {
            log('INFO', 'SMTP Server Connected Successfully', { service: 'gmail' });
        }
    });

    return transporter;
};

// Non-blocking async email - fires and forgets
const sendEmailAsync = (options) => {
    if (!validateEmailConfig()) {
        log('ERROR', 'Email not sent - missing credentials', { to: options.email });
        return Promise.resolve(null);
    }

    if (!options.email || !options.subject) {
        log('ERROR', 'Email not sent - missing required fields', {
            email: options.email,
            subject: options.subject
        });
        return Promise.resolve(null);
    }

    log('INFO', 'Sending email (async/non-blocking)', { to: options.email, subject: options.subject });

    // Fire-and-forget pattern
    getTransporter().sendMail(
        {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html || options.message.replace(/\n/g, '<br>')
        },
        (error, info) => {
            if (error) {
                log('ERROR', 'Email sending failed (async)', {
                    to: options.email,
                    subject: options.subject,
                    error: error.message,
                    code: error.code,
                    command: error.command
                });

                // For Gmail: common errors
                if (error.message.includes('Invalid login')) {
                    log('ERROR', 'GMAIL AUTH ERROR - Check EMAIL_PASS (use App Password, not regular password)', {
                        emailUser: process.env.EMAIL_USER.substring(0, 5) + '***'
                    });
                }
            } else {
                log('INFO', 'Email sent successfully (async)', {
                    to: options.email,
                    messageId: info.messageId,
                    response: info.response
                });
            }
        }
    );

    // Return immediately - don't wait for email
    return Promise.resolve(null);
};

// Blocking email - waits for response
const sendEmailSync = async (options) => {
    try {
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

        log('INFO', 'Sending email (sync/blocking)', { to: options.email, subject: options.subject });

        const info = await getTransporter().sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html || options.message.replace(/\n/g, '<br>')
        });

        log('INFO', 'Email sent successfully (sync)', {
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
            code: error.code,
            command: error.command
        });

        // For Gmail: common errors
        if (error.message.includes('Invalid login')) {
            log('ERROR', 'GMAIL AUTH ERROR - Check EMAIL_PASS (use App Password, not regular password)', {
                emailUser: process.env.EMAIL_USER.substring(0, 5) + '***'
            });
        }

        return null;
    }
};

// Default export for backwards compatibility
const sendEmail = async (options) => {
    return sendEmailSync(options);
};

module.exports = sendEmail;
module.exports.sendEmailAsync = sendEmailAsync;
module.exports.sendEmailSync = sendEmailSync;