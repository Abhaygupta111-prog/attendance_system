import { MongoClient, MongoClientOptions } from 'mongodb';

const dbName = process.env.DATABASE_NAME || 'face_attendance';

// Minimal options — remove tlsAllowInvalidCertificates for production
// MongoDB Atlas uses valid TLS certificates, no override needed
const options: MongoClientOptions = {};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  // Check URI lazily (only when a DB call is made, not at module import)
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set. Add it in Vercel → Project → Settings → Environment Variables.');
  }

  if (process.env.NODE_ENV === 'development') {
    // Reuse connection across hot reloads in dev
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  // Production: create once per serverless instance
  if (!clientPromise) {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getDb() {
  const c = await getClientPromise();
  return c.db(dbName);
}

export default getClientPromise;
