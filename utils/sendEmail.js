const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    try {
        // Create transporter
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Define email options
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html || options.message.replace(/\n/g, '<br>')
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('Message sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Email sending error:', error);
        // Don't throw error, just log it and continue
        return null;
    }
};

module.exports = sendEmail;