// Compact country quick-facts for the trip segment widget.
// Keyed by ISO-3166-1 alpha-2. Not exhaustive — covers the destinations
// most users pass through. Missing entries fall back to a safe default.

export interface QuickFact {
  hello: string;
  thanks: string;
  please: string;
  howMuch: string;
  tipping: string;       // e.g. "10-15% expected at restaurants"
  plug: string;          // Type letters, e.g. "A/B" or "C/F"
  voltage: string;       // e.g. "220V 50Hz"
  emergency: string;     // unified emergency number
  driveSide: 'left' | 'right';
}

export const DEFAULT_FACT: QuickFact = {
  hello: 'Hello',
  thanks: 'Thank you',
  please: 'Please',
  howMuch: 'How much?',
  tipping: 'Rounding up is appreciated.',
  plug: 'See locally',
  voltage: '—',
  emergency: '112',
  driveSide: 'right',
};

export const COUNTRY_FACTS: Record<string, QuickFact> = {
  FR: { hello: 'Bonjour', thanks: 'Merci', please: "S'il vous plaît", howMuch: 'Combien ?', tipping: 'Service included; round up for good service.', plug: 'C/E', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  DE: { hello: 'Hallo', thanks: 'Danke', please: 'Bitte', howMuch: 'Wie viel?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  ES: { hello: 'Hola', thanks: 'Gracias', please: 'Por favor', howMuch: '¿Cuánto?', tipping: 'Not expected; round up is fine.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  IT: { hello: 'Ciao', thanks: 'Grazie', please: 'Per favore', howMuch: 'Quanto?', tipping: 'Coperto often added; 5-10% extra is generous.', plug: 'C/F/L', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  NL: { hello: 'Hallo', thanks: 'Dank je', please: 'Alstublieft', howMuch: 'Hoeveel?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  BE: { hello: 'Bonjour / Hallo', thanks: 'Merci / Dank je', please: "S'il vous plaît / Alstublieft", howMuch: 'Combien ? / Hoeveel?', tipping: 'Service included; round up.', plug: 'C/E', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  PT: { hello: 'Olá', thanks: 'Obrigado/a', please: 'Por favor', howMuch: 'Quanto custa?', tipping: 'Not expected; 5-10% for great service.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  GR: { hello: 'Yassas', thanks: 'Efharistó', please: 'Parakaló', howMuch: 'Póso káni?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  GB: { hello: 'Hello', thanks: 'Thank you', please: 'Please', howMuch: 'How much?', tipping: '10-15% at restaurants unless service included.', plug: 'G', voltage: '230V 50Hz', emergency: '999', driveSide: 'left' },
  IE: { hello: 'Hello / Dia duit', thanks: 'Thanks / Go raibh maith agat', please: 'Please', howMuch: 'How much?', tipping: '10-12% at restaurants.', plug: 'G', voltage: '230V 50Hz', emergency: '112', driveSide: 'left' },
  US: { hello: 'Hello', thanks: 'Thank you', please: 'Please', howMuch: 'How much?', tipping: '18-20% expected at sit-down restaurants.', plug: 'A/B', voltage: '120V 60Hz', emergency: '911', driveSide: 'right' },
  CA: { hello: 'Hello / Bonjour', thanks: 'Thank you / Merci', please: 'Please', howMuch: 'How much?', tipping: '15-20% at restaurants.', plug: 'A/B', voltage: '120V 60Hz', emergency: '911', driveSide: 'right' },
  MX: { hello: 'Hola', thanks: 'Gracias', please: 'Por favor', howMuch: '¿Cuánto cuesta?', tipping: '10-15% at restaurants.', plug: 'A/B', voltage: '127V 60Hz', emergency: '911', driveSide: 'right' },
  BR: { hello: 'Oi', thanks: 'Obrigado/a', please: 'Por favor', howMuch: 'Quanto custa?', tipping: '10% often included; leave extra if exceptional.', plug: 'C/N', voltage: '127/220V 60Hz', emergency: '190', driveSide: 'right' },
  AR: { hello: 'Hola', thanks: 'Gracias', please: 'Por favor', howMuch: '¿Cuánto?', tipping: '10% at restaurants.', plug: 'C/I', voltage: '220V 50Hz', emergency: '911', driveSide: 'right' },
  JP: { hello: 'Konnichiwa', thanks: 'Arigatō', please: 'Onegaishimasu', howMuch: 'Ikura desu ka?', tipping: 'Not expected — can be seen as rude.', plug: 'A/B', voltage: '100V 50/60Hz', emergency: '110 (police) / 119 (fire/amb.)', driveSide: 'left' },
  KR: { hello: 'Annyeonghaseyo', thanks: 'Gamsahamnida', please: 'Juseyo', howMuch: 'Eolmayeyo?', tipping: 'Not expected.', plug: 'C/F', voltage: '220V 60Hz', emergency: '112 (police) / 119 (fire/amb.)', driveSide: 'right' },
  CN: { hello: 'Nǐ hǎo', thanks: 'Xièxie', please: 'Qǐng', howMuch: 'Duōshǎo qián?', tipping: 'Not expected.', plug: 'A/C/I', voltage: '220V 50Hz', emergency: '110 (police) / 120 (med)', driveSide: 'right' },
  TH: { hello: 'Sawadee', thanks: 'Khop khun', please: 'Karuna', howMuch: 'Tâo rai?', tipping: 'Round up; 10% at nicer restaurants.', plug: 'A/B/C', voltage: '220V 50Hz', emergency: '191 (police) / 1669 (med)', driveSide: 'left' },
  VN: { hello: 'Xin chào', thanks: 'Cảm ơn', please: 'Làm ơn', howMuch: 'Bao nhiêu?', tipping: 'Not expected; appreciated at tourist spots.', plug: 'A/C', voltage: '220V 50Hz', emergency: '113 (police) / 115 (med)', driveSide: 'right' },
  ID: { hello: 'Halo', thanks: 'Terima kasih', please: 'Tolong', howMuch: 'Berapa?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '110 (police) / 118 (med)', driveSide: 'left' },
  IN: { hello: 'Namaste', thanks: 'Dhanyavaad', please: 'Kripya', howMuch: 'Kitna hua?', tipping: '10% at restaurants.', plug: 'C/D/M', voltage: '230V 50Hz', emergency: '112', driveSide: 'left' },
  AU: { hello: 'Hello', thanks: 'Thanks', please: 'Please', howMuch: 'How much?', tipping: 'Not expected; 10% for great service.', plug: 'I', voltage: '230V 50Hz', emergency: '000', driveSide: 'left' },
  NZ: { hello: 'Hello / Kia ora', thanks: 'Thanks', please: 'Please', howMuch: 'How much?', tipping: 'Not expected.', plug: 'I', voltage: '230V 50Hz', emergency: '111', driveSide: 'left' },
  CH: { hello: 'Grüezi', thanks: 'Danke', please: 'Bitte', howMuch: 'Wie viel?', tipping: 'Round up; service usually included.', plug: 'C/J', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  AT: { hello: 'Hallo', thanks: 'Danke', please: 'Bitte', howMuch: 'Wie viel?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  SE: { hello: 'Hej', thanks: 'Tack', please: 'Snälla', howMuch: 'Hur mycket?', tipping: 'Not expected; round up.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  NO: { hello: 'Hei', thanks: 'Takk', please: 'Vær så snill', howMuch: 'Hvor mye?', tipping: 'Round up; 10% for great service.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  DK: { hello: 'Hej', thanks: 'Tak', please: 'Venligst', howMuch: 'Hvor meget?', tipping: 'Not expected.', plug: 'C/E/F/K', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  AE: { hello: 'Marhaba', thanks: 'Shukran', please: 'Min fadlak', howMuch: 'Kam?', tipping: '10% at restaurants.', plug: 'G', voltage: '230V 50Hz', emergency: '999', driveSide: 'right' },
  TR: { hello: 'Merhaba', thanks: 'Teşekkürler', please: 'Lütfen', howMuch: 'Ne kadar?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right' },
  EG: { hello: 'Ahlan', thanks: 'Shukran', please: 'Min fadlak', howMuch: 'Bekam?', tipping: '10% at restaurants; baksheesh for service.', plug: 'C/F', voltage: '220V 50Hz', emergency: '122 (police) / 123 (med)', driveSide: 'right' },
  MA: { hello: 'Salam', thanks: 'Shukran', please: 'Min fadlak', howMuch: 'Bshhal?', tipping: '10% at restaurants.', plug: 'C/E', voltage: '220V 50Hz', emergency: '190 (police) / 15 (med)', driveSide: 'right' },
  ZA: { hello: 'Hello / Sawubona', thanks: 'Thanks / Ngiyabonga', please: 'Please', howMuch: 'How much?', tipping: '10-15% at restaurants.', plug: 'M/N', voltage: '230V 50Hz', emergency: '10111 (police) / 10177 (med)', driveSide: 'left' },
};

export function factsFor(countryNameOrCode: string | null | undefined): QuickFact {
  if (!countryNameOrCode) return DEFAULT_FACT;
  const norm = countryNameOrCode.trim().toUpperCase();
  if (COUNTRY_FACTS[norm]) return COUNTRY_FACTS[norm];
  // Case: AI pipeline stores full names; try a small name → code map.
  const NAME_TO_CODE: Record<string, string> = {
    FRANCE: 'FR', GERMANY: 'DE', SPAIN: 'ES', ITALY: 'IT', NETHERLANDS: 'NL',
    BELGIUM: 'BE', PORTUGAL: 'PT', GREECE: 'GR',
    'UNITED KINGDOM': 'GB', UK: 'GB', ENGLAND: 'GB', SCOTLAND: 'GB', WALES: 'GB',
    IRELAND: 'IE',
    'UNITED STATES': 'US', USA: 'US', AMERICA: 'US',
    CANADA: 'CA', MEXICO: 'MX', BRAZIL: 'BR', ARGENTINA: 'AR',
    JAPAN: 'JP', 'SOUTH KOREA': 'KR', KOREA: 'KR', CHINA: 'CN', THAILAND: 'TH',
    VIETNAM: 'VN', INDONESIA: 'ID', INDIA: 'IN', AUSTRALIA: 'AU', 'NEW ZEALAND': 'NZ',
    SWITZERLAND: 'CH', AUSTRIA: 'AT', SWEDEN: 'SE', NORWAY: 'NO', DENMARK: 'DK',
    'UNITED ARAB EMIRATES': 'AE', UAE: 'AE', TURKEY: 'TR',
    EGYPT: 'EG', MOROCCO: 'MA', 'SOUTH AFRICA': 'ZA',
  };
  const code = NAME_TO_CODE[norm];
  if (code && COUNTRY_FACTS[code]) return COUNTRY_FACTS[code];
  return DEFAULT_FACT;
}
