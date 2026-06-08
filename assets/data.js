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

// Generate group stage matches (each team plays the other 3 in their group)
function generateMatches() {
  const matches = [];
  let id = 1;
  WC_GROUPS.forEach(group => {
    const teams = group.teams;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: id++,
          group: group.id,
          home: teams[i],
          away: teams[j],
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
