// Wrapper to run seed-admin.mjs with proper env loading for Windows
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
}

// Set APP_URL for local
process.env.APP_URL = 'http://localhost:8787';

// Now import and run the actual seed script
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const name = process.env.ADMIN_NAME || 'Family Admin';
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!setupToken || !email || !password) {
  throw new Error('ADMIN_SETUP_TOKEN, ADMIN_EMAIL and ADMIN_PASSWORD are required.');
}

const response = await fetch(`${process.env.APP_URL}/api/setup/admin`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-admin-setup-token': setupToken,
  },
  body: JSON.stringify({ name, email, password }),
});

const payload = await response.json();
if (!response.ok) {
  throw new Error(`Admin seed failed (${response.status}): ${JSON.stringify(payload)}`);
}

console.log(`Admin user created: ${payload.email}`);
console.log(`Email: ${email}`);
console.log(`Password: [hidden]`);
