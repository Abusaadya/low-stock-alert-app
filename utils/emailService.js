const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE, // e.g., 'gmail'
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendLowStockAlert = async (toEmail, productName, currentQuantity, threshold) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: `⚠️ Low Stock Alert: ${productName}`,
        html: `
            <h2>Low Stock Warning</h2>
            <p>The product <strong>${productName}</strong> is running low on stock.</p>
            <ul>
                <li>Current Quantity: <strong>${currentQuantity}</strong></li>
                <li>Alert Threshold: <strong>${threshold}</strong></li>
            </ul>
            <p>Please restock soon!</p>
        `
    };

    try {
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail(mailOptions);
            console.log(`Email sent to ${toEmail} for product ${productName}`);
        } else {
            console.log('Skipping Email Sending (No Credentials provided). Here is the email content:');
            console.log(mailOptions.subject, mailOptions.html);
        }
    } catch (error) {
        console.error('Error sending email:', error);
    }
};
