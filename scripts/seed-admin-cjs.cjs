// seed-admin-cjs.cjs - CommonJS version for Windows compatibility
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex > 0) {
    const key = trimmed.substring(0, eqIndex);
    const value = trimmed.substring(eqIndex + 1);
    process.env[key] = value;
  }
}

// Set APP_URL for local
process.env.APP_URL = 'http://localhost:8787';

const setupToken = process.env.ADMIN_SETUP_TOKEN;
const name = process.env.ADMIN_NAME || 'Family Admin';
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!setupToken || !email || !password) {
  console.error('Missing required env vars:');
  console.error('- ADMIN_SETUP_TOKEN:', setupToken ? 'OK' : 'MISSING');
  console.error('- ADMIN_EMAIL:', email ? 'OK' : 'MISSING');
  console.error('- ADMIN_PASSWORD:', password ? 'OK' : 'MISSING');
  process.exit(1);
}

async function main() {
  console.log(`Creating admin user: ${email}`);
  
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

  console.log('Admin user created successfully!');
  console.log(`Email: ${email}`);
  console.log(`Password: [hidden]`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
