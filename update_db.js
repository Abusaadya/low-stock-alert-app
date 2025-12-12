require('dotenv').config();
const { sequelize } = require('./database');
const Merchant = require('./models/Merchant');

async function update() {
    try {
        await sequelize.authenticate();
        // Update all merchants to have the sender email as the alert email for testing
        await Merchant.update({ alert_email: process.env.EMAIL_USER }, { where: {} });
        console.log(`Updated merchants with alert_email: ${process.env.EMAIL_USER}`);
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

update();
