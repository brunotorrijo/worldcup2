const { createClient } = require('@libsql/client');
const fs = require('fs');

const envFile = fs.readFileSync('.env.prod', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim().replace(/^"|"$/g, '');
});

const client = createClient({
  url: env.TURSO_URL,
  authToken: env.TURSO_AUTH_TOKEN
});

async function run() {
  console.log("Updating teams to match official mock draw...");
  const correctTeams = [
    // Group A
    {id: 1, name: "Mexico", code: "MEX", flag: "🇲🇽"},
    {id: 2, name: "South Africa", code: "RSA", flag: "🇿🇦"},
    {id: 3, name: "South Korea", code: "KOR", flag: "🇰🇷"},
    {id: 4, name: "Czechia", code: "CZE", flag: "🇨🇿"},
    // Group B
    {id: 5, name: "Canada", code: "CAN", flag: "🇨🇦"},
    {id: 6, name: "Bosnia & Herzegovina", code: "BIH", flag: "🇧🇦"},
    {id: 7, name: "Qatar", code: "QAT", flag: "🇶🇦"},
    {id: 8, name: "Switzerland", code: "SUI", flag: "🇨🇭"},
    // Group C
    {id: 9, name: "Brazil", code: "BRA", flag: "🇧🇷"},
    {id: 10, name: "Haiti", code: "HAI", flag: "🇭🇹"},
    {id: 11, name: "Morocco", code: "MAR", flag: "🇲🇦"},
    {id: 12, name: "Scotland", code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿"},
    // Group D
    {id: 13, name: "United States", code: "USA", flag: "🇺🇸"},
    {id: 14, name: "Paraguay", code: "PAR", flag: "🇵🇾"},
    {id: 15, name: "Australia", code: "AUS", flag: "🇦🇺"},
    {id: 16, name: "Türkiye", code: "TUR", flag: "🇹🇷"},
    // Group E
    {id: 17, name: "Germany", code: "GER", flag: "🇩🇪"},
    {id: 18, name: "Curaçao", code: "CUW", flag: "🇨🇼"},
    {id: 19, name: "Côte d'Ivoire", code: "CIV", flag: "🇨🇮"},
    {id: 20, name: "Ecuador", code: "ECU", flag: "🇪🇨"},
    // Group F
    {id: 21, name: "Japan", code: "JPN", flag: "🇯🇵"},
    {id: 22, name: "Netherlands", code: "NED", flag: "🇳🇱"},
    {id: 23, name: "Sweden", code: "SWE", flag: "🇸🇪"},
    {id: 24, name: "Tunisia", code: "TUN", flag: "🇹🇳"},
    // Group G
    {id: 25, name: "Belgium", code: "BEL", flag: "🇧🇪"},
    {id: 26, name: "Egypt", code: "EGY", flag: "🇪🇬"},
    {id: 27, name: "Iran", code: "IRN", flag: "🇮🇷"},
    {id: 28, name: "New Zealand", code: "NZL", flag: "🇳🇿"},
    // Group H
    {id: 29, name: "Cape Verde", code: "CPV", flag: "🇨🇻"},
    {id: 30, name: "Saudi Arabia", code: "KSA", flag: "🇸🇦"},
    {id: 31, name: "Spain", code: "ESP", flag: "🇪🇸"},
    {id: 32, name: "Uruguay", code: "URU", flag: "🇺🇾"},
    // Group I
    {id: 33, name: "France", code: "FRA", flag: "🇫🇷"},
    {id: 34, name: "Iraq", code: "IRQ", flag: "🇮🇶"},
    {id: 35, name: "Norway", code: "NOR", flag: "🇳🇴"},
    {id: 36, name: "Senegal", code: "SEN", flag: "🇸🇳"},
    // Group J
    {id: 37, name: "Algeria", code: "ALG", flag: "🇩🇿"},
    {id: 38, name: "Argentina", code: "ARG", flag: "🇦🇷"},
    {id: 39, name: "Austria", code: "AUT", flag: "🇦🇹"},
    {id: 40, name: "Jordan", code: "JOR", flag: "🇯🇴"},
    // Group K
    {id: 41, name: "Colombia", code: 'COL', flag: '🇨🇴'},
    {id: 42, name: "DR Congo", code: 'COD', flag: '🇨🇩'},
    {id: 43, name: "Portugal", code: 'POR', flag: '🇵🇹'},
    {id: 44, name: "Uzbekistan", code: 'UZB', flag: '🇺🇿'},
    // Group L
    {id: 45, name: "Croatia", code: 'CRO', flag: '🇭🇷'},
    {id: 46, name: "England", code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
    {id: 47, name: "Ghana", code: 'GHA', flag: '🇬🇭'},
    {id: 48, name: "Panama", code: 'PAN', flag: '🇵🇦'}
  ];

  const transaction = [];
  for (const t of correctTeams) {
    transaction.push({
      sql: "UPDATE teams SET name = ?, code = ?, flag_emoji = ? WHERE id = ?",
      args: [t.name, t.code, t.flag, t.id]
    });
  }

  // Update matches to have CEST times
  console.log("Updating match times to Amsterdam time (CEST)...");
  
  const matchesRes = await client.execute("SELECT id, match_date, match_number FROM matches");
  const times = ['15:00:00+02:00', '18:00:00+02:00', '21:00:00+02:00', '00:00:00+02:00'];
  
  for (const m of matchesRes.rows) {
    let newDate = m.match_date;
    if (newDate && !newDate.includes('T')) {
      if (m.match_number === 1) {
        // Mexico vs South Africa at 3PM ET = 9PM CEST
        newDate = newDate + 'T21:00:00+02:00';
      } else if (m.match_number === 2) {
        // South Korea vs Czechia at 10PM ET = 4AM CEST (next day)
        newDate = '2026-06-12T04:00:00+02:00';
      } else {
        const tIndex = (m.id % 4);
        newDate = newDate + 'T' + times[tIndex];
      }
      transaction.push({
        sql: "UPDATE matches SET match_date = ? WHERE id = ?",
        args: [newDate, m.id]
      });
    }
  }

  await client.batch(transaction);
  console.log("Successfully updated teams and matches without deleting predictions!");
}
run().catch(console.error);
