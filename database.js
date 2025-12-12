const { Sequelize } = require('sequelize');
const path = require('path');

let sequelize;

try {
  if (process.env.DATABASE_URL) {
    // Production (PostgreSQL)
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      protocol: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });
    console.log('Database Config: Using PostgreSQL');
  } else {
    // Development (SQLite)
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: path.join(__dirname, process.env.DB_STORAGE || 'database.sqlite'),
      logging: false
    });
    console.log('Database Config: Using SQLite');
  }
} catch (error) {
  console.error('Sequelize Initialization Error:', error);
}

module.exports = { sequelize };
