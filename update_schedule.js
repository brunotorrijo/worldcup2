const { createClient } = require('@libsql/client');
const fs = require('fs');

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

const teamNameMap = {
  "Czech Republic": "Czechia",
  "USA": "United States",
  "Curacao": "Curaçao",
  "Ivory Coast": "Côte d'Ivoire",
  "Turkey": "Türkiye"
};

function parseTimeToISO(dateStr, timeStr) {
  // dateStr: "Thursday, June 11"
  // timeStr: "8pm" or "1.30am" or "12.30am"
  const monthDay = dateStr.split(', ')[1]; // "June 11"
  let [time, ampm] = [timeStr.slice(0, -2), timeStr.slice(-2)];
  let hour = parseInt(time.split('.')[0]);
  let minute = time.split('.')[1] || "00";
  
  if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12;
  if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
  
  const hourStr = hour.toString().padStart(2, '0');
  const minStr = minute.toString().padStart(2, '0');
  
  // Create ISO string for UK time (UTC+1 in summer)
  return `2026-${monthDay.replace('June ', '06-').replace('July ', '07-').replace(/(\d)$/, '0$1').replace(/-0(\d{2})/, '-$1')}T${hourStr}:${minStr}:00+01:00`;
}

async function run() {
  const teamsRes = await client.execute("SELECT id, name FROM teams");
  const dbTeams = {};
  for (const t of teamsRes.rows) {
    dbTeams[t.name.toLowerCase()] = t.id;
  }

  const getTeamId = (name) => {
    let searchName = name.trim();
    if (teamNameMap[searchName]) searchName = teamNameMap[searchName];
    const id = dbTeams[searchName.toLowerCase()];
    if (!id) console.warn("WARNING: Team not found:", searchName);
    return id;
  };

  const lines = fs.readFileSync('schedule.txt', 'utf8').split('\n');
  const transaction = [];
  let currentDate = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check if it's a date header
    if (/^[A-Za-z]+, [A-Za-z]+ \d+/.test(trimmed)) {
      currentDate = trimmed;
      continue;
    }

    // Parse group stage match
    const groupMatch = trimmed.match(/^Group [A-L]: (.*) vs (.*), kick-off (.*?) - (.*)$/);
    if (groupMatch) {
      const home = groupMatch[1];
      const away = groupMatch[2];
      const timeStr = groupMatch[3];
      
      const homeId = getTeamId(home);
      const awayId = getTeamId(away);
      const isoDate = parseTimeToISO(currentDate, timeStr);

      if (homeId && awayId) {
        transaction.push({
          sql: "UPDATE matches SET match_date = ? WHERE stage = 'group' AND ((home_team_id = ? AND away_team_id = ?) OR (home_team_id = ? AND away_team_id = ?))",
          args: [isoDate, homeId, awayId, awayId, homeId]
        });
      }
      continue;
    }

    // Parse knockout stage match
    const knockoutMatch = trimmed.match(/^(Round of 32|Round of 16|Quarter-final|Semi-final|Third Place Playoff|Final) - Match (\d+): (.*) vs (.*), kick-off (.*?) - (.*)$/);
    if (knockoutMatch) {
      const matchNum = parseInt(knockoutMatch[2]);
      const timeStr = knockoutMatch[5];
      const isoDate = parseTimeToISO(currentDate, timeStr);
      
      transaction.push({
        sql: "UPDATE matches SET match_date = ? WHERE match_number = ?",
        args: [isoDate, matchNum]
      });
      continue;
    }
  }

  console.log(`Executing ${transaction.length} update statements...`);
  await client.batch(transaction);
  console.log("Database updated successfully!");
}

run().catch(console.error);
