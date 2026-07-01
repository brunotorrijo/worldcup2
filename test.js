require('dotenv').config();
const { query } = require('./db/database');
async function run() {
  const matches = await query("SELECT m.match_number, m.match_date, t1.name as home, t2.name as away FROM matches m JOIN teams t1 ON m.home_team_id = t1.id JOIN teams t2 ON m.away_team_id = t2.id ORDER BY m.match_number LIMIT 5;");
  console.log(matches);
}
run();
