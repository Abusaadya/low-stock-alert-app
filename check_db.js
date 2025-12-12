const { sequelize } = require('./database');
const Merchant = require('./models/Merchant');

async function check() {
    try {
        await sequelize.authenticate();
        const merchants = await Merchant.findAll();
        console.log('--- Registered Merchants ---');
        merchants.forEach(m => {
            console.log(`ID: ${m.merchant_id} | Email: ${m.alert_email || 'Not set'} | Threshold: ${m.alert_threshold}`);
        });
        console.log('----------------------------');
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

check();
