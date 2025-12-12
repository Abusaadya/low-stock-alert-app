require('dotenv').config();
const express = require('express');
const { sequelize } = require('./database');
const Merchant = require('./models/Merchant');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic Route
app.get('/', (req, res) => {
    res.send('Low Stock Alert App is Running! 🚀 <br> <a href="/oauth/login">Login with Salla</a>');
});

// OAuth Login
app.get('/oauth/login', (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.SALLA_CLIENT_ID,
        response_type: 'code',
        redirect_uri: process.env.SALLA_CALLBACK_URL,
        scope: 'products.read offline_access' // Added scopes
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
        // 1. Exchange code for token
        const tokenData = await sallaAuth.getAccessToken(code);

        // 2. Get Merchant Info (to get the ID)
        const merchantInfo = await sallaAuth.getMerchantInfo(tokenData.access_token);

        // 3. Save/Update in DB
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

        // Let's refine the DB save logic to preserve settings if exists
        // Actually upsert is fine if we only pass the token fields, but we defined all fields in model.
        // If we only pass tokens, other fields like alert_threshold will take default value if it's a NEW record,
        // or keep existing value? No, upsert updates the provided fields.
        // Let's use findOne and update/create manually for safety.

        let existingMerchant = await Merchant.findByPk(merchantInfo.id);
        if (existingMerchant) {
            await existingMerchant.update({
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_in: tokenData.expires_in
            });
        } else {
            await Merchant.create({
                merchant_id: merchantInfo.id,
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_in: tokenData.expires_in
            });
        }

        res.send(`<h1>Authorization Successful!</h1> <p>Welcome, ${merchantInfo.name}. Your App is installed.</p>`);

    } catch (error) {
        console.error('OAuth Error:', error);
        res.status(500).send('Authentication failed');
    }
});


const emailService = require('./utils/emailService');

// Webhook Listener
app.post('/webhooks/app-events', async (req, res) => {
    const { event, merchant, data } = req.body;

    console.log(`Received Webhook: ${event} for merchant ${merchant}`);

    if (event === 'product.updated') {
        const productId = data.id;
        const quantity = data.quantity;
        const productName = data.name; // Assuming 'name' is in the payload

        try {
            // Find merchant settings
            const merchantSettings = await Merchant.findByPk(merchant);

            if (merchantSettings && merchantSettings.alert_email) {
                const threshold = merchantSettings.alert_threshold;

                if (quantity <= threshold) {
                    console.log(`Stock low for ${productName} (${quantity} <= ${threshold}). Sending alert...`);
                    await emailService.sendLowStockAlert(
                        merchantSettings.alert_email,
                        productName,
                        quantity,
                        threshold
                    );
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


// Sync Database and Start Server
sequelize.sync().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
