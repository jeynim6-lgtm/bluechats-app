export interface Country {
  iso: string;
  name: string;
  dial: string; // including "+"
  flag: string;
}

export const COUNTRIES: Country[] = [
  { iso: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
  { iso: 'ZW', name: 'Zimbabwe', dial: '+263', flag: '🇿🇼' },
  { iso: 'MZ', name: 'Mozambique', dial: '+258', flag: '🇲🇿' },
  { iso: 'BW', name: 'Botswana', dial: '+267', flag: '🇧🇼' },
  { iso: 'NA', name: 'Namibia', dial: '+264', flag: '🇳🇦' },
  { iso: 'LS', name: 'Lesotho', dial: '+266', flag: '🇱🇸' },
  { iso: 'SZ', name: 'Eswatini', dial: '+268', flag: '🇸🇿' },
  { iso: 'ZM', name: 'Zambia', dial: '+260', flag: '🇿🇲' },
  { iso: 'MW', name: 'Malawi', dial: '+265', flag: '🇲🇼' },
  { iso: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { iso: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪' },
  { iso: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭' },
  { iso: 'TZ', name: 'Tanzania', dial: '+255', flag: '🇹🇿' },
  { iso: 'UG', name: 'Uganda', dial: '+256', flag: '🇺🇬' },
  { iso: 'RW', name: 'Rwanda', dial: '+250', flag: '🇷🇼' },
  { iso: 'ET', name: 'Ethiopia', dial: '+251', flag: '🇪🇹' },
  { iso: 'SN', name: 'Senegal', dial: '+221', flag: '🇸🇳' },
  { iso: 'CM', name: 'Cameroon', dial: '+237', flag: '🇨🇲' },
  { iso: 'CD', name: 'DR Congo', dial: '+243', flag: '🇨🇩' },
  { iso: 'AO', name: 'Angola', dial: '+244', flag: '🇦🇴' },
  { iso: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
  { iso: 'MA', name: 'Morocco', dial: '+212', flag: '🇲🇦' },
  { iso: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { iso: 'US', name: 'United States / Canada', dial: '+1', flag: '🇺🇸' },
  { iso: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { iso: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
  { iso: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { iso: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { iso: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
  { iso: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { iso: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

/**
 * Converts user input to E.164 (e.g. "082 123 4567" with +27 → "+27821234567").
 * Returns null when the result cannot be a valid international number.
 */
export function toE164(input: string, dialCode: string = DEFAULT_COUNTRY.dial): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  let e164: string;
  if (trimmed.startsWith('+')) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('00')) {
    e164 = `+${digits.slice(2)}`;
  } else {
    // Drop the national trunk prefix ("0" in most of Africa and Europe).
    if (digits.startsWith('0')) digits = digits.slice(1);
    const dialDigits = dialCode.replace(/\D/g, '');
    e164 = digits.startsWith(dialDigits) && digits.length > dialDigits.length + 6 ? `+${digits}` : `+${dialDigits}${digits}`;
  }

  const total = e164.length - 1;
  return total >= 8 && total <= 15 ? e164 : null;
}

export function countryForNumber(e164: string): Country | undefined {
  return [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => e164.startsWith(c.dial));
}

/** Light grouping for display: +27 82 123 4567 */
export function formatPhone(e164: string): string {
  const country = countryForNumber(e164);
  if (!country) return e164;
  const rest = e164.slice(country.dial.length);
  const groups = rest.length > 7 ? [rest.slice(0, 2), rest.slice(2, 5), rest.slice(5)] : [rest.slice(0, 3), rest.slice(3)];
  return `${country.dial} ${groups.filter(Boolean).join(' ')}`;
}
