-- Seed all 48 World Cup 2026 teams
-- Group A
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Mexico', 'MEX', 'A', '🇲🇽');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('South Korea', 'KOR', 'A', '🇰🇷');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('South Africa', 'RSA', 'A', '🇿🇦');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Czechia', 'CZE', 'A', '🇨🇿');

-- Group B
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Canada', 'CAN', 'B', '🇨🇦');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Switzerland', 'SUI', 'B', '🇨🇭');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Qatar', 'QAT', 'B', '🇶🇦');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Bosnia & Herzegovina', 'BIH', 'B', '🇧🇦');

-- Group C
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Brazil', 'BRA', 'C', '🇧🇷');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Morocco', 'MAR', 'C', '🇲🇦');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Scotland', 'SCO', 'C', '🏴󠁧󠁢󠁳󠁣󠁴󠁿');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Haiti', 'HAI', 'C', '🇭🇹');

-- Group D
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('United States', 'USA', 'D', '🇺🇸');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Paraguay', 'PAR', 'D', '🇵🇾');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Australia', 'AUS', 'D', '🇦🇺');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Türkiye', 'TUR', 'D', '🇹🇷');

-- Group E
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Germany', 'GER', 'E', '🇩🇪');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Ecuador', 'ECU', 'E', '🇪🇨');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Côte d''Ivoire', 'CIV', 'E', '🇨🇮');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Curaçao', 'CUW', 'E', '🇨🇼');

-- Group F
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Netherlands', 'NED', 'F', '🇳🇱');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Japan', 'JPN', 'F', '🇯🇵');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Tunisia', 'TUN', 'F', '🇹🇳');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Sweden', 'SWE', 'F', '🇸🇪');

-- Group G
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Belgium', 'BEL', 'G', '🇧🇪');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Iran', 'IRN', 'G', '🇮🇷');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Egypt', 'EGY', 'G', '🇪🇬');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('New Zealand', 'NZL', 'G', '🇳🇿');

-- Group H
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Spain', 'ESP', 'H', '🇪🇸');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Uruguay', 'URU', 'H', '🇺🇾');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Saudi Arabia', 'KSA', 'H', '🇸🇦');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Cape Verde', 'CPV', 'H', '🇨🇻');

-- Group I
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('France', 'FRA', 'I', '🇫🇷');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Senegal', 'SEN', 'I', '🇸🇳');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Norway', 'NOR', 'I', '🇳🇴');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Iraq', 'IRQ', 'I', '🇮🇶');

-- Group J
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Argentina', 'ARG', 'J', '🇦🇷');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Austria', 'AUT', 'J', '🇦🇹');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Algeria', 'ALG', 'J', '🇩🇿');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Jordan', 'JOR', 'J', '🇯🇴');

-- Group K
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Portugal', 'POR', 'K', '🇵🇹');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Colombia', 'COL', 'K', '🇨🇴');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Uzbekistan', 'UZB', 'K', '🇺🇿');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('DR Congo', 'COD', 'K', '🇨🇩');

-- Group L
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('England', 'ENG', 'L', '🏴󠁧󠁢󠁥󠁮󠁧󠁿');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Croatia', 'CRO', 'L', '🇭🇷');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Panama', 'PAN', 'L', '🇵🇦');
INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES ('Ghana', 'GHA', 'L', '🇬🇭');

-- Group Stage Matches (72 total, 6 per group)
-- Group A (teams 1-4): MEX, KOR, RSA, CZE
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'A', 1, 2, 1, '2026-06-11');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'A', 3, 4, 2, '2026-06-11');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'A', 1, 3, 3, '2026-06-15');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'A', 2, 4, 4, '2026-06-15');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'A', 1, 4, 5, '2026-06-19');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'A', 2, 3, 6, '2026-06-19');

-- Group B (teams 5-8): CAN, SUI, QAT, BIH
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'B', 5, 6, 7, '2026-06-11');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'B', 7, 8, 8, '2026-06-11');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'B', 5, 7, 9, '2026-06-15');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'B', 6, 8, 10, '2026-06-15');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'B', 5, 8, 11, '2026-06-19');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'B', 6, 7, 12, '2026-06-19');

-- Group C (teams 9-12): BRA, MAR, SCO, HAI
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'C', 9, 10, 13, '2026-06-12');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'C', 11, 12, 14, '2026-06-12');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'C', 9, 11, 15, '2026-06-16');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'C', 10, 12, 16, '2026-06-16');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'C', 9, 12, 17, '2026-06-20');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'C', 10, 11, 18, '2026-06-20');

-- Group D (teams 13-16): USA, PAR, AUS, TUR
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'D', 13, 14, 19, '2026-06-12');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'D', 15, 16, 20, '2026-06-12');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'D', 13, 15, 21, '2026-06-16');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'D', 14, 16, 22, '2026-06-16');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'D', 13, 16, 23, '2026-06-20');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'D', 14, 15, 24, '2026-06-20');

-- Group E (teams 17-20): GER, ECU, CIV, CUW
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'E', 17, 18, 25, '2026-06-13');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'E', 19, 20, 26, '2026-06-13');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'E', 17, 19, 27, '2026-06-17');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'E', 18, 20, 28, '2026-06-17');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'E', 17, 20, 29, '2026-06-21');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'E', 18, 19, 30, '2026-06-21');

-- Group F (teams 21-24): NED, JPN, TUN, SWE
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'F', 21, 22, 31, '2026-06-13');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'F', 23, 24, 32, '2026-06-13');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'F', 21, 23, 33, '2026-06-17');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'F', 22, 24, 34, '2026-06-17');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'F', 21, 24, 35, '2026-06-21');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'F', 22, 23, 36, '2026-06-21');

-- Group G (teams 25-28): BEL, IRN, EGY, NZL
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'G', 25, 26, 37, '2026-06-14');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'G', 27, 28, 38, '2026-06-14');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'G', 25, 27, 39, '2026-06-18');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'G', 26, 28, 40, '2026-06-18');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'G', 25, 28, 41, '2026-06-22');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'G', 26, 27, 42, '2026-06-22');

-- Group H (teams 29-32): ESP, URU, KSA, CPV
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'H', 29, 30, 43, '2026-06-14');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'H', 31, 32, 44, '2026-06-14');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'H', 29, 31, 45, '2026-06-18');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'H', 30, 32, 46, '2026-06-18');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'H', 29, 32, 47, '2026-06-22');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'H', 30, 31, 48, '2026-06-22');

-- Group I (teams 33-36): FRA, SEN, NOR, IRQ
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'I', 33, 34, 49, '2026-06-12');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'I', 35, 36, 50, '2026-06-12');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'I', 33, 35, 51, '2026-06-16');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'I', 34, 36, 52, '2026-06-16');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'I', 33, 36, 53, '2026-06-20');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'I', 34, 35, 54, '2026-06-20');

-- Group J (teams 37-40): ARG, AUT, ALG, JOR
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'J', 37, 38, 55, '2026-06-13');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'J', 39, 40, 56, '2026-06-13');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'J', 37, 39, 57, '2026-06-17');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'J', 38, 40, 58, '2026-06-17');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'J', 37, 40, 59, '2026-06-21');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'J', 38, 39, 60, '2026-06-21');

-- Group K (teams 41-44): POR, COL, UZB, COD
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'K', 41, 42, 61, '2026-06-14');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'K', 43, 44, 62, '2026-06-14');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'K', 41, 43, 63, '2026-06-18');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'K', 42, 44, 64, '2026-06-18');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'K', 41, 44, 65, '2026-06-22');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'K', 42, 43, 66, '2026-06-22');

-- Group L (teams 45-48): ENG, CRO, PAN, GHA
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'L', 45, 46, 67, '2026-06-11');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'L', 47, 48, 68, '2026-06-11');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'L', 45, 47, 69, '2026-06-15');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'L', 46, 48, 70, '2026-06-15');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'L', 45, 48, 71, '2026-06-19');
INSERT INTO matches (stage, group_letter, home_team_id, away_team_id, match_number, match_date) VALUES ('group', 'L', 46, 47, 72, '2026-06-19');

-- Knockout Stage Placeholder Matches
-- Round of 32 (16 matches)
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 73, '2026-06-28', 'R32_1');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 74, '2026-06-28', 'R32_2');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 75, '2026-06-28', 'R32_3');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 76, '2026-06-28', 'R32_4');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 77, '2026-06-29', 'R32_5');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 78, '2026-06-29', 'R32_6');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 79, '2026-06-29', 'R32_7');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 80, '2026-06-29', 'R32_8');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 81, '2026-06-30', 'R32_9');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 82, '2026-06-30', 'R32_10');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 83, '2026-06-30', 'R32_11');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 84, '2026-06-30', 'R32_12');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 85, '2026-07-01', 'R32_13');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 86, '2026-07-01', 'R32_14');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 87, '2026-07-01', 'R32_15');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R32', 88, '2026-07-01', 'R32_16');

-- Round of 16 (8 matches)
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R16', 89, '2026-07-04', 'R16_1');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R16', 90, '2026-07-04', 'R16_2');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R16', 91, '2026-07-05', 'R16_3');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R16', 92, '2026-07-05', 'R16_4');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R16', 93, '2026-07-06', 'R16_5');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R16', 94, '2026-07-06', 'R16_6');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R16', 95, '2026-07-07', 'R16_7');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('R16', 96, '2026-07-07', 'R16_8');

-- Quarter-finals (4 matches)
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('QF', 97, '2026-07-10', 'QF_1');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('QF', 98, '2026-07-10', 'QF_2');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('QF', 99, '2026-07-11', 'QF_3');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('QF', 100, '2026-07-11', 'QF_4');

-- Semi-finals (2 matches)
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('SF', 101, '2026-07-14', 'SF_1');
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('SF', 102, '2026-07-15', 'SF_2');

-- Third-place match
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('3RD', 103, '2026-07-18', '3RD');

-- Final
INSERT INTO matches (stage, match_number, match_date, bracket_position) VALUES ('FINAL', 104, '2026-07-19', 'FINAL');
