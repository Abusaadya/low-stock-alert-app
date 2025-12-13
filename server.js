require('dotenv').config();
const express = require('express');
const { sequelize } = require('./database');
const Merchant = require('./models/Merchant');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic Route
app.get('/', (req, res) => {
    res.send('Low Stock Alert App is Running! 🚀 <br> <a href="/oauth/login">Login with Salla</a> <br> <a href="/settings">Settings</a>');
});

// Settings Page (GET)
app.get('/settings', async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'views', 'settings.html');

    // In a real app, we would hydrate the HTML with values from DB if a merchant is logged in.
    // For now, serving static.
    res.sendFile(filePath);
});

// Save Settings (POST)
app.post('/settings', async (req, res) => {
    const { merchantId, alert_threshold, alert_email, phone_number, notify_email, notify_sms, notify_whatsapp } = req.body;

    // Security Note: In production, use a session/JWT token, don't trust merchantId from body blindly.
    // For MVP/Demo:
    try {
        if (!merchantId) {
            // If no ID passed, try to grab the last updated one just for demo convenience
            const lastMerchant = await Merchant.findOne({ order: [['updatedAt', 'DESC']] });
            if (lastMerchant) {
                await lastMerchant.update({
                    alert_threshold,
                    alert_email,
                    phone_number,
                    notify_email,
                    notify_sms,
                    notify_whatsapp
                });
                return res.send('Settings Updated for most recent merchant!');
            }
            return res.status(400).send('No Merchant ID provided');
        }

        const merchant = await Merchant.findByPk(merchantId);
        if (merchant) {
            await merchant.update({
                alert_threshold,
                alert_email,
                phone_number,
                notify_email,
                notify_sms,
                notify_whatsapp
            });
            res.send('Success');
        } else {
            res.status(404).send('Merchant not found');
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Manual DB Init for Vercel
app.get('/init-db', async (req, res) => {
    try {
        await sequelize.sync({ alter: true });
        res.send('Database synchronized successfully! Tables created.');
    } catch (error) {
        console.error('Sync Error:', error);
        res.status(500).send('Error syncing database: ' + error.message);
    }
});

// Test Email Route
app.get('/test-email', async (req, res) => {
    try {
        await emailService.sendLowStockAlert(
            process.env.EMAIL_USER,
            'TEST PRODUCT',
            0,
            5
        );
        res.send(`Test email sent to ${process.env.EMAIL_USER}. Check your inbox/spam.`);
    } catch (error) {
        res.status(500).send('Failed to send email: ' + error.message);
    }
});



app.get('/oauth/login', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
        client_id: process.env.SALLA_CLIENT_ID,
        response_type: 'code',
        redirect_uri: process.env.SALLA_CALLBACK_URL,
        scope: 'products.read webhooks.read_write offline_access',
        state: state
    });
    res.redirect(`${process.env.SALLA_AUTHORIZATION_URL}?${params.toString()}`);
});

const sallaAuth = require('./utils/sallaAuth');

// OAuth Callback
app.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('No code provided');
    }

    try {
        console.log(`[OAuth] Salla returned code: ${code}`);

        // 1. Exchange code for token
        const tokenData = await sallaAuth.getAccessToken(code);
        console.log('[OAuth] Access Token received');

        // 2. Get Merchant Info (to get the ID)
        const merchantInfo = await sallaAuth.getMerchantInfo(tokenData.access_token);
        console.log(`[OAuth] Merchant Info: ID=${merchantInfo.id}, Name=${merchantInfo.name}`);

        // 3. Save/Update in DB
        console.log('[OAuth] Attempting to upsert Merchant...');
        const [merchant, created] = await Merchant.upsert({
            merchant_id: merchantInfo.id,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
            // We don't overwrite alert settings if they exist, but upsert might overwrite. 
            // Sequelize upsert overwrites everything by default. 
            // Ideally we should check if exists, but for MVP upsert is fine, just careful about settings.
            // To preserve settings, we can findOne then update or create.
        });
        console.log(`[OAuth] Merchant upsert complete. Created? ${created}`);

        // Let's refine the DB save logic to preserve settings if exists
        // Actually upsert is fine if we only pass the token fields, but we defined all fields in model.
        // If we only pass tokens, other fields like alert_threshold will take default value if it's a NEW record,
        // or keep existing value? No, upsert updates the provided fields.
        // Let's use findOne and update/create manually for safety.

        let existingMerchant = await Merchant.findByPk(merchantInfo.id);
        const defaultEmail = process.env.EMAIL_USER; // Use admin email as default for testing
        console.log(`[OAuth] Updating email for merchant ${merchantInfo.id}...`);

        if (existingMerchant) {
            await existingMerchant.update({
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_in: tokenData.expires_in,
                alert_email: existingMerchant.alert_email || defaultEmail // Set if missing
            });
            console.log('[OAuth] Merchant updated successfully.');
        } else {
            console.log('[OAuth] Creating NEW Merchant record...');
            await Merchant.create({
                merchant_id: merchantInfo.id,
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_in: tokenData.expires_in,
                alert_email: defaultEmail // Default for new installs
            });
            console.log('[OAuth] New merchant created successfully.');
        }

        res.send(`<h1>Authorization Successful!</h1> <p>Welcome, ${merchantInfo.name}. Your App is installed.</p>`);

    } catch (error) {
        console.error('OAuth Error:', error);
        res.status(500).send(`
            <h1>Authentication Failed</h1>
            <p>Error: ${error.message}</p>
            <pre>${JSON.stringify(error.response?.data || {}, null, 2)}</pre>
            <p>Stack: ${error.stack}</p>
        `);
    }
});


const notificationService = require('./utils/notificationService');

// Webhook Listener
app.post('/webhooks/app-events', async (req, res) => {
    const { event, merchant, data } = req.body;

    console.log(`Received Webhook: ${event} for merchant ${merchant}`);

    if (event === 'product.updated') {
        const productId = data.id;
        const currentQuantity = data.quantity;
        const name = data.name;

        try {
            // Find merchant settings
            const merchantSettings = await Merchant.findByPk(merchant);

            if (merchantSettings) {
                const threshold = merchantSettings.alert_threshold;

                if (currentQuantity <= threshold) {
                    console.log(`Stock low for ${name} (${currentQuantity} <= ${threshold}). Sending alert...`);

                    // Use the new Multi-Channel Service
                    const results = await notificationService.sendLowStockAlert(
                        merchantSettings,
                        { name, currentQuantity, threshold }
                    );
                    console.log('Notification Results:', results);
                }
            } else {
                console.log(`No settings found for merchant ${merchant} or no email configured.`);
            }
        } catch (error) {
            console.error('Webhook processing error:', error);
        }
    }

    // Always return 200 OK to Salla
    res.status(200).send('Webhook Received');
});


// Debug Route: Check & Subscribe to Webhooks
app.get('/debug/webhooks', async (req, res) => {
    try {
        const merchants = await Merchant.findAll();
        if (!merchants || merchants.length === 0) return res.send('No merchants found in DB');

        // We will just use the first valid token for webhook checking, or iterate?
        // Let's just list them for now to debug the ID issue.
        const token = merchants[0].access_token; // Use the first one for API checks for now

        let logHtml = `<h1>Registered Merchants (${merchants.length})</h1>`;
        logHtml += '<ul>';
        merchants.forEach(m => {
            logHtml += `<li>ID: <b>${m.merchant_id}</b> | Email: ${m.alert_email || '<span style="color:red">NULL</span>'}</li>`;
        });
        logHtml += '</ul>';

        // ... rest of the logic usually needs a specific token. 
        // Let's keep the webhook check logic but just warn it uses the first token.
        const axios = require('axios');
        const webhookUrl = process.env.SALLA_CALLBACK_URL.replace('/oauth/callback', '/webhooks/app-events');

        // Events to subscribe
        const events = ['product.updated', 'product.created'];

        // 1. Subscribe to events
        for (const event of events) {
            try {
                await axios.post('https://api.salla.dev/admin/v2/webhooks/subscribe', {
                    name: 'Stock App Hook - ' + event,
                    event: event,
                    url: webhookUrl,
                    version: '2'
                }, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
                logHtml += `<p style="color:green">✅ Subscribed to <b>${event}</b></p>`;
            } catch (err) {
                logHtml += `<p style="color:red">❌ Failed to subscribe to <b>${event}</b>: ${err.response?.data?.error?.message || err.message}</p>`;
            }
        }

        // 2. List Active Webhooks
        try {
            const listRes = await axios.get('https://api.salla.dev/admin/v2/webhooks', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            logHtml += '<h3>Active Webhooks on Salla:</h3><pre>' + JSON.stringify(listRes.data.data, null, 2) + '</pre>';
        } catch (err) {
            logHtml += '<p>Could not list webhooks: ' + err.message + '</p>';
        }

        res.send(logHtml);

    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// Sync Database and Start Server
// Only listen if not running in production (Vercel manages the port)
if (require.main === module) {
    sequelize.sync().then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    }).catch(err => {
        console.error('Unable to connect to the database:', err);
    });
}

// Export for Vercel
module.exports = app;
