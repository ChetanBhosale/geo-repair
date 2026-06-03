
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

const isProd = process.env.NODE_ENV === 'production';

const JWT_SECRET = process.env.JWT_SECRET;

if (isProd && (!JWT_SECRET || JWT_SECRET.length < 16)) {
  throw new Error(
    'JWT_SECRET must be set to a strong value in production (>= 16 chars).'
  );
}

const BackendSecrets = {
    PORT : process.env.PORT || 4000
};

export default BackendSecrets;