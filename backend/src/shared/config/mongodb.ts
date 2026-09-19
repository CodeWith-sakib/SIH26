import mongoose from 'mongoose';
import config from './index.js';

/**
 * MongoDB connection manager — mirroring api-monitoring-system pattern.
 */
const mongodb = {
  async connect(): Promise<void> {
    await mongoose.connect(config.mongo.uri);
    console.log(`MongoDB connected: ${config.mongo.uri}`);
  },

  async disconnect(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('MongoDB disconnected.');
    }
  },

  isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  },
};

export default mongodb;
