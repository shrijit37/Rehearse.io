import mongoose from "mongoose";
import { env } from "./env";



const MONGO_URI = env.MONGODB_URI;
export const connectDB = async (): Promise<void> => {
    try {

        const conn = await mongoose.connect(MONGO_URI);
        console.log(`Connected to MongoDB ${conn.connection.host}`);
    } catch (error: any) {
        console.error("Error connecting to MongoDB", error?.message);
        process.exit(1);
    }
}
