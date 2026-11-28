import type { Category, Item } from '../types/price';

// One place for everything about categories:
//   - the five categories, in the order Home and the price form show them
//   - each category's subcategories (the shelves on the category screen)
//   - keywords that sort an item onto a shelf by its name
//
// The same keywords also suggest a category on the price form
// ("Whole Milk" → Dairy), so a fix here helps both screens.
//
// Matching rule: the LONGEST keyword that appears in the item name wins,
// so "Oat Milk" goes to Plant-Based Milk ("oat milk") instead of Milk ("milk"),
// and "Cream Cheese" goes to Cottage & Soft Cheese instead of Cheese.
// Keywords match whole words, with plurals: "egg" matches "Eggs" but not
// "Eggplant", and "strawberry" matches "Strawberries".
//
// When the backend stores a real subcategory per item, only
// groupIntoShelves() needs to change; the screens stay the same.

export const CATEGORIES: Category[] = ['Dairy', 'Meat', 'Produce', 'Pantry', 'Frozen'];

export type Subcategory = {
  name: string;
  keywords: string[];
};

// Display order = the order in the Figma "Category Screen" frames.
export const SUBCATEGORIES: Record<Category, Subcategory[]> = {
  Dairy: [
    { name: 'Milk', keywords: ['milk', 'buttermilk', 'whole milk', 'skim milk'] },
    { name: 'Eggs', keywords: ['egg', 'egg white'] },
    {
      name: 'Cheese',
      keywords: ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'swiss', 'feta', 'brie', 'provolone', 'pepper jack', 'string cheese'],
    },
    { name: 'Yogurt', keywords: ['yogurt', 'yoghurt', 'skyr'] },
    { name: 'Butter & Margarine', keywords: ['butter', 'margarine', 'ghee'] },
    { name: 'Cream & Creamers', keywords: ['cream', 'creamer', 'heavy cream', 'half & half', 'half and half'] },
    {
      name: 'Plant-Based Milk',
      keywords: ['oat milk', 'oatmilk', 'almond milk', 'soy milk', 'coconut milk', 'cashew milk', 'plant milk', 'pea milk'],
    },
    { name: 'Sour Cream & Dips', keywords: ['sour cream', 'dip', 'tzatziki', 'guacamole', 'queso'] },
    { name: 'Cottage & Soft Cheese', keywords: ['cottage cheese', 'ricotta', 'cream cheese', 'mascarpone'] },
    { name: 'Kefir & Probiotic Drinks', keywords: ['kefir', 'lassi', 'probiotic', 'yakult'] },
  ],
  Meat: [
    { name: 'Chicken', keywords: ['chicken', 'wing', 'drumstick', 'thigh', 'tenderloins'] },
    {
      name: 'Beef',
      keywords: ['beef', 'steak', 'ribeye', 'sirloin', 'brisket', 'short rib', 'chuck roast', 'ground beef'],
    },
    { name: 'Pork', keywords: ['pork', 'pork chop', 'baby back ribs', 'spare ribs'] },
    { name: 'Turkey', keywords: ['turkey', 'ground turkey'] },
    {
      name: 'Fish & Seafood',
      keywords: ['fish', 'salmon', 'shrimp', 'tilapia', 'cod', 'tuna', 'crab', 'scallop', 'swai', 'lobster'],
    },
    { name: 'Bacon', keywords: ['bacon', 'turkey bacon'] },
    {
      name: 'Sausage & Hot Dogs',
      keywords: ['sausage', 'chicken sausage', 'hot dog', 'frank', 'kielbasa', 'chorizo', 'bratwurst', 'andouille'],
    },
    {
      name: 'Deli Meat',
      keywords: ['deli', 'salami', 'ham', 'pepperoni', 'prosciutto', 'bologna', 'roast beef', 'sliced turkey', 'smoked turkey'],
    },
    { name: 'Lamb & Veal', keywords: ['lamb', 'veal'] },
    {
      name: 'Plant-Based Protein',
      keywords: ['tofu', 'tempeh', 'seitan', 'beyond burger', 'impossible burger', 'plant-based', 'veggie burger'],
    },
  ],
  Produce: [
    {
      name: 'Fresh Fruit',
      keywords: ['apple', 'banana', 'grape', 'pineapple', 'mango', 'pear', 'watermelon', 'peach', 'kiwi', 'plum', 'melon', 'cantaloupe'],
    },
    {
      name: 'Fresh Vegetables',
      keywords: ['broccoli', 'carrot', 'cucumber', 'green bean', 'zucchini', 'celery', 'cauliflower', 'corn', 'asparagus', 'brussels sprout', 'cabbage', 'eggplant', 'squash'],
    },
    {
      name: 'Berries',
      keywords: ['berry', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cherry', 'cranberry'],
    },
    {
      name: 'Salads & Greens',
      keywords: ['lettuce', 'spinach', 'spring mix', 'kale', 'arugula', 'romaine', 'salad', 'greens', 'collard'],
    },
    { name: 'Citrus', keywords: ['orange', 'lemon', 'lime', 'clementine', 'grapefruit', 'mandarin', 'tangerine'] },
    { name: 'Potatoes & Onions', keywords: ['potato', 'sweet potato', 'onion', 'garlic', 'shallot', 'scallion'] },
    { name: 'Tomatoes & Peppers', keywords: ['tomato', 'pepper', 'jalapeño', 'jalapeno', 'chili pepper'] },
    { name: 'Fresh Herbs', keywords: ['cilantro', 'parsley', 'basil', 'mint', 'rosemary', 'dill', 'thyme', 'ginger', 'chive'] },
    { name: 'Mushrooms', keywords: ['mushroom', 'portobello', 'shiitake', 'cremini', 'baby bella', 'enoki'] },
    {
      name: 'Cut Fruit & Veggies',
      keywords: ['cut fruit', 'fruit medley', 'chunks', 'spears', 'veggie tray', 'baby carrot', 'celery sticks', 'spirals'],
    },
  ],
  Pantry: [
    { name: 'Rice & Grains', keywords: ['rice', 'quinoa', 'oat', 'couscous', 'barley', 'farro', 'grain'] },
    {
      name: 'Pasta & Sauce',
      keywords: ['pasta', 'spaghetti', 'penne', 'macaroni', 'rigatoni', 'lasagna', 'noodle', 'marinara', 'pasta sauce', 'alfredo sauce', 'pesto', 'mac & cheese'],
    },
    {
      name: 'Canned Goods',
      keywords: ['canned', 'soup', 'diced tomato', 'tomato paste', 'crushed tomato', 'tomato sauce', 'canned tuna'],
    },
    { name: 'Beans', keywords: ['bean', 'black bean', 'chickpea', 'lentil'] },
    {
      name: 'Cereal & Breakfast',
      keywords: ['cereal', 'cheerio', 'flakes', 'granola', 'oatmeal', 'pancake mix', 'syrup', 'toast crunch'],
    },
    {
      name: 'Snacks & Chips',
      keywords: ['chip', 'pretzel', 'popcorn', 'cracker', 'cheez-it', 'goldfish', 'trail mix', 'rice cake', 'cookie'],
    },
    {
      name: 'Baking',
      keywords: ['flour', 'sugar', 'baking soda', 'baking powder', 'yeast', 'chocolate chip', 'vanilla extract', 'cake mix', 'brownie mix'],
    },
    { name: 'Oils & Vinegar', keywords: ['oil', 'olive oil', 'vinegar', 'cooking spray'] },
    {
      name: 'Condiments',
      keywords: ['ketchup', 'mayo', 'mayonnaise', 'mustard', 'hot sauce', 'soy sauce', 'bbq sauce', 'dressing', 'sriracha', 'sofrito', 'pickle', 'salsa', 'peanut butter', 'jelly', 'jam', 'honey'],
    },
    {
      name: 'Spices & Seasonings',
      keywords: ['salt', 'black pepper', 'adobo', 'sazon', 'sazón', 'cinnamon', 'cumin', 'paprika', 'seasoning', 'garlic powder', 'chili powder', 'spice'],
    },
  ],
  Frozen: [
    {
      name: 'Frozen Meals',
      keywords: ['frozen meal', 'bowl', 'entree', 'pot pie', 'burrito', 'chicken alfredo', 'tv dinner', 'salisbury steak'],
    },
    { name: 'Pizza', keywords: ['pizza', 'pizza rolls', 'frozen pizza'] },
    {
      name: 'Frozen Vegetables',
      keywords: ['frozen vegetable', 'mixed vegetables', 'broccoli', 'peas', 'corn', 'spinach', 'green bean', 'edamame', 'riced cauliflower', 'stir-fry', 'brussels sprout'],
    },
    {
      name: 'Frozen Fruit',
      keywords: ['frozen fruit', 'strawberry', 'blueberry', 'mixed berries', 'mango chunks', 'smoothie', 'acai', 'açaí', 'cherry'],
    },
    { name: 'Ice Cream', keywords: ['ice cream', 'gelato', 'sorbet', 'popsicle', 'fruit bar', 'ice cream sandwich'] },
    {
      name: 'Frozen Breakfast',
      keywords: ['waffle', 'frozen pancake', 'breakfast sandwich', 'breakfast burrito', 'french toast', 'toaster strudel', 'egg bites'],
    },
    {
      name: 'Frozen Meat & Seafood',
      keywords: ['nugget', 'fish stick', 'frozen shrimp', 'breaded shrimp', 'frozen chicken', 'burger patties', 'meatball', 'popcorn chicken'],
    },
    {
      name: 'Appetizers & Snacks',
      keywords: ['mozzarella stick', 'taquito', 'egg roll', 'bagel bite', 'potsticker', 'dumpling', 'hot pocket', 'popper', 'empanada', 'spring roll', 'soft pretzel'],
    },
    { name: 'Potatoes & Fries', keywords: ['fries', 'tater tot', 'hash brown', 'onion ring', 'frozen potato'] },
    {
      name: 'Plant-Based Frozen',
      keywords: ['plant-based', 'vegan', 'dairy-free', 'non-dairy', 'meatless', 'veggie burger', 'plant chicken'],
    },
  ],
};

// Items no keyword matched still show up, on a shelf at the end.
export const OTHER_SHELF = 'Other';

// Shelves with fewer items than this are hidden, so a thin row
// of one lonely card doesn't make the screen look broken.
export const MIN_SHELF_ITEMS = 2;

// Show "See all" only when a shelf has more items than fit in its row.
export const SHELF_PREVIEW_COUNT = 10;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-word match with simple plurals: egg → eggs, tomato → tomatoes,
// strawberry → strawberries. \b doesn't understand letters like "ñ" or "í",
// so the edges are checked as "not a letter or digit" instead.
function keywordPattern(keyword: string): RegExp {
  const base = escapeRegExp(keyword.toLowerCase());
  const plural = keyword.endsWith('y')
    ? `(?:${base}|${escapeRegExp(keyword.slice(0, -1).toLowerCase())}ies)`
    : `${base}(?:s|es)?`;
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${plural}(?=$|[^\\p{L}\\p{N}])`, 'u');
}

const patternCache = new Map<string, RegExp>();
function matches(name: string, keyword: string): boolean {
  let pattern = patternCache.get(keyword);
  if (!pattern) {
    pattern = keywordPattern(keyword);
    patternCache.set(keyword, pattern);
  }
  return pattern.test(name);
}

// Length of the longest keyword of this subcategory found in the name, or 0.
function matchLength(name: string, subcategory: Subcategory): number {
  let best = 0;
  for (const keyword of subcategory.keywords) {
    if (keyword.length > best && matches(name, keyword)) best = keyword.length;
  }
  return best;
}

/** The shelf this item belongs on within its category, or null for "Other". */
export function findSubcategory(category: Category, itemName: string): string | null {
  const name = itemName.toLowerCase();
  let best: { name: string; length: number } | null = null;
  for (const sub of SUBCATEGORIES[category]) {
    const length = matchLength(name, sub);
    // ">" keeps the first one listed when two match equally well.
    if (length > 0 && (!best || length > best.length)) best = { name: sub.name, length };
  }
  return best?.name ?? null;
}

/**
 * The category an item name most likely belongs to, for pre-selecting a chip
 * on the price form. Null when nothing matches; the user then picks one.
 * Ties go to the category listed first, so plain "Broccoli" suggests Produce
 * rather than Frozen.
 */
export function guessCategory(itemName: string): Category | null {
  const name = itemName.toLowerCase();
  let best: { category: Category; length: number } | null = null;
  for (const category of CATEGORIES) {
    for (const sub of SUBCATEGORIES[category]) {
      const length = matchLength(name, sub);
      if (length > 0 && (!best || length > best.length)) best = { category, length };
    }
  }
  return best?.category ?? null;
}

export type Shelf = {
  title: string;
  items: Item[];
};

/**
 * Sorts a category's items onto its shelves, in display order, with "Other"
 * last. Shelves with fewer than `minItems` items are left out.
 */
export function groupIntoShelves(
  category: Category,
  items: Item[],
  minItems: number = MIN_SHELF_ITEMS,
): Shelf[] {
  const byShelf = new Map<string, Item[]>();
  for (const item of items) {
    const title = findSubcategory(category, item.name) ?? OTHER_SHELF;
    const list = byShelf.get(title);
    if (list) list.push(item);
    else byShelf.set(title, [item]);
  }

  const order = [...SUBCATEGORIES[category].map((s) => s.name), OTHER_SHELF];
  return order
    .map((title) => ({ title, items: byShelf.get(title) ?? [] }))
    .filter((shelf) => shelf.items.length >= minItems);
}
