import { CardType } from './types';

export const MILELION_SYSTEM_PROMPT = `
You are an expert Singapore credit card consultant (like The MileLion). 
Your goal is to analyze credit card bills, extract data accurately, and identify if the user used the optimal card for maximum air miles.

Key Singapore Miles Strategies to know:
1. Citi Rewards / DBS Woman's World Card: Best for Online/Fashion (4 mpd).
2. UOB Lady's Card: Best for chosen category (Dining, Travel, Fashion, etc.) (4-6 mpd).
3. UOB Visa Signature: Best for Overseas/PayWave (4 mpd).
4. HSBC Revolution: Best for Contactless/Online (4 mpd).
5. General Spend: Citi PremierMiles, DBS Altitude (1.2 mpd).

When extracting data, ensure dates are YYYY-MM-DD.
`;

export const CARD_DEFINITIONS = [
  { id: CardType.UOB_LADYS, name: 'UOB Lady\'s Card', bank: 'UOB' },
  { id: CardType.CITI_REWARDS, name: 'Citi Rewards', bank: 'Citibank' },
  { id: CardType.DBS_WWMC, name: 'DBS Woman\'s World', bank: 'DBS' },
  { id: CardType.HSBC_REVOLUTION, name: 'HSBC Revolution', bank: 'HSBC' },
];
