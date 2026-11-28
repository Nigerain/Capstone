import type {
  ApiSubmitPrice,
  ApiSubmittedPrice,
  GroceryUnit,
} from '../types/api';
import type { Category } from '../types/price';
import { ApiError, apiRequest } from './api';
import { getAuthToken } from './auth';
import { recordMockSubmission } from './mockPriceService';

// Submitting has its own switch, like scanning, because the real endpoint
// isn't ready for this request yet (see ApiSubmitPrice in types/api.ts).
// Mock unless .env explicitly says false, so a missing setting never posts.
// Changing it needs a restart with a cleared cache: npx expo start -c
export const USE_MOCK_SUBMIT =
  process.env.EXPO_PUBLIC_USE_MOCK_SUBMIT !== 'false';

export type { GroceryUnit };

// Unit picker options, in the order shown. `label` is what the user sees,
// `value` is what goes to the backend.
export const GROCERY_UNITS: { value: GroceryUnit; label: string }[] = [
  { value: 'LB', label: 'lb' },
  { value: 'OZ', label: 'oz' },
  { value: 'FL_OZ', label: 'fl oz' },
  { value: 'EACH', label: 'each' },
  { value: 'PACK', label: 'pack' },
  { value: 'DOZEN', label: 'dozen' },
  { value: 'GAL', label: 'gal' },
  { value: 'QT', label: 'qt' },
  { value: 'PT', label: 'pt' },
  { value: 'L', label: 'L' },
  { value: 'ML', label: 'mL' },
  { value: 'KG', label: 'kg' },
  { value: 'G', label: 'g' },
  { value: 'LOAF', label: 'loaf' },
  { value: 'SERVING', label: 'serving' },
];

/** "LB" → "lb" */
export function unitLabel(unit: GroceryUnit | null | undefined): string {
  return GROCERY_UNITS.find((u) => u.value === unit)?.label ?? '';
}

// Ways a size can be written on a tag → backend unit
const UNIT_ALIASES: Record<string, GroceryUnit> = {
  lb: 'LB',
  lbs: 'LB',
  pound: 'LB',
  pounds: 'LB',
  oz: 'OZ',
  ounce: 'OZ',
  ounces: 'OZ',
  'fl oz': 'FL_OZ',
  floz: 'FL_OZ',
  fl_oz: 'FL_OZ',
  g: 'G',
  kg: 'KG',
  ml: 'ML',
  l: 'L',
  pt: 'PT',
  qt: 'QT',
  gal: 'GAL',
  gallon: 'GAL',
  gallons: 'GAL',
  each: 'EACH',
  ea: 'EACH',
  dozen: 'DOZEN',
  dz: 'DOZEN',
  serving: 'SERVING',
  pack: 'PACK',
  pk: 'PACK',
  ct: 'PACK',
  count: 'PACK',
  loaf: 'LOAF',
};

/**
 * OCR still reads size as one string ("1.5 lb"). Splits it into the two
 * form fields to prefill them; anything it can't read comes back null.
 */
export function splitScannedSize(value: string | null | undefined): {
  unitAmount: number | null;
  unit: GroceryUnit | null;
} {
  const match = (value ?? '')
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)\s*([a-z_ ]+?)\.?$/);
  if (!match) return { unitAmount: null, unit: null };
  const amount = Number(match[1]);
  return {
    unitAmount: amount > 0 ? amount : null,
    unit: UNIT_ALIASES[match[2].trim()] ?? null,
  };
}

// What the price form hands over, already validated by the form.
export type SubmitPriceInput = {
  itemName: string;
  brand: string;
  unitAmount: number | null; // null when no size was given
  unit: GroceryUnit | null;
  category: Category;
  storeId: string;
  price: number;
  isPublic: boolean;
};

/** Posts one price to the backend. Throws ApiError on any failure. */
export async function submitPrice(
  input: SubmitPriceInput
): Promise<ApiSubmittedPrice> {
  const body = toRequestBody(input);
  if (USE_MOCK_SUBMIT) return mockSubmit(body);

  const token = await getAuthToken();
  if (!token) throw new ApiError('Sign in is required to submit a price.', 401);

  return apiRequest<ApiSubmittedPrice>('/api/v1/prices', {
    method: 'POST',
    body,
    token,
  });
}

/** Cleans the form values into the request body the backend expects. */
export function toRequestBody(input: SubmitPriceInput): ApiSubmitPrice {
  return {
    item: {
      itemName: input.itemName.trim(),
      // Optional fields go out as null, not "", so the backend can tell
      // "not given" apart from a real value when it matches the item.
      brand: input.brand.trim() || null,
      unitAmount: input.unitAmount,
      unit: input.unit,
      category: input.category,
    },
    storeId: input.storeId,
    // Round to cents, so 1.999 typed by accident can't slip through.
    price: Math.round(input.price * 100) / 100,
    isPublic: input.isPublic,
  };
}

/** Turns a failed submit into a message for the form. Nothing was saved in any of these. */
export function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return 'Your sign-in expired. Log in again, then submit.';
    }
    if (error.status === 422 || error.status === 400) {
      return 'The server didn’t accept these details. Check them and try again.';
    }
    if (error.status === 429) {
      return 'You’ve submitted a lot of prices today. Try again later.';
    }
    if (error.status === 0) {
      return 'Couldn’t reach the server. Check your connection and try again.';
    }
  }
  return 'Something went wrong on our end, so your price wasn’t saved. Try again.';
}

/** True when the fix is logging in again, so the form can offer a Log in button. */
export const isAuthError = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

// ---------------------------------------------------------------------------
// Mock mode. Every submit succeeds, unless the item name is one of these,
// so each error message can be tested (like taken@example.com for sign up):
//   TEST 401 · TEST 422 · TEST 429 · TEST 500 · TEST OFFLINE
// ---------------------------------------------------------------------------

const MOCK_ERRORS: Record<string, number> = {
  'test 401': 401,
  'test 422': 422,
  'test 429': 429,
  'test 500': 500,
  'test offline': 0,
};

async function mockSubmit(body: ApiSubmitPrice): Promise<ApiSubmittedPrice> {
  // Long enough to see the spinner on the submit button.
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (__DEV__) console.log('[submitPrice] mock submit', body);

  const status = MOCK_ERRORS[body.item.itemName.toLowerCase()];
  if (status !== undefined)
    throw new ApiError(`mock: submit failed (${status})`, status);

  // Stand-in for the backend: adds the price to a matching mock item, or
  // creates a new item in the chosen category, so it shows up on that
  // category screen and "View item" on Price Posted opens it.
  const itemId = recordMockSubmission(body, unitLabel(body.item.unit));

  return {
    id: `mock-price-${Date.now()}`,
    itemId,
    storeId: body.storeId,
    userId: 'mock-user',
    price: body.price,
    dateRecorded: new Date().toISOString().slice(0, 10),
    isPublic: body.isPublic,
  };
}
