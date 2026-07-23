import mongoose from "mongoose";
import { env } from "./env"

async function clearDatabase() {
    const uri = env.MONGODB_URI;
    try {
        // 1. Ensure you are connected to the database
        await mongoose.connect(uri);

        // 2. Drop the connected database
        await mongoose.connection?.db?.dropDatabase();
        console.log("Database cleared successfully.");

        // 3. Close the connection
        await mongoose.connection.close();
    } catch (error) {
        console.error("Error clearing database:", error);
    }
}

clearDatabase();
