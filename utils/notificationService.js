const nodemailer = require('nodemailer');

// Initialize Email Transporter
const emailTransporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Initialize Twilio (Try/Catch to avoid crash if keys missing)
let twilioClient;
try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = require('twilio')(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
    }
} catch (e) {
    console.error('Twilio init error:', e.message);
}

exports.sendLowStockAlert = async (merchantSettings, product) => {
    const {
        alert_email, phone_number,
        notify_email, notify_sms, notify_whatsapp
    } = merchantSettings;

    const { name, currentQuantity, threshold } = product;
    const messageBody = `⚠️ *Low Stock Alert* ⚠️\nProduct: ${name}\nStock: ${currentQuantity} (Threshold: ${threshold})\nRestock Recommended!`;

    const results = [];

    // 1. Email Alert
    if (notify_email && alert_email) {
        try {
            await emailTransporter.sendMail({
                from: process.env.EMAIL_USER,
                to: alert_email,
                subject: `⚠️ Low Stock Alert: ${name}`,
                html: `
                    <h2>Low Stock Warning</h2>
                    <p>The product <strong>${name}</strong> is running low.</p>
                    <ul>
                        <li>Current Quantity: <strong>${currentQuantity}</strong></li>
                        <li>Threshold: <strong>${threshold}</strong></li>
                    </ul>
                    <p>Please restock soon!</p>
                `
            });
            results.push('Email sent');
            console.log(`Email sent to ${alert_email}`);
        } catch (err) {
            console.error('Email failed:', err.message);
            results.push('Email failed');
        }
    }

    // 2. SMS Alert (Twilio)
    if (notify_sms && phone_number && twilioClient) {
        try {
            await twilioClient.messages.create({
                body: messageBody,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phone_number // Must be E.164 format (e.g., +966...)
            });
            results.push('SMS sent');
            console.log(`SMS sent to ${phone_number}`);
        } catch (err) {
            console.error('SMS failed:', err.message);
            results.push(`SMS failed: ${err.message}`);
        }
    }

    // 3. WhatsApp Alert (Twilio Sandbox or Business API)
    if (notify_whatsapp && phone_number && twilioClient) {
        try {
            await twilioClient.messages.create({
                body: messageBody,
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`, // e.g., +14155238886
                to: `whatsapp:${phone_number}`
            });
            results.push('WhatsApp sent');
            console.log(`WhatsApp sent to ${phone_number}`);
        } catch (err) {
            console.error('WhatsApp failed:', err.message);
            results.push(`WhatsApp failed: ${err.message}`);
        }
    }

    return results;
};
