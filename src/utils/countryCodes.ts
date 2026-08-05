/**
 * ITU-T E.164 country calling codes, keyed by ISO 3166-1 alpha-2. Used by the
 * phone-number-linking flow (ProfileScreen) to build a full E.164 number
 * (dialCode + national number) without asking the user to type the "+1"
 * prefix themselves.
 *
 * Flags are derived from the ISO2 code rather than hardcoded per entry (each
 * letter maps to a Unicode "regional indicator symbol") — one less place to
 * transcribe wrong.
 */
export interface CountryDialCode {
  iso2: string;
  name: string;
  dialCode: string;
}

/**
 * Composes an E.164 number ("+" + country code + national number) from the
 * selected country and whatever the user typed.
 *
 * People do not type national numbers cleanly. The cases handled here are the
 * ones that would otherwise produce a malformed number Firebase rejects with a
 * 400:
 *  - "+1 604 555 1234" — already international. Naively stripping non-digits
 *    drops the "+" and the dial code gets prepended a second time.
 *  - "1 604 555 1234"  — NANP trunk/country digit typed out, same doubling.
 *  - "07911 123456"    — a national trunk "0" (UK and most of Europe), which
 *    E.164 requires be dropped rather than carried through.
 */
export function toE164(dialCode: string, input: string): string {
  const trimmed = input.trim();

  // Already international: the user supplied the country code themselves, so
  // the selector's dial code must not be applied on top of it.
  if (trimmed.startsWith('+')) {
    return `+${trimmed.replace(/\D/g, '')}`;
  }

  let digits = trimmed.replace(/\D/g, '');
  const cc = dialCode.replace(/\D/g, '');

  if (cc === '1') {
    // NANP: national numbers are exactly 10 digits and never start with 1, so
    // a leading 1 on an 11-digit string is unambiguously the country code.
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }
  } else if (digits.startsWith('0')) {
    // Trunk prefix — not part of the E.164 number.
    digits = digits.replace(/^0+/, '');
  }

  return `+${cc}${digits}`;
}

export function flagEmoji(iso2: string): string {
  const codePoints = iso2
    .toUpperCase()
    .split('')
    .map(c => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

export const COUNTRY_CODES: CountryDialCode[] = [
  {iso2: 'US', name: 'United States', dialCode: '+1'},
  {iso2: 'CA', name: 'Canada', dialCode: '+1'},
  {iso2: 'MX', name: 'Mexico', dialCode: '+52'},
  {iso2: 'GB', name: 'United Kingdom', dialCode: '+44'},
  {iso2: 'IE', name: 'Ireland', dialCode: '+353'},
  {iso2: 'FR', name: 'France', dialCode: '+33'},
  {iso2: 'DE', name: 'Germany', dialCode: '+49'},
  {iso2: 'ES', name: 'Spain', dialCode: '+34'},
  {iso2: 'PT', name: 'Portugal', dialCode: '+351'},
  {iso2: 'IT', name: 'Italy', dialCode: '+39'},
  {iso2: 'NL', name: 'Netherlands', dialCode: '+31'},
  {iso2: 'BE', name: 'Belgium', dialCode: '+32'},
  {iso2: 'LU', name: 'Luxembourg', dialCode: '+352'},
  {iso2: 'CH', name: 'Switzerland', dialCode: '+41'},
  {iso2: 'AT', name: 'Austria', dialCode: '+43'},
  {iso2: 'DK', name: 'Denmark', dialCode: '+45'},
  {iso2: 'SE', name: 'Sweden', dialCode: '+46'},
  {iso2: 'NO', name: 'Norway', dialCode: '+47'},
  {iso2: 'FI', name: 'Finland', dialCode: '+358'},
  {iso2: 'IS', name: 'Iceland', dialCode: '+354'},
  {iso2: 'PL', name: 'Poland', dialCode: '+48'},
  {iso2: 'CZ', name: 'Czech Republic', dialCode: '+420'},
  {iso2: 'SK', name: 'Slovakia', dialCode: '+421'},
  {iso2: 'HU', name: 'Hungary', dialCode: '+36'},
  {iso2: 'RO', name: 'Romania', dialCode: '+40'},
  {iso2: 'BG', name: 'Bulgaria', dialCode: '+359'},
  {iso2: 'GR', name: 'Greece', dialCode: '+30'},
  {iso2: 'HR', name: 'Croatia', dialCode: '+385'},
  {iso2: 'SI', name: 'Slovenia', dialCode: '+386'},
  {iso2: 'RS', name: 'Serbia', dialCode: '+381'},
  {iso2: 'BA', name: 'Bosnia and Herzegovina', dialCode: '+387'},
  {iso2: 'MK', name: 'North Macedonia', dialCode: '+389'},
  {iso2: 'AL', name: 'Albania', dialCode: '+355'},
  {iso2: 'ME', name: 'Montenegro', dialCode: '+382'},
  {iso2: 'EE', name: 'Estonia', dialCode: '+372'},
  {iso2: 'LV', name: 'Latvia', dialCode: '+371'},
  {iso2: 'LT', name: 'Lithuania', dialCode: '+370'},
  {iso2: 'UA', name: 'Ukraine', dialCode: '+380'},
  {iso2: 'BY', name: 'Belarus', dialCode: '+375'},
  {iso2: 'MD', name: 'Moldova', dialCode: '+373'},
  {iso2: 'RU', name: 'Russia', dialCode: '+7'},
  {iso2: 'KZ', name: 'Kazakhstan', dialCode: '+7'},
  {iso2: 'GE', name: 'Georgia', dialCode: '+995'},
  {iso2: 'AM', name: 'Armenia', dialCode: '+374'},
  {iso2: 'AZ', name: 'Azerbaijan', dialCode: '+994'},
  {iso2: 'TR', name: 'Turkey', dialCode: '+90'},
  {iso2: 'CY', name: 'Cyprus', dialCode: '+357'},
  {iso2: 'MT', name: 'Malta', dialCode: '+356'},
  {iso2: 'IL', name: 'Israel', dialCode: '+972'},
  {iso2: 'PS', name: 'Palestine', dialCode: '+970'},
  {iso2: 'JO', name: 'Jordan', dialCode: '+962'},
  {iso2: 'LB', name: 'Lebanon', dialCode: '+961'},
  {iso2: 'SY', name: 'Syria', dialCode: '+963'},
  {iso2: 'IQ', name: 'Iraq', dialCode: '+964'},
  {iso2: 'IR', name: 'Iran', dialCode: '+98'},
  {iso2: 'SA', name: 'Saudi Arabia', dialCode: '+966'},
  {iso2: 'AE', name: 'United Arab Emirates', dialCode: '+971'},
  {iso2: 'QA', name: 'Qatar', dialCode: '+974'},
  {iso2: 'BH', name: 'Bahrain', dialCode: '+973'},
  {iso2: 'KW', name: 'Kuwait', dialCode: '+965'},
  {iso2: 'OM', name: 'Oman', dialCode: '+968'},
  {iso2: 'YE', name: 'Yemen', dialCode: '+967'},
  {iso2: 'EG', name: 'Egypt', dialCode: '+20'},
  {iso2: 'LY', name: 'Libya', dialCode: '+218'},
  {iso2: 'TN', name: 'Tunisia', dialCode: '+216'},
  {iso2: 'DZ', name: 'Algeria', dialCode: '+213'},
  {iso2: 'MA', name: 'Morocco', dialCode: '+212'},
  {iso2: 'SD', name: 'Sudan', dialCode: '+249'},
  {iso2: 'ET', name: 'Ethiopia', dialCode: '+251'},
  {iso2: 'KE', name: 'Kenya', dialCode: '+254'},
  {iso2: 'TZ', name: 'Tanzania', dialCode: '+255'},
  {iso2: 'UG', name: 'Uganda', dialCode: '+256'},
  {iso2: 'RW', name: 'Rwanda', dialCode: '+250'},
  {iso2: 'GH', name: 'Ghana', dialCode: '+233'},
  {iso2: 'NG', name: 'Nigeria', dialCode: '+234'},
  {iso2: 'CI', name: "Cote d'Ivoire", dialCode: '+225'},
  {iso2: 'SN', name: 'Senegal', dialCode: '+221'},
  {iso2: 'ML', name: 'Mali', dialCode: '+223'},
  {iso2: 'CM', name: 'Cameroon', dialCode: '+237'},
  {iso2: 'CD', name: 'DR Congo', dialCode: '+243'},
  {iso2: 'CG', name: 'Congo', dialCode: '+242'},
  {iso2: 'AO', name: 'Angola', dialCode: '+244'},
  {iso2: 'ZM', name: 'Zambia', dialCode: '+260'},
  {iso2: 'ZW', name: 'Zimbabwe', dialCode: '+263'},
  {iso2: 'MZ', name: 'Mozambique', dialCode: '+258'},
  {iso2: 'NA', name: 'Namibia', dialCode: '+264'},
  {iso2: 'BW', name: 'Botswana', dialCode: '+267'},
  {iso2: 'ZA', name: 'South Africa', dialCode: '+27'},
  {iso2: 'MU', name: 'Mauritius', dialCode: '+230'},
  {iso2: 'PK', name: 'Pakistan', dialCode: '+92'},
  {iso2: 'AF', name: 'Afghanistan', dialCode: '+93'},
  {iso2: 'IN', name: 'India', dialCode: '+91'},
  {iso2: 'BD', name: 'Bangladesh', dialCode: '+880'},
  {iso2: 'LK', name: 'Sri Lanka', dialCode: '+94'},
  {iso2: 'NP', name: 'Nepal', dialCode: '+977'},
  {iso2: 'BT', name: 'Bhutan', dialCode: '+975'},
  {iso2: 'MM', name: 'Myanmar', dialCode: '+95'},
  {iso2: 'TH', name: 'Thailand', dialCode: '+66'},
  {iso2: 'LA', name: 'Laos', dialCode: '+856'},
  {iso2: 'KH', name: 'Cambodia', dialCode: '+855'},
  {iso2: 'VN', name: 'Vietnam', dialCode: '+84'},
  {iso2: 'MY', name: 'Malaysia', dialCode: '+60'},
  {iso2: 'SG', name: 'Singapore', dialCode: '+65'},
  {iso2: 'ID', name: 'Indonesia', dialCode: '+62'},
  {iso2: 'PH', name: 'Philippines', dialCode: '+63'},
  {iso2: 'BN', name: 'Brunei', dialCode: '+673'},
  {iso2: 'TL', name: 'Timor-Leste', dialCode: '+670'},
  {iso2: 'CN', name: 'China', dialCode: '+86'},
  {iso2: 'HK', name: 'Hong Kong', dialCode: '+852'},
  {iso2: 'MO', name: 'Macau', dialCode: '+853'},
  {iso2: 'TW', name: 'Taiwan', dialCode: '+886'},
  {iso2: 'JP', name: 'Japan', dialCode: '+81'},
  {iso2: 'KR', name: 'South Korea', dialCode: '+82'},
  {iso2: 'KP', name: 'North Korea', dialCode: '+850'},
  {iso2: 'MN', name: 'Mongolia', dialCode: '+976'},
  {iso2: 'UZ', name: 'Uzbekistan', dialCode: '+998'},
  {iso2: 'TM', name: 'Turkmenistan', dialCode: '+993'},
  {iso2: 'TJ', name: 'Tajikistan', dialCode: '+992'},
  {iso2: 'KG', name: 'Kyrgyzstan', dialCode: '+996'},
  {iso2: 'AU', name: 'Australia', dialCode: '+61'},
  {iso2: 'NZ', name: 'New Zealand', dialCode: '+64'},
  {iso2: 'FJ', name: 'Fiji', dialCode: '+679'},
  {iso2: 'PG', name: 'Papua New Guinea', dialCode: '+675'},
  {iso2: 'BR', name: 'Brazil', dialCode: '+55'},
  {iso2: 'AR', name: 'Argentina', dialCode: '+54'},
  {iso2: 'CL', name: 'Chile', dialCode: '+56'},
  {iso2: 'CO', name: 'Colombia', dialCode: '+57'},
  {iso2: 'PE', name: 'Peru', dialCode: '+51'},
  {iso2: 'VE', name: 'Venezuela', dialCode: '+58'},
  {iso2: 'EC', name: 'Ecuador', dialCode: '+593'},
  {iso2: 'BO', name: 'Bolivia', dialCode: '+591'},
  {iso2: 'PY', name: 'Paraguay', dialCode: '+595'},
  {iso2: 'UY', name: 'Uruguay', dialCode: '+598'},
  {iso2: 'GY', name: 'Guyana', dialCode: '+592'},
  {iso2: 'SR', name: 'Suriname', dialCode: '+597'},
  {iso2: 'PA', name: 'Panama', dialCode: '+507'},
  {iso2: 'CR', name: 'Costa Rica', dialCode: '+506'},
  {iso2: 'NI', name: 'Nicaragua', dialCode: '+505'},
  {iso2: 'HN', name: 'Honduras', dialCode: '+504'},
  {iso2: 'SV', name: 'El Salvador', dialCode: '+503'},
  {iso2: 'GT', name: 'Guatemala', dialCode: '+502'},
  {iso2: 'BZ', name: 'Belize', dialCode: '+501'},
  {iso2: 'CU', name: 'Cuba', dialCode: '+53'},
  {iso2: 'JM', name: 'Jamaica', dialCode: '+1876'},
  {iso2: 'HT', name: 'Haiti', dialCode: '+509'},
  {iso2: 'DO', name: 'Dominican Republic', dialCode: '+1809'},
  {iso2: 'TT', name: 'Trinidad and Tobago', dialCode: '+1868'},
  {iso2: 'BS', name: 'Bahamas', dialCode: '+1242'},
  {iso2: 'BB', name: 'Barbados', dialCode: '+1246'},
];
