const { createClient } = require('@libsql/client');
const fs = require('fs');

const envFile = fs.readFileSync('.env.production', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...vParts] = line.split('=');
  const v = vParts.join('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^"|"$/g, '');
});

const client = createClient({
  url: env.TURSO_URL,
  authToken: env.TURSO_AUTH_TOKEN
});

async function run() {
  const res = await client.execute("SELECT * FROM matches WHERE match_number IN (89, 90)");
  console.log(res.rows);
}

run().catch(console.error);
