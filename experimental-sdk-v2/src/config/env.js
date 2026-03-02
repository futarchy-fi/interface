import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const ENV = {
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    RPC_URL: process.env.RPC_URL || 'https://rpc.gnosischain.com'
};
