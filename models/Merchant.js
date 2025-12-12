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
    }
});

module.exports = Merchant;
