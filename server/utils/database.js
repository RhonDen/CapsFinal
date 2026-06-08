const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let memoryServer = null;

// Connect to the configured MongoDB instance and fall back to an in-memory database for local development.
async function connectDatabase(options = {}) {
  const {
    allowMemoryFallback = process.env.NODE_ENV !== 'production',
  } = options;

  const mongoUri = process.env.MONGODB_URI;
  const connectionOptions = {
    serverSelectionTimeoutMS: 5000,
  };

  try {
    await mongoose.connect(mongoUri, connectionOptions);

    return {
      mode: 'persistent',
      uri: mongoUri,
    };
  } catch (error) {
    if (!allowMemoryFallback) {
      throw error;
    }

    console.warn(
      'MongoDB is unavailable. Starting an in-memory MongoDB instance for local development.'
    );

    memoryServer = await MongoMemoryServer.create();
    const memoryUri = memoryServer.getUri();

    await mongoose.connect(memoryUri, connectionOptions);

    return {
      mode: 'memory',
      uri: memoryUri,
    };
  }
}

// Disconnect from Mongoose and stop the in-memory database when one was created.
async function disconnectDatabase() {
  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
};
