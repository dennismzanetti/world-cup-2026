// 2026 FIFA World Cup Groups & Teams
// Official draw results - December 5, 2025
// Source: FIFA / ESPN
const WC_GROUPS = [
  { id: 'A', teams: [
    {name:'Mexico',        flag:'🇲🇽'},
    {name:'South Africa',  flag:'🇿🇦'},
    {name:'South Korea',   flag:'🇰🇷'},
    {name:'Czechia',       flag:'🇨🇿'}
  ]},
  { id: 'B', teams: [
    {name:'Canada',        flag:'🇨🇦'},
    {name:'Bosnia-Herzegovina', flag:'🇧🇦'},
    {name:'Qatar',         flag:'🇶🇦'},
    {name:'Switzerland',   flag:'🇨🇭'}
  ]},
  { id: 'C', teams: [
    {name:'Brazil',        flag:'🇧🇷'},
    {name:'Morocco',       flag:'🇲🇦'},
    {name:'Haiti',         flag:'🇭🇹'},
    {name:'Scotland',      flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿'}
  ]},
  { id: 'D', teams: [
    {name:'USA',           flag:'🇺🇸'},
    {name:'Paraguay',      flag:'🇵🇾'},
    {name:'Australia',     flag:'🇦🇺'},
    {name:'Türkiye',       flag:'🇹🇷'}
  ]},
  { id: 'E', teams: [
    {name:'Germany',       flag:'🇩🇪'},
    {name:'Curaçao',       flag:'🇨🇼'},
    {name:'Ivory Coast',   flag:'🇨🇮'},
    {name:'Ecuador',       flag:'🇪🇨'}
  ]},
  { id: 'F', teams: [
    {name:'Netherlands',   flag:'🇳🇱'},
    {name:'Japan',         flag:'🇯🇵'},
    {name:'Sweden',        flag:'🇸🇪'},
    {name:'Tunisia',       flag:'🇹🇳'}
  ]},
  { id: 'G', teams: [
    {name:'Belgium',       flag:'🇧🇪'},
    {name:'Egypt',         flag:'🇪🇬'},
    {name:'Iran',          flag:'🇮🇷'},
    {name:'New Zealand',   flag:'🇳🇿'}
  ]},
  { id: 'H', teams: [
    {name:'Spain',         flag:'🇪🇸'},
    {name:'Cape Verde',    flag:'🇨🇻'},
    {name:'Saudi Arabia',  flag:'🇸🇦'},
    {name:'Uruguay',       flag:'🇺🇾'}
  ]},
  { id: 'I', teams: [
    {name:'France',        flag:'🇫🇷'},
    {name:'Senegal',       flag:'🇸🇳'},
    {name:'Iraq',          flag:'🇮🇶'},
    {name:'Norway',        flag:'🇳🇴'}
  ]},
  { id: 'J', teams: [
    {name:'Argentina',     flag:'🇦🇷'},
    {name:'Algeria',       flag:'🇩🇿'},
    {name:'Austria',       flag:'🇦🇹'},
    {name:'Jordan',        flag:'🇯🇴'}
  ]},
  { id: 'K', teams: [
    {name:'Portugal',      flag:'🇵🇹'},
    {name:'Congo DR',      flag:'🇨🇩'},
    {name:'Uzbekistan',    flag:'🇺🇿'},
    {name:'Colombia',      flag:'🇨🇴'}
  ]},
  { id: 'L', teams: [
    {name:'England',       flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
    {name:'Croatia',       flag:'🇭🇷'},
    {name:'Ghana',         flag:'🇬🇭'},
    {name:'Panama',        flag:'🇵🇦'}
  ]},
];

// Broadcast info lookup by venue city (simplified)
const WC_BROADCAST = {
  default: { tvEnglish: ['FOX / FS1'], tvSpanish: ['Telemundo / Universo'], streaming: ['FOX One', 'Peacock'] }
};

// Known fixture metadata keyed by "homeTeam|awayTeam"
// Date format: YYYY-MM-DD, timeLocal: HH:MM, timezone label for display
const WC_FIXTURE_META = {
  'Mexico|South Africa':         { date:'2026-06-11', timeLocal:'21:00', tz:'CT',  venue:'Estadio Azteca',           city:'Mexico City, Mexico',           tvEnglish:['FOX'],  tvSpanish:['Telemundo'] },
  'South Korea|Czechia':         { date:'2026-06-11', timeLocal:'18:00', tz:'CT',  venue:'Estadio Akron',            city:'Zapopan (Guadalajara), Mexico',  tvEnglish:['FS1'],  tvSpanish:['Telemundo'] },
  'USA|Paraguay':                { date:'2026-06-12', timeLocal:'18:00', tz:'PT',  venue:'SoFi Stadium',             city:'Los Angeles, CA',               tvEnglish:['FOX'],  tvSpanish:['Telemundo'] },
  'Brazil|Morocco':              { date:'2026-06-13', timeLocal:'18:00', tz:'ET',  venue:'MetLife Stadium',          city:'East Rutherford, NJ',           tvEnglish:['FOX'],  tvSpanish:['Telemundo'] },
  'Netherlands|Japan':           { date:'2026-06-14', timeLocal:'16:00', tz:'CT',  venue:"AT&T Stadium",             city:'Arlington (Dallas), TX',        tvEnglish:['FOX'],  tvSpanish:['Telemundo'] },
  'France|Senegal':              { date:'2026-06-16', timeLocal:'15:00', tz:'ET',  venue:'MetLife Stadium',          city:'East Rutherford, NJ',           tvEnglish:['FOX'],  tvSpanish:['Telemundo'] },
  'Norway|Senegal':              { date:'2026-06-22', timeLocal:'20:00', tz:'ET',  venue:'MetLife Stadium',          city:'East Rutherford, NJ',           tvEnglish:['FS1'],  tvSpanish:['Telemundo'] },
  'Ecuador|Germany':             { date:'2026-06-25', timeLocal:'16:00', tz:'ET',  venue:'MetLife Stadium',          city:'East Rutherford, NJ',           tvEnglish:['FOX'],  tvSpanish:['Telemundo'] },
  'Panama|England':              { date:'2026-06-27', timeLocal:'17:00', tz:'ET',  venue:'MetLife Stadium',          city:'East Rutherford, NJ',           tvEnglish:['FOX'],  tvSpanish:['Telemundo'] },
};

// Generate group stage matches (each team plays the other 3 in their group)
function generateMatches() {
  const matches = [];
  let id = 1;
  WC_GROUPS.forEach(group => {
    const teams = group.teams;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const key = teams[i].name + '|' + teams[j].name;
        const meta = WC_FIXTURE_META[key] || {};
        matches.push({
          id: id++,
          group: group.id,
          home: teams[i],
          away: teams[j],
          date: meta.date || null,
          timeLocal: meta.timeLocal || null,
          tz: meta.tz || 'ET',
          venue: meta.venue || null,
          city: meta.city || null,
          tvEnglish: meta.tvEnglish || WC_BROADCAST.default.tvEnglish,
          tvSpanish: meta.tvSpanish || WC_BROADCAST.default.tvSpanish,
          streaming: WC_BROADCAST.default.streaming,
          homeScore: null,
          awayScore: null,
          prediction: { home: null, away: null }
        });
      }
    }
  });
  return matches;
}

const WC_MATCHES = generateMatches();
