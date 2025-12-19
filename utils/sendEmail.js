const nodemailer = require('nodemailer');

let transporter = null;

// Get or create transporter with connection pooling
const getTransporter = () => {
    if (transporter) return transporter;
    
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Use STARTTLS
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        connectionTimeout: 5000,
        socketTimeout: 5000,
        pool: {
            maxConnections: 5,
            maxMessages: 100,
            rateLimit: 14 // 14 messages per second
        }
    });
    
    transporter.verify((error, success) => {
        if (error) {
            console.error('[Email Config Error]', { error: error.message, timestamp: new Date().toISOString() });
        } else {
            console.log('[Email Connected]', { timestamp: new Date().toISOString() });
        }
    });
    
    return transporter;
};

// Non-blocking async email - fires and forgets
const sendEmailAsync = (options) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('[Email Config Missing]', { timestamp: new Date().toISOString() });
        return Promise.resolve(null);
    }
    
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
                console.error('[Email Error]', { email: options.email, error: error.message, timestamp: new Date().toISOString() });
            } else {
                console.log('[Email Sent]', { email: options.email, messageId: info.messageId, timestamp: new Date().toISOString() });
            }
        }
    );
    
    // Return immediately - don't wait for email
    return Promise.resolve(null);
};

// Blocking email - waits for response
const sendEmailSync = async (options) => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('[Email Config Missing]', { timestamp: new Date().toISOString() });
            return null;
        }
        
        const info = await getTransporter().sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html || options.message.replace(/\n/g, '<br>')
        });
        
        console.log('[Email Sent]', { email: options.email, messageId: info.messageId, timestamp: new Date().toISOString() });
        return info;
    } catch (error) {
        console.error('[Email Error]', { email: options.email, error: error.message, timestamp: new Date().toISOString() });
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