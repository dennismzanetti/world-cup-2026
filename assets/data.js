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
  'Canada|Qatar':              { date:'2026-06-18', timeLocal:'18:00', tz:'ET', venue:'Arrowhead Stadium',          city:'Kansas City, MO',                ...BC.fs1 },
  'Bosnia-Herzegovina|Qatar':  { date:'2026-06-24', timeLocal:'15:00', tz:'ET', venue:'Lincoln Financial Field',    city:'Philadelphia, PA',               ...BC.fox },
  'Switzerland|Canada':        { date:'2026-06-24', timeLocal:'18:00', tz:'ET', venue:'Gillette Stadium',           city:'Foxborough, MA',                 ...BC.fs1 },

  // ── GROUP C ──────────────────────────────────────────────────────────────
  'Brazil|Haiti':              { date:'2026-06-12', timeLocal:'18:00', tz:'ET', venue:'SoFi Stadium',               city:'Inglewood, CA',                  ...BC.fox },
  'Morocco|Scotland':          { date:'2026-06-12', timeLocal:'21:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fs1 },
  'Brazil|Morocco':            { date:'2026-06-19', timeLocal:'15:00', tz:'ET', venue:'AT&T Stadium',               city:'Arlington, TX',                  ...BC.fox },
  'Scotland|Haiti':            { date:'2026-06-19', timeLocal:'18:00', tz:'ET', venue:"Levi's Stadium",             city:'Santa Clara, CA',                ...BC.fs1 },
  'Haiti|Morocco':             { date:'2026-06-25', timeLocal:'15:00', tz:'ET', venue:'NRG Stadium',                city:'Houston, TX',                    ...BC.fox },
  'Scotland|Brazil':           { date:'2026-06-25', timeLocal:'18:00', tz:'ET', venue:'Rose Bowl',                  city:'Pasadena, CA',                   ...BC.fs1 },

  // ── GROUP D ──────────────────────────────────────────────────────────────
  'USA|Türkiye':               { date:'2026-06-12', timeLocal:'21:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fox },
  'Paraguay|Australia':        { date:'2026-06-13', timeLocal:'12:00', tz:'ET', venue:'Hard Rock Stadium',          city:'Miami Gardens, FL',              ...BC.fs1 },
  'USA|Paraguay':              { date:'2026-06-19', timeLocal:'21:00', tz:'ET', venue:'SoFi Stadium',               city:'Inglewood, CA',                  ...BC.fox },
  'Australia|Türkiye':         { date:'2026-06-20', timeLocal:'12:00', tz:'ET', venue:'Lumen Field',                city:'Seattle, WA',                    ...BC.fs1 },
  'Türkiye|Paraguay':          { date:'2026-06-25', timeLocal:'21:00', tz:'ET', venue:'Arrowhead Stadium',          city:'Kansas City, MO',                ...BC.fox },
  'Australia|USA':             { date:'2026-06-26', timeLocal:'12:00', tz:'ET', venue:'BC Place',                   city:'Vancouver, Canada',              ...BC.fs1 },

  // ── GROUP E ──────────────────────────────────────────────────────────────
  'Germany|Ivory Coast':       { date:'2026-06-13', timeLocal:'18:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fox },
  'Curaçao|Ecuador':           { date:'2026-06-13', timeLocal:'21:00', tz:'ET', venue:'Rose Bowl',                  city:'Pasadena, CA',                   ...BC.fs1 },
  'Germany|Curaçao':           { date:'2026-06-20', timeLocal:'15:00', tz:'ET', venue:'Gillette Stadium',           city:'Foxborough, MA',                 ...BC.fox },
  'Ecuador|Ivory Coast':       { date:'2026-06-20', timeLocal:'18:00', tz:'ET', venue:'Mercedes-Benz Stadium',      city:'Atlanta, GA',                    ...BC.fs1 },
  'Curaçao|Ivory Coast':       { date:'2026-06-26', timeLocal:'15:00', tz:'ET', venue:'AT&T Stadium',               city:'Arlington, TX',                  ...BC.fox },
  'Ecuador|Germany':           { date:'2026-06-26', timeLocal:'18:00', tz:'ET', venue:'Hard Rock Stadium',          city:'Miami Gardens, FL',              ...BC.fs1 },

  // ── GROUP F ──────────────────────────────────────────────────────────────
  'Netherlands|Tunisia':       { date:'2026-06-14', timeLocal:'12:00', tz:'ET', venue:'Lincoln Financial Field',    city:'Philadelphia, PA',               ...BC.fox },
  'Japan|Sweden':              { date:'2026-06-14', timeLocal:'15:00', tz:'ET', venue:'Lumen Field',                city:'Seattle, WA',                    ...BC.fs1 },
  'Netherlands|Japan':         { date:'2026-06-20', timeLocal:'21:00', tz:'ET', venue:'BC Place',                   city:'Vancouver, Canada',              ...BC.fox },
  'Sweden|Tunisia':            { date:'2026-06-21', timeLocal:'12:00', tz:'ET', venue:'Arrowhead Stadium',          city:'Kansas City, MO',                ...BC.fs1 },
  'Sweden|Netherlands':        { date:'2026-06-27', timeLocal:'15:00', tz:'ET', venue:'NRG Stadium',                city:'Houston, TX',                    ...BC.fox },
  'Tunisia|Japan':             { date:'2026-06-27', timeLocal:'18:00', tz:'ET', venue:"Levi's Stadium",             city:'Santa Clara, CA',                ...BC.fs1 },

  // ── GROUP G ──────────────────────────────────────────────────────────────
  'Belgium|New Zealand':       { date:'2026-06-14', timeLocal:'18:00', tz:'ET', venue:'Rose Bowl',                  city:'Pasadena, CA',                   ...BC.fox },
  'Egypt|Iran':                { date:'2026-06-14', timeLocal:'21:00', tz:'ET', venue:'SoFi Stadium',               city:'Inglewood, CA',                  ...BC.fs1 },
  'Belgium|Egypt':             { date:'2026-06-21', timeLocal:'15:00', tz:'ET', venue:'Gillette Stadium',           city:'Foxborough, MA',                 ...BC.fox },
  'Iran|New Zealand':          { date:'2026-06-21', timeLocal:'18:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fs1 },
  'Iran|Belgium':              { date:'2026-06-27', timeLocal:'21:00', tz:'ET', venue:'Mercedes-Benz Stadium',      city:'Atlanta, GA',                    ...BC.fox },
  'New Zealand|Egypt':         { date:'2026-06-28', timeLocal:'12:00', tz:'ET', venue:'Hard Rock Stadium',          city:'Miami Gardens, FL',              ...BC.fs1 },

  // ── GROUP H ──────────────────────────────────────────────────────────────
  'Spain|Uruguay':             { date:'2026-06-15', timeLocal:'15:00', tz:'ET', venue:'AT&T Stadium',               city:'Arlington, TX',                  ...BC.fox },
  'Cape Verde|Saudi Arabia':   { date:'2026-06-15', timeLocal:'18:00', tz:'ET', venue:'Lincoln Financial Field',    city:'Philadelphia, PA',               ...BC.fs1 },
  'Spain|Cape Verde':          { date:'2026-06-21', timeLocal:'21:00', tz:'ET', venue:'Rose Bowl',                  city:'Pasadena, CA',                   ...BC.fox },
  'Saudi Arabia|Uruguay':      { date:'2026-06-22', timeLocal:'12:00', tz:'ET', venue:'Lumen Field',                city:'Seattle, WA',                    ...BC.fs1 },
  'Saudi Arabia|Spain':        { date:'2026-06-28', timeLocal:'15:00', tz:'ET', venue:'BC Place',                   city:'Vancouver, Canada',              ...BC.fox },
  'Uruguay|Cape Verde':        { date:'2026-06-28', timeLocal:'18:00', tz:'ET', venue:'Arrowhead Stadium',          city:'Kansas City, MO',                ...BC.fs1 },

  // ── GROUP I ──────────────────────────────────────────────────────────────
  'France|Iraq':               { date:'2026-06-15', timeLocal:'21:00', tz:'ET', venue:'AT&T Stadium',               city:'Arlington, TX',                  ...BC.fox },
  'Senegal|Norway':            { date:'2026-06-16', timeLocal:'12:00', tz:'ET', venue:'NRG Stadium',                city:'Houston, TX',                    ...BC.fs1 },
  'France|Senegal':            { date:'2026-06-22', timeLocal:'15:00', tz:'ET', venue:'SoFi Stadium',               city:'Inglewood, CA',                  ...BC.fox },
  'Norway|Iraq':               { date:'2026-06-22', timeLocal:'18:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fs1 },
  'Norway|France':             { date:'2026-06-28', timeLocal:'21:00', tz:'ET', venue:"Levi's Stadium",             city:'Santa Clara, CA',                ...BC.fox },
  'Iraq|Senegal':              { date:'2026-06-29', timeLocal:'12:00', tz:'ET', venue:'Gillette Stadium',           city:'Foxborough, MA',                 ...BC.fs1 },

  // ── GROUP J ──────────────────────────────────────────────────────────────
  'Argentina|Jordan':          { date:'2026-06-16', timeLocal:'15:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fox },
  'Algeria|Austria':           { date:'2026-06-16', timeLocal:'18:00', tz:'ET', venue:'Rose Bowl',                  city:'Pasadena, CA',                   ...BC.fs1 },
  'Argentina|Algeria':         { date:'2026-06-22', timeLocal:'21:00', tz:'ET', venue:'AT&T Stadium',               city:'Arlington, TX',                  ...BC.fox },
  'Austria|Jordan':            { date:'2026-06-23', timeLocal:'12:00', tz:'ET', venue:'Hard Rock Stadium',          city:'Miami Gardens, FL',              ...BC.fs1 },
  'Austria|Argentina':         { date:'2026-06-29', timeLocal:'15:00', tz:'ET', venue:'BC Place',                   city:'Vancouver, Canada',              ...BC.fox },
  'Jordan|Algeria':            { date:'2026-06-29', timeLocal:'18:00', tz:'ET', venue:'Arrowhead Stadium',          city:'Kansas City, MO',                ...BC.fs1 },

  // ── GROUP K ──────────────────────────────────────────────────────────────
  'Portugal|Uzbekistan':       { date:'2026-06-17', timeLocal:'12:00', tz:'ET', venue:'Lincoln Financial Field',    city:'Philadelphia, PA',               ...BC.fox },
  'Congo DR|Colombia':         { date:'2026-06-17', timeLocal:'15:00', tz:'ET', venue:'Lumen Field',                city:'Seattle, WA',                    ...BC.fs1 },
  'Portugal|Congo DR':         { date:'2026-06-23', timeLocal:'15:00', tz:'ET', venue:'NRG Stadium',                city:'Houston, TX',                    ...BC.fox },
  'Colombia|Uzbekistan':       { date:'2026-06-23', timeLocal:'18:00', tz:'ET', venue:'Mercedes-Benz Stadium',      city:'Atlanta, GA',                    ...BC.fs1 },
  'Colombia|Portugal':         { date:'2026-06-29', timeLocal:'21:00', tz:'ET', venue:'SoFi Stadium',               city:'Inglewood, CA',                  ...BC.fox },
  'Uzbekistan|Congo DR':       { date:'2026-06-30', timeLocal:'12:00', tz:'ET', venue:'Gillette Stadium',           city:'Foxborough, MA',                 ...BC.fs1 },

  // ── GROUP L ──────────────────────────────────────────────────────────────
  'England|Panama':            { date:'2026-06-17', timeLocal:'18:00', tz:'ET', venue:'Rose Bowl',                  city:'Pasadena, CA',                   ...BC.fox },
  'Croatia|Ghana':             { date:'2026-06-17', timeLocal:'21:00', tz:'ET', venue:'AT&T Stadium',               city:'Arlington, TX',                  ...BC.fs1 },
  'England|Croatia':           { date:'2026-06-23', timeLocal:'21:00', tz:'ET', venue:'MetLife Stadium',            city:'East Rutherford, NJ',            ...BC.fox },
  'Ghana|Panama':              { date:'2026-06-24', timeLocal:'12:00', tz:'ET', venue:'Hard Rock Stadium',          city:'Miami Gardens, FL',              ...BC.fs1 },
  'Ghana|England':             { date:'2026-06-30', timeLocal:'15:00', tz:'ET', venue:'BC Place',                   city:'Vancouver, Canada',              ...BC.fox },
  'Panama|Croatia':            { date:'2026-06-30', timeLocal:'18:00', tz:'ET', venue:'Arrowhead Stadium',          city:'Kansas City, MO',                ...BC.fs1 },
};

// Build WC_MATCHES from groups + fixture metadata
function makeId(home, away) {
  const slug = s => s.toLowerCase()
    .replace(/[çć]/g,'c').replace(/[üú]/g,'u').replace(/[ñ]/g,'n')
    .replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  return `${slug(home)}-vs-${slug(away)}`;
}

const WC_MATCHES = [];
WC_GROUPS.forEach(group => {
  const teams = group.teams;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const home = teams[i];
      const away = teams[j];
      const key  = `${home.name}|${away.name}`;
      const meta = WC_FIXTURE_META[key] || {};
      WC_MATCHES.push({
        id:         makeId(home.name, away.name),
        group:      group.id,
        home,
        away,
        homeScore:  null,
        awayScore:  null,
        status:     'scheduled',
        ...meta,
      });
    }
  }
});

const WC_KNOCKOUT_FIXTURES = [
  // ── ROUND OF 32 ──────────────────────────────────────────────────────────
  { id:'r32-1',  stage:'Round of 32', homeSource:{type:'group',group:'A',pos:1}, awaySource:{type:'group',group:'B',pos:2}, home:{name:'1A',flag:'🏳️'}, away:{name:'2B',flag:'🏳️'}, date:'2026-06-28', timeLocal:'15:00', tz:'ET', venue:'Estadio Azteca',           city:'Mexico City, Mexico',        tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-2',  stage:'Round of 32', homeSource:{type:'group',group:'C',pos:1}, awaySource:{type:'group',group:'D',pos:2}, home:{name:'1C',flag:'🏳️'}, away:{name:'2D',flag:'🏳️'}, date:'2026-06-28', timeLocal:'19:00', tz:'ET', venue:'MetLife Stadium',          city:'East Rutherford, NJ',        tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-3',  stage:'Round of 32', homeSource:{type:'group',group:'E',pos:1}, awaySource:{type:'group',group:'F',pos:2}, home:{name:'1E',flag:'🏳️'}, away:{name:'2F',flag:'🏳️'}, date:'2026-06-29', timeLocal:'15:00', tz:'ET', venue:'SoFi Stadium',             city:'Inglewood, CA',              tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-4',  stage:'Round of 32', homeSource:{type:'group',group:'G',pos:1}, awaySource:{type:'group',group:'H',pos:2}, home:{name:'1G',flag:'🏳️'}, away:{name:'2H',flag:'🏳️'}, date:'2026-06-29', timeLocal:'19:00', tz:'ET', venue:'AT&T Stadium',             city:'Arlington, TX',              tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-5',  stage:'Round of 32', homeSource:{type:'group',group:'I',pos:1}, awaySource:{type:'group',group:'J',pos:2}, home:{name:'1I',flag:'🏳️'}, away:{name:'2J',flag:'🏳️'}, date:'2026-06-30', timeLocal:'15:00', tz:'ET', venue:'Arrowhead Stadium',        city:'Kansas City, MO',            tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-6',  stage:'Round of 32', homeSource:{type:'group',group:'K',pos:1}, awaySource:{type:'group',group:'L',pos:2}, home:{name:'1K',flag:'🏳️'}, away:{name:'2L',flag:'🏳️'}, date:'2026-06-30', timeLocal:'19:00', tz:'ET', venue:'NRG Stadium',              city:'Houston, TX',                tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-7',  stage:'Round of 32', homeSource:{type:'group',group:'B',pos:1}, awaySource:{type:'group',group:'A',pos:2}, home:{name:'1B',flag:'🏳️'}, away:{name:'2A',flag:'🏳️'}, date:'2026-07-01', timeLocal:'15:00', tz:'ET', venue:'BC Place',                  city:'Vancouver, Canada',          tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-8',  stage:'Round of 32', homeSource:{type:'group',group:'D',pos:1}, awaySource:{type:'group',group:'C',pos:2}, home:{name:'1D',flag:'🏳️'}, away:{name:'2C',flag:'🏳️'}, date:'2026-07-01', timeLocal:'19:00', tz:'ET', venue:'Lincoln Financial Field',   city:'Philadelphia, PA',           tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-9',  stage:'Round of 32', homeSource:{type:'group',group:'F',pos:1}, awaySource:{type:'group',group:'E',pos:2}, home:{name:'1F',flag:'🏳️'}, away:{name:'2E',flag:'🏳️'}, date:'2026-07-02', timeLocal:'15:00', tz:'ET', venue:'Lumen Field',              city:'Seattle, WA',                tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-10', stage:'Round of 32', homeSource:{type:'group',group:'H',pos:1}, awaySource:{type:'group',group:'G',pos:2}, home:{name:'1H',flag:'🏳️'}, away:{name:'2G',flag:'🏳️'}, date:'2026-07-02', timeLocal:'19:00', tz:'ET', venue:'Gillette Stadium',          city:'Foxborough, MA',             tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-11', stage:'Round of 32', homeSource:{type:'group',group:'J',pos:1}, awaySource:{type:'group',group:'I',pos:2}, home:{name:'1J',flag:'🏳️'}, away:{name:'2I',flag:'🏳️'}, date:'2026-07-03', timeLocal:'15:00', tz:'ET', venue:'Hard Rock Stadium',         city:'Miami Gardens, FL',          tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-12', stage:'Round of 32', homeSource:{type:'group',group:'L',pos:1}, awaySource:{type:'group',group:'K',pos:2}, home:{name:'1L',flag:'🏳️'}, away:{name:'2K',flag:'🏳️'}, date:'2026-07-03', timeLocal:'19:00', tz:'ET', venue:'BMO Field',                 city:'Toronto, Canada',            tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-13', stage:'Round of 32', homeSource:{type:'best3rd',rank:1}, awaySource:{type:'best3rd',rank:2}, home:{name:'Best 3rd 1',flag:'🏳️'}, away:{name:'Best 3rd 2',flag:'🏳️'}, date:'2026-07-04', timeLocal:'15:00', tz:'ET', venue:'Mercedes-Benz Stadium', city:'Atlanta, GA',               tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-14', stage:'Round of 32', homeSource:{type:'best3rd',rank:3}, awaySource:{type:'best3rd',rank:4}, home:{name:'Best 3rd 3',flag:'🏳️'}, away:{name:'Best 3rd 4',flag:'🏳️'}, date:'2026-07-04', timeLocal:'19:00', tz:'ET', venue:'Estadio BBVA',          city:'Monterrey, Mexico',          tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-15', stage:'Round of 32', homeSource:{type:'best3rd',rank:5}, awaySource:{type:'best3rd',rank:6}, home:{name:'Best 3rd 5',flag:'🏳️'}, away:{name:'Best 3rd 6',flag:'🏳️'}, date:'2026-07-05', timeLocal:'15:00', tz:'ET', venue:'Estadio Akron',         city:'Guadalajara, Mexico',        tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r32-16', stage:'Round of 32', homeSource:{type:'best3rd',rank:7}, awaySource:{type:'best3rd',rank:8}, home:{name:'Best 3rd 7',flag:'🏳️'}, away:{name:'Best 3rd 8',flag:'🏳️'}, date:'2026-07-05', timeLocal:'19:00', tz:'ET', venue:"Levi's Stadium",        city:'Santa Clara, CA',            tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  // ── ROUND OF 16 ──────────────────────────────────────────────────────────
  { id:'r16-1', stage:'Round of 16', homeSource:{type:'winner',matchId:'r32-1'},  awaySource:{type:'winner',matchId:'r32-2'},  home:{name:'W R32-1', flag:'🏳️'}, away:{name:'W R32-2', flag:'🏳️'}, date:'2026-07-07', timeLocal:'15:00', tz:'ET', venue:'MetLife Stadium',         city:'East Rutherford, NJ', tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r16-2', stage:'Round of 16', homeSource:{type:'winner',matchId:'r32-3'},  awaySource:{type:'winner',matchId:'r32-4'},  home:{name:'W R32-3', flag:'🏳️'}, away:{name:'W R32-4', flag:'🏳️'}, date:'2026-07-07', timeLocal:'19:00', tz:'ET', venue:'AT&T Stadium',           city:'Arlington, TX',       tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r16-3', stage:'Round of 16', homeSource:{type:'winner',matchId:'r32-5'},  awaySource:{type:'winner',matchId:'r32-6'},  home:{name:'W R32-5', flag:'🏳️'}, away:{name:'W R32-6', flag:'🏳️'}, date:'2026-07-08', timeLocal:'15:00', tz:'ET', venue:'SoFi Stadium',           city:'Inglewood, CA',       tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r16-4', stage:'Round of 16', homeSource:{type:'winner',matchId:'r32-7'},  awaySource:{type:'winner',matchId:'r32-8'},  home:{name:'W R32-7', flag:'🏳️'}, away:{name:'W R32-8', flag:'🏳️'}, date:'2026-07-08', timeLocal:'19:00', tz:'ET', venue:'Hard Rock Stadium',      city:'Miami Gardens, FL',   tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r16-5', stage:'Round of 16', homeSource:{type:'winner',matchId:'r32-9'},  awaySource:{type:'winner',matchId:'r32-10'}, home:{name:'W R32-9', flag:'🏳️'}, away:{name:'W R32-10',flag:'🏳️'}, date:'2026-07-09', timeLocal:'15:00', tz:'ET', venue:'NRG Stadium',            city:'Houston, TX',         tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r16-6', stage:'Round of 16', homeSource:{type:'winner',matchId:'r32-11'}, awaySource:{type:'winner',matchId:'r32-12'}, home:{name:'W R32-11',flag:'🏳️'}, away:{name:'W R32-12',flag:'🏳️'}, date:'2026-07-09', timeLocal:'19:00', tz:'ET', venue:'Arrowhead Stadium',      city:'Kansas City, MO',     tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r16-7', stage:'Round of 16', homeSource:{type:'winner',matchId:'r32-13'}, awaySource:{type:'winner',matchId:'r32-14'}, home:{name:'W R32-13',flag:'🏳️'}, away:{name:'W R32-14',flag:'🏳️'}, date:'2026-07-10', timeLocal:'15:00', tz:'ET', venue:'Lumen Field',            city:'Seattle, WA',         tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'r16-8', stage:'Round of 16', homeSource:{type:'winner',matchId:'r32-15'}, awaySource:{type:'winner',matchId:'r32-16'}, home:{name:'W R32-15',flag:'🏳️'}, away:{name:'W R32-16',flag:'🏳️'}, date:'2026-07-10', timeLocal:'19:00', tz:'ET', venue:'BC Place',               city:'Vancouver, Canada',   tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  // ── QUARTERFINALS ────────────────────────────────────────────────────────
  { id:'qf-1', stage:'Quarterfinals', homeSource:{type:'winner',matchId:'r16-1'}, awaySource:{type:'winner',matchId:'r16-2'}, home:{name:'W R16-1',flag:'🏳️'}, away:{name:'W R16-2',flag:'🏳️'}, date:'2026-07-14', timeLocal:'15:00', tz:'ET', venue:'Estadio Azteca',    city:'Mexico City, Mexico',  tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'qf-2', stage:'Quarterfinals', homeSource:{type:'winner',matchId:'r16-3'}, awaySource:{type:'winner',matchId:'r16-4'}, home:{name:'W R16-3',flag:'🏳️'}, away:{name:'W R16-4',flag:'🏳️'}, date:'2026-07-14', timeLocal:'19:00', tz:'ET', venue:'MetLife Stadium',   city:'East Rutherford, NJ',  tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'qf-3', stage:'Quarterfinals', homeSource:{type:'winner',matchId:'r16-5'}, awaySource:{type:'winner',matchId:'r16-6'}, home:{name:'W R16-5',flag:'🏳️'}, away:{name:'W R16-6',flag:'🏳️'}, date:'2026-07-15', timeLocal:'15:00', tz:'ET', venue:'SoFi Stadium',      city:'Inglewood, CA',        tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'qf-4', stage:'Quarterfinals', homeSource:{type:'winner',matchId:'r16-7'}, awaySource:{type:'winner',matchId:'r16-8'}, home:{name:'W R16-7',flag:'🏳️'}, away:{name:'W R16-8',flag:'🏳️'}, date:'2026-07-15', timeLocal:'19:00', tz:'ET', venue:'AT&T Stadium',      city:'Arlington, TX',        tvEnglish:['FS1'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  // ── SEMIFINALS ──────────────────────────────────────────────────────────
  { id:'sf-1', stage:'Semifinals', homeSource:{type:'winner',matchId:'qf-1'}, awaySource:{type:'winner',matchId:'qf-2'}, home:{name:'W QF-1',flag:'🏳️'}, away:{name:'W QF-2',flag:'🏳️'}, date:'2026-07-18', timeLocal:'19:00', tz:'ET', venue:'MetLife Stadium',  city:'East Rutherford, NJ', tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  { id:'sf-2', stage:'Semifinals', homeSource:{type:'winner',matchId:'qf-3'}, awaySource:{type:'winner',matchId:'qf-4'}, home:{name:'W QF-3',flag:'🏳️'}, away:{name:'W QF-4',flag:'🏳️'}, date:'2026-07-21', timeLocal:'19:00', tz:'ET', venue:'AT&T Stadium',     city:'Arlington, TX',       tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  // ── THIRD PLACE ──────────────────────────────────────────────────────────
  { id:'tp-1', stage:'Third Place', homeSource:{type:'loser',matchId:'sf-1'}, awaySource:{type:'loser',matchId:'sf-2'}, home:{name:'L SF-1',flag:'🏳️'}, away:{name:'L SF-2',flag:'🏳️'}, date:'2026-07-24', timeLocal:'14:00', tz:'ET', venue:'Hard Rock Stadium', city:'Miami Gardens, FL',   tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
  // ── FINAL ────────────────────────────────────────────────────────────────
  { id:'final', stage:'Final', homeSource:{type:'winner',matchId:'sf-1'}, awaySource:{type:'winner',matchId:'sf-2'}, home:{name:'W SF-1',flag:'🏳️'}, away:{name:'W SF-2',flag:'🏳️'}, date:'2026-07-26', timeLocal:'17:00', tz:'ET', venue:'MetLife Stadium',  city:'East Rutherford, NJ', tvEnglish:['FOX'], tvSpanish:['Telemundo'], streaming:['FOX One','Peacock'] },
];

// Knockout fixtures are kept separate (see WC_KNOCKOUT_FIXTURES)

export { WC_GROUPS, WC_MATCHES, WC_KNOCKOUT_FIXTURES };
