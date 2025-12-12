const axios = require('axios');

exports.getAccessToken = async (code) => {
    try {
        const response = await axios.post(process.env.SALLA_TOKEN_URL, new URLSearchParams({
            client_id: process.env.SALLA_CLIENT_ID,
            client_secret: process.env.SALLA_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.SALLA_CALLBACK_URL
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching access token:', error.response ? error.response.data : error.message);
        throw error;
    }
};

exports.refreshAccessToken = async (refreshToken) => {
    try {
        const response = await axios.post(process.env.SALLA_TOKEN_URL, new URLSearchParams({
            client_id: process.env.SALLA_CLIENT_ID,
            client_secret: process.env.SALLA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            redirect_uri: process.env.SALLA_CALLBACK_URL
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data;
    } catch (error) {
        console.error('Error refreshing access token:', error.response ? error.response.data : error.message);
        throw error;
    }
};

exports.getMerchantInfo = async (accessToken) => {
    try {
        const response = await axios.get('https://api.salla.dev/admin/v2/oauth2/user/info', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return response.data.data;
    } catch (error) {
        console.error('Error fetching merchant info:', error.response ? error.response.data : error.message);
        throw error;
    }
};
