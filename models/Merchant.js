const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const Merchant = sequelize.define('Merchant', {
    merchant_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
    },
    access_token: {
        type: DataTypes.TEXT, // Token can be long
        allowNull: false
    },
    refresh_token: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    expires_in: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    alert_threshold: {
        type: DataTypes.INTEGER,
        defaultValue: 5
    },
    alert_email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    phone_number: {
        type: DataTypes.STRING,
        allowNull: true
    },
    notify_email: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    notify_sms: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    notify_whatsapp: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

module.exports = Merchant;
