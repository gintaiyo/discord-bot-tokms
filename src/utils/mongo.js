const mongoose = require("mongoose");
const config = require("../../config.json");

/**
 * Connect to MongoDB
 */
async function connectMongo() {
    if (!config.mongoURI) {
        console.error("❌ MongoDB URI is missing in config.json");
        return;
    }

    try {
        await mongoose.connect(config.mongoURI, {
            // Optional but useful:
            serverSelectionTimeoutMS: 5000, // Fail fast if can't connect
        });

        console.log("✅ Connected to MongoDB!");
    } catch (err) {
        console.error("❌ Failed to connect to MongoDB:");
        console.error(err);
        process.exit(1);
    }
}

module.exports = { connectMongo };
