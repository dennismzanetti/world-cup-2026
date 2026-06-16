// ─── Team flag lookup ──────────────────────────────────────────────────────────
export const TEAM_FLAGS = {
  'Mexico':               '🇲🇽',
  'South Africa':         '🇿🇦',
  'South Korea':          '🇰🇷',
  'Czechia':              '🇨🇿',
  'Canada':               '🇨🇦',
  'Bosnia-Herzegovina':   '🇧🇦',
  'Qatar':                '🇶🇦',
  'Switzerland':          '🇨🇭',
  'Brazil':               '🇧🇷',
  'Morocco':              '🇲🇦',
  'Haiti':                '🇭🇹',
  'Scotland':             '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'USA':                  '🇺🇸',
  'United States':        '🇺🇸',
  'Paraguay':             '🇵🇾',
  'Australia':            '🇦🇺',
  'Türkiye':              '🇹🇷',
  'Turkey':               '🇹🇷',
  'Germany':              '🇩🇪',
  'Curaçao':              '🇨🇼',
  'Ivory Coast':          '🇨🇮',
  'Ecuador':              '🇪🇨',
  'Netherlands':          '🇳🇱',
  'Japan':                '🇯🇵',
  'Sweden':               '🇸🇪',
  'Tunisia':              '🇹🇳',
  'Belgium':              '🇧🇪',
  'Egypt':                '🇪🇬',
  'Iran':                 '🇮🇷',
  'New Zealand':          '🇳🇿',
  'Spain':                '🇪🇸',
  'Cape Verde':           '🇨🇻',
  'Saudi Arabia':         '🇸🇦',
  'Uruguay':              '🇺🇾',
  'France':               '🇫🇷',
  'Senegal':              '🇸🇳',
  'Iraq':                 '🇮🇶',
  'Norway':               '🇳🇴',
  'Argentina':            '🇦🇷',
  'Algeria':              '🇩🇿',
  'Austria':              '🇦🇹',
  'Jordan':               '🇯🇴',
  'Portugal':             '🇵🇹',
  'Congo DR':             '🇨🇩',
  'Uzbekistan':           '🇺🇿',
  'Colombia':             '🇨🇴',
  'England':              '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Croatia':              '🇭🇷',
  'Ghana':                '🇬🇭',
  'Panama':               '🇵🇦',
};

// ─── Admin UIDs ────────────────────────────────────────────────────────────────
export const ADMIN_UIDS = ['rvR3HclRnhXAOd3rgk7sO0s3F7v1'];

// ─── Team helpers ──────────────────────────────────────────────────────────────
export function teamName(t)    { return (t && typeof t === 'object') ? t.name : (t || ''); }
export function teamFlag(t) {
  if (t && typeof t === 'object') return t.flag || TEAM_FLAGS[t.name] || '';
  return TEAM_FLAGS[t] || '';
}
export function teamDisplay(t) {
  const f = teamFlag(t);
  const n = teamName(t);
  return f ? `${f} ${n}` : n;
}
