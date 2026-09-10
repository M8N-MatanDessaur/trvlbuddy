// Compact country quick-facts.
//
// Keyed by ISO-3166-1 alpha-2, and not exhaustive: it covers the destinations
// most people pass through, and anything missing falls back to a safe default.
//
// Bundled rather than fetched. These change on the scale of decades, the
// answer is wanted at an airport with no signal, and asking a model costs
// money and invents the entries it does not know.

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
  // Left out rather than guessed at where it genuinely varies: a missing line
  // reads as "look it up", a wrong one reads as "you drank the tap water".
  water?: 'safe' | 'caution' | 'avoid';
  transit?: string;      // the card, or how a ride is usually paid for
}

export const DEFAULT_FACT: QuickFact = {
  hello: 'Hello',
  thanks: 'Thank you',
  please: 'Please',
  howMuch: 'How much?',
  tipping: 'Rounding up is appreciated.',
  plug: 'See locally',
  voltage: 'Varies',
  emergency: '112',
  driveSide: 'right',
};

export const COUNTRY_FACTS: Record<string, QuickFact> = {
  FR: { hello: 'Bonjour', thanks: 'Merci', please: "S'il vous plaît", howMuch: 'Combien ?', tipping: 'Service included; round up for good service.', plug: 'C/E', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe', transit: 'Navigo in Paris, or contactless on most buses and metros.' },
  DE: { hello: 'Hallo', thanks: 'Danke', please: 'Bitte', howMuch: 'Wie viel?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe', transit: 'The Deutschlandticket covers regional transport nationwide.' },
  ES: { hello: 'Hola', thanks: 'Gracias', please: 'Por favor', howMuch: '¿Cuánto?', tipping: 'Not expected; round up is fine.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe', transit: 'Multi-trip metro tickets cost far less than singles.' },
  IT: { hello: 'Ciao', thanks: 'Grazie', please: 'Per favore', howMuch: 'Quanto?', tipping: 'Coperto often added; 5-10% extra is generous.', plug: 'C/F/L', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe', transit: 'Validate the ticket before boarding or it is a fine.' },
  NL: { hello: 'Hallo', thanks: 'Dank je', please: 'Alstublieft', howMuch: 'Hoeveel?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe', transit: 'OV-chipkaart, or tap a contactless card.' },
  BE: { hello: 'Bonjour / Hallo', thanks: 'Merci / Dank je', please: "S'il vous plaît / Alstublieft", howMuch: 'Combien ? / Hoeveel?', tipping: 'Service included; round up.', plug: 'C/E', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe' },
  PT: { hello: 'Olá', thanks: 'Obrigado/a', please: 'Por favor', howMuch: 'Quanto custa?', tipping: 'Not expected; 5-10% for great service.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe', transit: 'Viva Viagem in Lisbon, Andante in Porto.' },
  GR: { hello: 'Yassas', thanks: 'Efharistó', please: 'Parakaló', howMuch: 'Póso káni?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'caution' },
  GB: { hello: 'Hello', thanks: 'Thank you', please: 'Please', howMuch: 'How much?', tipping: '10-15% at restaurants unless service included.', plug: 'G', voltage: '230V 50Hz', emergency: '999', driveSide: 'left', water: 'safe', transit: 'Tap a contactless card in London and it caps your daily fare.' },
  IE: { hello: 'Hello / Dia duit', thanks: 'Thanks / Go raibh maith agat', please: 'Please', howMuch: 'How much?', tipping: '10-12% at restaurants.', plug: 'G', voltage: '230V 50Hz', emergency: '112', driveSide: 'left', water: 'safe', transit: 'Leap card in Dublin.' },
  US: { hello: 'Hello', thanks: 'Thank you', please: 'Please', howMuch: 'How much?', tipping: '18-20% expected at sit-down restaurants.', plug: 'A/B', voltage: '120V 60Hz', emergency: '911', driveSide: 'right', water: 'safe', transit: 'Contactless card or phone on most city systems.' },
  CA: { hello: 'Hello / Bonjour', thanks: 'Thank you / Merci', please: 'Please', howMuch: 'How much?', tipping: '15-20% at restaurants.', plug: 'A/B', voltage: '120V 60Hz', emergency: '911', driveSide: 'right', water: 'safe', transit: 'Presto in Toronto, Opus in Montreal, Compass in Vancouver.' },
  MX: { hello: 'Hola', thanks: 'Gracias', please: 'Por favor', howMuch: '¿Cuánto cuesta?', tipping: '10-15% at restaurants.', plug: 'A/B', voltage: '127V 60Hz', emergency: '911', driveSide: 'right', water: 'avoid', transit: 'Metro fares are cash or a rechargeable card.' },
  BR: { hello: 'Oi', thanks: 'Obrigado/a', please: 'Por favor', howMuch: 'Quanto custa?', tipping: '10% often included; leave extra if exceptional.', plug: 'C/N', voltage: '127/220V 60Hz', emergency: '190', driveSide: 'right', water: 'caution', transit: 'Bilhete Unico in Sao Paulo, contactless in Rio.' },
  AR: { hello: 'Hola', thanks: 'Gracias', please: 'Por favor', howMuch: '¿Cuánto?', tipping: '10% at restaurants.', plug: 'C/I', voltage: '220V 50Hz', emergency: '911', driveSide: 'right', water: 'safe', transit: 'SUBE card for buses, metro and trains.' },
  JP: { hello: 'Konnichiwa', thanks: 'Arigatō', please: 'Onegaishimasu', howMuch: 'Ikura desu ka?', tipping: 'Not expected, can be seen as rude.', plug: 'A/B', voltage: '100V 50/60Hz', emergency: '110 (police) / 119 (fire/amb.)', driveSide: 'left', water: 'safe', transit: 'Suica or Pasmo, and they work in convenience stores too.' },
  KR: { hello: 'Annyeonghaseyo', thanks: 'Gamsahamnida', please: 'Juseyo', howMuch: 'Eolmayeyo?', tipping: 'Not expected.', plug: 'C/F', voltage: '220V 60Hz', emergency: '112 (police) / 119 (fire/amb.)', driveSide: 'right', water: 'caution', transit: 'T-money card, sold in any convenience store.' },
  CN: { hello: 'Nǐ hǎo', thanks: 'Xièxie', please: 'Qǐng', howMuch: 'Duōshǎo qián?', tipping: 'Not expected.', plug: 'A/C/I', voltage: '220V 50Hz', emergency: '110 (police) / 120 (med)', driveSide: 'right', water: 'avoid', transit: 'Pay by phone, Alipay or WeChat, almost everywhere.' },
  TH: { hello: 'Sawadee', thanks: 'Khop khun', please: 'Karuna', howMuch: 'Tâo rai?', tipping: 'Round up; 10% at nicer restaurants.', plug: 'A/B/C', voltage: '220V 50Hz', emergency: '191 (police) / 1669 (med)', driveSide: 'left', water: 'avoid', transit: 'Rabbit card for the Bangkok BTS.' },
  VN: { hello: 'Xin chào', thanks: 'Cảm ơn', please: 'Làm ơn', howMuch: 'Bao nhiêu?', tipping: 'Not expected; appreciated at tourist spots.', plug: 'A/C', voltage: '220V 50Hz', emergency: '113 (police) / 115 (med)', driveSide: 'right', water: 'avoid' },
  ID: { hello: 'Halo', thanks: 'Terima kasih', please: 'Tolong', howMuch: 'Berapa?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '110 (police) / 118 (med)', driveSide: 'left', water: 'avoid' },
  IN: { hello: 'Namaste', thanks: 'Dhanyavaad', please: 'Kripya', howMuch: 'Kitna hua?', tipping: '10% at restaurants.', plug: 'C/D/M', voltage: '230V 50Hz', emergency: '112', driveSide: 'left', water: 'avoid', transit: 'Metro smart cards in the big cities.' },
  AU: { hello: 'Hello', thanks: 'Thanks', please: 'Please', howMuch: 'How much?', tipping: 'Not expected; 10% for great service.', plug: 'I', voltage: '230V 50Hz', emergency: '000', driveSide: 'left', water: 'safe', transit: 'Opal in Sydney, Myki in Melbourne, or tap a bank card.' },
  NZ: { hello: 'Hello / Kia ora', thanks: 'Thanks', please: 'Please', howMuch: 'How much?', tipping: 'Not expected.', plug: 'I', voltage: '230V 50Hz', emergency: '111', driveSide: 'left', water: 'safe', transit: 'AT HOP card in Auckland.' },
  CH: { hello: 'Grüezi', thanks: 'Danke', please: 'Bitte', howMuch: 'Wie viel?', tipping: 'Round up; service usually included.', plug: 'C/J', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe', transit: 'A Swiss Travel Pass covers trains, buses and boats.' },
  AT: { hello: 'Hallo', thanks: 'Danke', please: 'Bitte', howMuch: 'Wie viel?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe' },
  SE: { hello: 'Hej', thanks: 'Tack', please: 'Snälla', howMuch: 'Hur mycket?', tipping: 'Not expected; round up.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe', transit: 'Cash is rare here; card works almost everywhere.' },
  NO: { hello: 'Hei', thanks: 'Takk', please: 'Vær så snill', howMuch: 'Hvor mye?', tipping: 'Round up; 10% for great service.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe' },
  DK: { hello: 'Hej', thanks: 'Tak', please: 'Venligst', howMuch: 'Hvor meget?', tipping: 'Not expected.', plug: 'C/E/F/K', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'safe', transit: 'Rejsekort, or the DOT app.' },
  AE: { hello: 'Marhaba', thanks: 'Shukran', please: 'Min fadlak', howMuch: 'Kam?', tipping: '10% at restaurants.', plug: 'G', voltage: '230V 50Hz', emergency: '999', driveSide: 'right', water: 'caution', transit: 'Nol card in Dubai.' },
  TR: { hello: 'Merhaba', thanks: 'Teşekkürler', please: 'Lütfen', howMuch: 'Ne kadar?', tipping: '5-10% at restaurants.', plug: 'C/F', voltage: '230V 50Hz', emergency: '112', driveSide: 'right', water: 'avoid', transit: 'Istanbulkart in Istanbul, and it works on the ferries.' },
  EG: { hello: 'Ahlan', thanks: 'Shukran', please: 'Min fadlak', howMuch: 'Bekam?', tipping: '10% at restaurants; baksheesh for service.', plug: 'C/F', voltage: '220V 50Hz', emergency: '122 (police) / 123 (med)', driveSide: 'right', water: 'avoid' },
  MA: { hello: 'Salam', thanks: 'Shukran', please: 'Min fadlak', howMuch: 'Bshhal?', tipping: '10% at restaurants.', plug: 'C/E', voltage: '220V 50Hz', emergency: '190 (police) / 15 (med)', driveSide: 'right', water: 'avoid' },
  ZA: { hello: 'Hello / Sawubona', thanks: 'Thanks / Ngiyabonga', please: 'Please', howMuch: 'How much?', tipping: '10-15% at restaurants.', plug: 'M/N', voltage: '230V 50Hz', emergency: '10111 (police) / 10177 (med)', driveSide: 'left', water: 'caution' },
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
