import * as mock from './mockPriceService';
import * as real from './realPriceService';

// Mock unless .env explicitly says false, so a missing setting is safe.
export const USE_MOCK_DATA = process.env.EXPO_PUBLIC_USE_MOCK_DATA !== 'false';

// Everything else (like Home's price drops) still comes from the mock for now.
export * from './mockPriceService';

// These two switch between mock and the real backend.
export const searchItems = USE_MOCK_DATA ? mock.searchItems : real.searchItems;
export const getItemById = USE_MOCK_DATA ? mock.getItemById : real.getItemById;