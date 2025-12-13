const nodemailer = require('nodemailer');
const axios = require('axios');

// Initialize Email Transporter
const emailTransporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendLowStockAlert = async (merchantSettings, product) => {
    const {
        alert_email, custom_webhook_url, telegram_chat_id,
        notify_email, notify_webhook
    } = merchantSettings;

    const { name, currentQuantity, threshold, rawData } = product;

    // Payload for Webhook
    const alertPayload = {
        event: 'low_stock_alert',
        product_name: name,
        current_quantity: currentQuantity,
        threshold: threshold,
        merchant_telegram_chat_id: telegram_chat_id, // Critical for routing
        timestamp: new Date().toISOString(),
        raw_salla_data: rawData // Include raw data for debugging in n8n/Make
    };

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

    // 2. Custom Webhook Alert (n8n / Zapier)
    if (notify_webhook && custom_webhook_url) {
        try {
            console.log(`Sending Webhook to: ${custom_webhook_url}`);
            await axios.post(custom_webhook_url, alertPayload);
            results.push('Webhook sent');
            console.log('Webhook dispatched successfully.');
        } catch (err) {
            console.error('Webhook failed:', err.message);
            results.push(`Webhook failed: ${err.message}`);
        }
    }

    return results;
};
