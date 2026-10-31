import mongoose from 'mongoose';

export async function connectDB(customDbName = null) {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voltix';
    const dbName = customDbName || (process.env.NODE_ENV === 'test' ? 'e-commerce-test' : undefined);
    const options = {
      serverSelectionTimeoutMS: 5000,
    };
    if (dbName) {
      options.dbName = dbName;
    }
    const conn = await mongoose.connect(uri, options);
    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error(`[MongoDB] Connection error: ${err.message}`);
    throw err;
  }
}

