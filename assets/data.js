// 2026 FIFA World Cup Groups & Teams
// 12 groups of 4 teams each
const WC_GROUPS = [
  { id: 'A', teams: [{name:'USA', flag:'🇺🇸'},{name:'Mexico', flag:'🇲🇽'},{name:'Uruguay', flag:'🇺🇾'},{name:'Panama', flag:'🇵🇦'}] },
  { id: 'B', teams: [{name:'Spain', flag:'🇪🇸'},{name:'Brazil', flag:'🇧🇷'},{name:'Japan', flag:'🇯🇵'},{name:'Morocco', flag:'🇲🇦'}] },
  { id: 'C', teams: [{name:'England', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},{name:'Argentina', flag:'🇦🇷'},{name:'France', flag:'🇫🇷'},{name:'Australia', flag:'🇦🇺'}] },
  { id: 'D', teams: [{name:'Germany', flag:'🇩🇪'},{name:'Portugal', flag:'🇵🇹'},{name:'Colombia', flag:'🇨🇴'},{name:'Senegal', flag:'🇸🇳'}] },
  { id: 'E', teams: [{name:'Netherlands', flag:'🇳🇱'},{name:'Ecuador', flag:'🇪🇨'},{name:'Italy', flag:'🇮🇹'},{name:'South Korea', flag:'🇰🇷'}] },
  { id: 'F', teams: [{name:'Belgium', flag:'🇧🇪'},{name:'Croatia', flag:'🇭🇷'},{name:'Serbia', flag:'🇷🇸'},{name:'Jamaica', flag:'🇯🇲'}] },
  { id: 'G', teams: [{name:'Canada', flag:'🇨🇦'},{name:'Cameroon', flag:'🇨🇲'},{name:'Chile', flag:'🇨🇱'},{name:'Peru', flag:'🇵🇪'}] },
  { id: 'H', teams: [{name:'Switzerland', flag:'🇨🇭'},{name:'Denmark', flag:'🇩🇰'},{name:'Turkey', flag:'🇹🇷'},{name:'Bolivia', flag:'🇧🇴'}] },
  { id: 'I', teams: [{name:'Poland', flag:'🇵🇱'},{name:'Paraguay', flag:'🇵🇾'},{name:'Saudi Arabia', flag:'🇸🇦'},{name:'Honduras', flag:'🇭🇳'}] },
  { id: 'J', teams: [{name:'Nigeria', flag:'🇳🇬'},{name:'Egypt', flag:'🇪🇬'},{name:'Ukraine', flag:'🇺🇦'},{name:'New Zealand', flag:'🇳🇿'}] },
  { id: 'K', teams: [{name:'Iran', flag:'🇮🇷'},{name:'Venezuela', flag:'🇻🇪'},{name:'Algeria', flag:'🇩🇿'},{name:'Czech Republic', flag:'🇨🇿'}] },
  { id: 'L', teams: [{name:'Portugal', flag:'🇵🇹'},{name:'Scotland', flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿'},{name:'Ghana', flag:'🇬🇭'},{name:'El Salvador', flag:'🇸🇻'}] },
];

// Generate group stage matches (each team plays 3 games)
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
