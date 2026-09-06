const appUrl = process.env.APP_URL || 'http://localhost:3000';
const setupToken = process.env.ADMIN_SETUP_TOKEN;
const name = process.env.ADMIN_NAME || 'Family Admin';
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!setupToken || !email || !password) {
  throw new Error('ADMIN_SETUP_TOKEN, ADMIN_EMAIL and ADMIN_PASSWORD are required.');
}

const response = await fetch(`${appUrl}/api/setup/admin`, {
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