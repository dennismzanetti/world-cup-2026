// 2026 FIFA World Cup Groups & Teams
// Official draw results - December 5, 2025
// Sources: FIFA, ESPN, FOX Sports, RoadTrips schedule
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

// Default broadcast fallback
const BC = {
  fox:  { tvEnglish:['FOX'],  tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  fs1:  { tvEnglish:['FS1'],  tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
};

// Full group-stage fixture metadata — all 72 matches
// Sources: FIFA / ESPN schedule, FOX Sports broadcast guide
// EST times used for timeLocal; tz label for display
const WC_FIXTURE_META = {
  // ── GROUP A ──────────────────────────────────────────────────────────────
  'Mexico|South Africa':       { date:'2026-06-11', timeLocal:'15:00', tz:'ET', venue:'Estadio Azteca',              city:'Mexico City, Mexico',            ...BC.fox },
  'South Korea|Czechia':       { date:'2026-06-11', timeLocal:'22:00', tz:'ET', venue:'Estadio Akron',               city:'Guadalajara, Mexico',            ...BC.fs1 },
  'Czechia|South Africa':      { date:'2026-06-18', timeLocal:'12:00', tz:'ET', venue:'Mercedes-Benz Stadium',       city:'Atlanta, GA',                    ...BC.fox },
  'Mexico|South Korea':        { date:'2026-06-18', timeLocal:'21:00', tz:'ET', venue:'Estadio Akron',               city:'Guadalajara, Mexico',            ...BC.fox },
  'Czechia|Mexico':            { date:'2026-06-24', timeLocal:'21:00', tz:'ET', venue:'Estadio Azteca',              city:'Mexico City, Mexico',            ...BC.fox },
  'South Africa|South Korea':  { date:'2026-06-24', timeLocal:'21:00', tz:'ET', venue:'Estadio BBVA',                city:'Monterrey, Mexico',              ...BC.fs1 },

  // ── GROUP B ──────────────────────────────────────────────────────────────
  'Canada|Bosnia-Herzegovina': { date:'2026-06-12', timeLocal:'15:00', tz:'ET', venue:'BMO Field',                  city:'Toronto, Canada',                ...BC.fox },
  'Qatar|Switzerland':         { date:'2026-06-13', timeLocal:'15:00', tz:'ET', venue:"Levi's Stadium",             city:'Santa Clara, CA',                ...BC.fox },
  'Switzerland|Bosnia-Herzegovina': { date:'2026-06-18', timeLocal:'15:00', tz:'ET', venue:'SoFi Stadium',          city:'Inglewood, CA',                  ...BC.fox },
  'Canada|Qatar':              { date:'2026-06-18', timeLocal:'18:00', tz:'ET', venue:'BC Place',                   city:'Vancouver, Canada',              ...BC.fs1 },
  'Switzerland|Canada':        { date:'2026-06-24', timeLocal:'15:00', tz:'ET', venue:'BC Place',                   city:'Vancouver, Canada',              ...BC.fox },
  'Bosnia-Herzegovina|Qatar':  { date:'2026-06-24', timeLocal:'15:00', tz:'ET', venue:'Lumen Field',                city:'Seattle, WA',                    ...BC.fs1 },

  // ── GROUP C ──────────────────────────────────────────────────────────────
  'Brazil|Morocco':            { date:'2026-06-13', timeLocal:'18:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fs1 },
  'Haiti|Scotland':            { date:'2026-06-13', timeLocal:'21:00', tz:'ET', venue:'Gillette Stadium',           city:'Foxborough, MA',                 ...BC.fs1 },
  'Scotland|Morocco':          { date:'2026-06-19', timeLocal:'18:00', tz:'ET', venue:'Gillette Stadium',           city:'Foxborough, MA',                 ...BC.fox },
  'Brazil|Haiti':              { date:'2026-06-19', timeLocal:'21:00', tz:'ET', venue:'Lincoln Financial Field',    city:'Philadelphia, PA',               ...BC.fox },
  'Scotland|Brazil':           { date:'2026-06-24', timeLocal:'18:00', tz:'ET', venue:'Hard Rock Stadium',          city:'Miami Gardens, FL',              ...BC.fox },
  'Morocco|Haiti':             { date:'2026-06-24', timeLocal:'18:00', tz:'ET', venue:'Mercedes-Benz Stadium',      city:'Atlanta, GA',                    ...BC.fs1 },

  // ── GROUP D ──────────────────────────────────────────────────────────────
  'USA|Paraguay':              { date:'2026-06-12', timeLocal:'21:00', tz:'ET', venue:'SoFi Stadium',               city:'Inglewood, CA',                  ...BC.fox },
  'Australia|Türkiye':         { date:'2026-06-13', timeLocal:'00:00', tz:'ET', venue:'BC Place',                   city:'Vancouver, Canada',              ...BC.fs1 },
  'USA|Australia':             { date:'2026-06-19', timeLocal:'15:00', tz:'ET', venue:'Lumen Field',                city:'Seattle, WA',                    ...BC.fox },
  'Türkiye|Paraguay':          { date:'2026-06-19', timeLocal:'23:00', tz:'ET', venue:"Levi's Stadium",             city:'Santa Clara, CA',                ...BC.fs1 },
  'Türkiye|USA':               { date:'2026-06-25', timeLocal:'22:00', tz:'ET', venue:'SoFi Stadium',               city:'Inglewood, CA',                  ...BC.fox },
  'Paraguay|Australia':        { date:'2026-06-25', timeLocal:'22:00', tz:'ET', venue:"Levi's Stadium",             city:'Santa Clara, CA',                ...BC.fs1 },

  // ── GROUP E ──────────────────────────────────────────────────────────────
  'Germany|Curaçao':            { date:'2026-06-14', timeLocal:'13:00', tz:'ET', venue:'NRG Stadium',               city:'Houston, TX',                    ...BC.fox },
  'Ivory Coast|Ecuador':       { date:'2026-06-14', timeLocal:'19:00', tz:'ET', venue:'Lincoln Financial Field',    city:'Philadelphia, PA',               ...BC.fs1 },
  'Germany|Ivory Coast':       { date:'2026-06-20', timeLocal:'16:00', tz:'ET', venue:'BMO Field',                  city:'Toronto, Canada',                ...BC.fox },
  'Ecuador|Curaçao':            { date:'2026-06-20', timeLocal:'20:00', tz:'ET', venue:'Arrowhead Stadium',          city:'Kansas City, MO',                ...BC.fs1 },
  'Curaçao|Ivory Coast':        { date:'2026-06-25', timeLocal:'16:00', tz:'ET', venue:'Lincoln Financial Field',    city:'Philadelphia, PA',               ...BC.fs1 },
  'Ecuador|Germany':           { date:'2026-06-25', timeLocal:'16:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fox },

  // ── GROUP F ──────────────────────────────────────────────────────────────
  'Netherlands|Japan':         { date:'2026-06-14', timeLocal:'16:00', tz:'ET', venue:"AT&T Stadium",               city:'Arlington, TX',                  ...BC.fox },
  'Sweden|Tunisia':            { date:'2026-06-14', timeLocal:'22:00', tz:'ET', venue:'Estadio BBVA',               city:'Monterrey, Mexico',              ...BC.fs1 },
  'Netherlands|Sweden':        { date:'2026-06-20', timeLocal:'13:00', tz:'ET', venue:'NRG Stadium',                city:'Houston, TX',                    ...BC.fox },
  'Tunisia|Japan':             { date:'2026-06-20', timeLocal:'00:00', tz:'ET', venue:'Estadio BBVA',               city:'Monterrey, Mexico',              ...BC.fs1 },
  'Japan|Sweden':              { date:'2026-06-25', timeLocal:'19:00', tz:'ET', venue:"AT&T Stadium",               city:'Arlington, TX',                  ...BC.fox },
  'Tunisia|Netherlands':       { date:'2026-06-25', timeLocal:'19:00', tz:'ET', venue:'Arrowhead Stadium',          city:'Kansas City, MO',                ...BC.fs1 },

  // ── GROUP G ──────────────────────────────────────────────────────────────
  'Belgium|Egypt':             { date:'2026-06-15', timeLocal:'15:00', tz:'ET', venue:'Lumen Field',                city:'Seattle, WA',                    ...BC.fox },
  'Iran|New Zealand':          { date:'2026-06-15', timeLocal:'21:00', tz:'ET', venue:'SoFi Stadium',               city:'Inglewood, CA',                  ...BC.fs1 },
  'Belgium|Iran':              { date:'2026-06-21', timeLocal:'15:00', tz:'ET', venue:'SoFi Stadium',               city:'Inglewood, CA',                  ...BC.fox },
  'New Zealand|Egypt':         { date:'2026-06-21', timeLocal:'21:00', tz:'ET', venue:'BC Place',                   city:'Vancouver, Canada',              ...BC.fs1 },
  'Egypt|Iran':                { date:'2026-06-26', timeLocal:'23:00', tz:'ET', venue:'Lumen Field',                city:'Seattle, WA',                    ...BC.fox },
  'New Zealand|Belgium':       { date:'2026-06-26', timeLocal:'23:00', tz:'ET', venue:'BC Place',                   city:'Vancouver, Canada',              ...BC.fs1 },

  // ── GROUP H ──────────────────────────────────────────────────────────────
  'Spain|Cape Verde':          { date:'2026-06-15', timeLocal:'12:00', tz:'ET', venue:'Mercedes-Benz Stadium',      city:'Atlanta, GA',                    ...BC.fox },
  'Saudi Arabia|Uruguay':      { date:'2026-06-15', timeLocal:'18:00', tz:'ET', venue:'Hard Rock Stadium',          city:'Miami Gardens, FL',              ...BC.fs1 },
  'Spain|Saudi Arabia':        { date:'2026-06-21', timeLocal:'12:00', tz:'ET', venue:'Mercedes-Benz Stadium',      city:'Atlanta, GA',                    ...BC.fox },
  'Uruguay|Cape Verde':        { date:'2026-06-21', timeLocal:'18:00', tz:'ET', venue:'Hard Rock Stadium',          city:'Miami Gardens, FL',              ...BC.fs1 },
  'Cape Verde|Saudi Arabia':   { date:'2026-06-26', timeLocal:'20:00', tz:'ET', venue:'NRG Stadium',                city:'Houston, TX',                    ...BC.fs1 },
  'Uruguay|Spain':             { date:'2026-06-26', timeLocal:'20:00', tz:'ET', venue:'Estadio Akron',              city:'Guadalajara, Mexico',            ...BC.fox },

  // ── GROUP I ──────────────────────────────────────────────────────────────
  'France|Senegal':            { date:'2026-06-16', timeLocal:'15:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fox },
  'Iraq|Norway':               { date:'2026-06-16', timeLocal:'18:00', tz:'ET', venue:'Gillette Stadium',           city:'Foxborough, MA',                 ...BC.fox },
  'France|Iraq':               { date:'2026-06-22', timeLocal:'17:00', tz:'ET', venue:'Lincoln Financial Field',    city:'Philadelphia, PA',               ...BC.fox },
  'Norway|Senegal':            { date:'2026-06-22', timeLocal:'20:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fs1 },
  'Norway|France':             { date:'2026-06-26', timeLocal:'15:00', tz:'ET', venue:'Gillette Stadium',           city:'Foxborough, MA',                 ...BC.fox },
  'Senegal|Iraq':              { date:'2026-06-26', timeLocal:'15:00', tz:'ET', venue:'BMO Field',                  city:'Toronto, Canada',                ...BC.fs1 },

  // ── GROUP J ──────────────────────────────────────────────────────────────
  'Argentina|Algeria':         { date:'2026-06-16', timeLocal:'21:00', tz:'ET', venue:'Arrowhead Stadium',          city:'Kansas City, MO',                ...BC.fox },
  'Austria|Jordan':            { date:'2026-06-16', timeLocal:'00:00', tz:'ET', venue:"Levi's Stadium",             city:'Santa Clara, CA',                ...BC.fs1 },
  'Argentina|Austria':         { date:'2026-06-22', timeLocal:'13:00', tz:'ET', venue:"AT&T Stadium",               city:'Arlington, TX',                  ...BC.fox },
  'Jordan|Algeria':            { date:'2026-06-22', timeLocal:'23:00', tz:'ET', venue:"Levi's Stadium",             city:'Santa Clara, CA',                ...BC.fs1 },
  'Algeria|Austria':           { date:'2026-06-27', timeLocal:'22:00', tz:'ET', venue:'Arrowhead Stadium',          city:'Kansas City, MO',                ...BC.fox },
  'Jordan|Argentina':          { date:'2026-06-27', timeLocal:'22:00', tz:'ET', venue:"AT&T Stadium",               city:'Arlington, TX',                  ...BC.fs1 },

  // ── GROUP K ──────────────────────────────────────────────────────────────
  'Portugal|Congo DR':         { date:'2026-06-17', timeLocal:'13:00', tz:'ET', venue:'NRG Stadium',                city:'Houston, TX',                    ...BC.fox },
  'Uzbekistan|Colombia':       { date:'2026-06-17', timeLocal:'22:00', tz:'ET', venue:'Estadio Azteca',             city:'Mexico City, Mexico',            ...BC.fs1 },
  'Portugal|Uzbekistan':       { date:'2026-06-23', timeLocal:'13:00', tz:'ET', venue:'NRG Stadium',                city:'Houston, TX',                    ...BC.fox },
  'Colombia|Congo DR':         { date:'2026-06-23', timeLocal:'22:00', tz:'ET', venue:'Estadio Akron',              city:'Guadalajara, Mexico',            ...BC.fs1 },
  'Colombia|Portugal':         { date:'2026-06-27', timeLocal:'19:30', tz:'ET', venue:'Hard Rock Stadium',          city:'Miami Gardens, FL',              ...BC.fox },
  'Congo DR|Uzbekistan':       { date:'2026-06-27', timeLocal:'19:30', tz:'ET', venue:'Mercedes-Benz Stadium',      city:'Atlanta, GA',                    ...BC.fs1 },

  // ── GROUP L ──────────────────────────────────────────────────────────────
  'England|Croatia':           { date:'2026-06-17', timeLocal:'16:00', tz:'ET', venue:"AT&T Stadium",               city:'Arlington, TX',                  ...BC.fox },
  'Ghana|Panama':              { date:'2026-06-17', timeLocal:'19:00', tz:'ET', venue:'BMO Field',                  city:'Toronto, Canada',                ...BC.fs1 },
  'England|Ghana':             { date:'2026-06-23', timeLocal:'16:00', tz:'ET', venue:'Gillette Stadium',           city:'Foxborough, MA',                 ...BC.fox },
  'Panama|Croatia':            { date:'2026-06-23', timeLocal:'19:00', tz:'ET', venue:'BMO Field',                  city:'Toronto, Canada',                ...BC.fs1 },
  'Panama|England':            { date:'2026-06-27', timeLocal:'17:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fox },
  'Croatia|Ghana':             { date:'2026-06-27', timeLocal:'17:00', tz:'ET', venue:'Lincoln Financial Field',    city:'Philadelphia, PA',               ...BC.fs1 },
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
          date:      meta.date      || null,
          timeLocal: meta.timeLocal || null,
          tz:        meta.tz        || 'ET',
          venue:     meta.venue     || null,
          city:      meta.city      || null,
          tvEnglish: meta.tvEnglish || ['FOX / FS1'],
          tvSpanish: meta.tvSpanish || ['Telemundo'],
          streaming: meta.streaming || ['FOX One', 'Peacock'],
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
