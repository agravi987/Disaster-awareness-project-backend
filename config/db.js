/**
 * config/db.js - MongoDB Database Connection
 * 
 * Uses Mongoose to connect to a MongoDB instance.
 * The connection string is loaded from the .env file (MONGO_URI).
 * If the connection fails, the process exits with an error.
 */

const mongoose = require('mongoose');

/**
 * connectDB - Establishes a connection to MongoDB using Mongoose.
 * This function is called once at application startup (in server.js).
 */
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        // Exit the process if we can't connect to the database
        process.exit(1);
    }
};

module.exports = connectDB;
