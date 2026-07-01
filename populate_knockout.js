/**
 * Populate the Round of 32 knockout bracket with qualified teams.
 * Based on the official FIFA 2026 World Cup bracket.
 *
 * Run: node --env-file=.env.prod populate_knockout.js
 */
const { createClient } = require('@libsql/client');
const fs = require('fs');

// Read env from .env.prod
const envFile = fs.readFileSync('.env.prod', 'utf8');
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

// R32 bracket matchups (match_number → [home_team_code, away_team_code])
// Mapped from the official FIFA bracket image
const R32_MATCHUPS = {
  73: ['RSA', 'CAN'],   // South Africa vs Canada
  74: ['GER', 'PAR'],   // Germany vs Paraguay
  75: ['NED', 'MAR'],   // Netherlands vs Morocco
  76: ['BRA', 'JPN'],   // Brazil vs Japan
  77: ['FRA', 'SWE'],   // France vs Sweden
  78: ['CIV', 'NOR'],   // Côte d'Ivoire vs Norway
  79: ['MEX', 'ECU'],   // Mexico vs Ecuador
  80: ['ENG', 'COD'],   // England vs DR Congo
  81: ['BEL', 'SEN'],   // Belgium vs Senegal
  82: ['USA', 'BIH'],   // United States vs Bosnia & Herzegovina
  83: ['ESP', 'AUT'],   // Spain vs Austria
  84: ['POR', 'CRO'],   // Portugal vs Croatia
  85: ['SUI', 'ALG'],   // Switzerland vs Algeria
  86: ['ARG', 'CPV'],   // Argentina vs Cape Verde
  87: ['COL', 'GHA'],   // Colombia vs Ghana
  88: ['AUS', 'EGY'],   // Australia vs Egypt
};

async function run() {
  // Look up all teams by code
  const teamsRes = await client.execute('SELECT id, name, code FROM teams');
  const teamsByCode = {};
  for (const t of teamsRes.rows) {
    teamsByCode[t.code] = { id: t.id, name: t.name };
  }

  const updates = [];

  for (const [matchNum, [homeCode, awayCode]] of Object.entries(R32_MATCHUPS)) {
    const home = teamsByCode[homeCode];
    const away = teamsByCode[awayCode];

    if (!home) { console.error(`❌ Team not found: ${homeCode}`); continue; }
    if (!away) { console.error(`❌ Team not found: ${awayCode}`); continue; }

    console.log(`  Match ${matchNum}: ${home.name} (${homeCode}) vs ${away.name} (${awayCode})`);
    updates.push({
      sql: 'UPDATE matches SET home_team_id = ?, away_team_id = ? WHERE match_number = ?',
      args: [home.id, away.id, parseInt(matchNum)]
    });
  }

  if (updates.length > 0) {
    await client.batch(updates, 'write');
    console.log(`\n✅ Updated ${updates.length} R32 matches with team assignments!`);
  } else {
    console.log('\n⚠️  No updates to make.');
  }

  // Verify
  const verify = await client.execute(
    `SELECT m.match_number, m.bracket_position, t1.code as home, t2.code as away
     FROM matches m
     LEFT JOIN teams t1 ON m.home_team_id = t1.id
     LEFT JOIN teams t2 ON m.away_team_id = t2.id
     WHERE m.stage = 'R32'
     ORDER BY m.match_number`
  );
  console.log('\n📋 Current R32 bracket:');
  for (const row of verify.rows) {
    console.log(`  Match ${row.match_number} (${row.bracket_position}): ${row.home || 'TBD'} vs ${row.away || 'TBD'}`);
  }
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
