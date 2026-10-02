const mongoose = require('mongoose');

let isConnecting = false;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (isConnecting) {
    return false;
  }

  try {
    isConnecting = true;
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aiet_exam_db';
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 5000,
      bufferCommands: false // Fail fast if DB disconnected so serverless fallback works immediately
    });
    isConnecting = false;
    console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);
    return true;
  } catch (error) {
    isConnecting = false;
    console.warn(`⚠️ MongoDB Connection Warning: ${error.message} (Using local master JSON fallback)`);
    return false;
  }
};

module.exports = connectDB;
