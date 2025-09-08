import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";


dotenv.config();
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 9000;

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/rehearse").then(() => {
    console.log("MongoDB connected");
}).catch((err) => {
    console.error("MongoDB connection error:", err);
});


//routes
app.use("/api/auth", authRoutes);

app.listen(PORT, ()=>{
    console.log(`Server running on ${PORT}`)
})


app.get("/test", (req, res)=> {
    res.json({
        message: "api working!!!!!!!!!!"
    })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});
