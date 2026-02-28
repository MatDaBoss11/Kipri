export interface OnboardingStep {
  id: number;
  targetKey: string;
  title: string;
  body: string;
  location: 'home' | 'tabbar';
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 0,
    targetKey: 'categoriesSection',
    title: 'Filter by Category',
    body: 'Tap any category to filter products. Tap again to show all.',
    location: 'home',
  },
  {
    id: 1,
    targetKey: 'firstProductCard',
    title: 'Compare Prices Instantly',
    body: 'Each card shows prices from your stores. Green = cheapest. Tap for the full breakdown.',
    location: 'home',
  },
  {
    id: 2,
    targetKey: 'firstBookmarkButton',
    title: 'Save to Shopping List',
    body: 'Tap the bookmark to save items. Your list totals everything up.',
    location: 'home',
  },
  {
    id: 3,
    targetKey: 'tab-promotions',
    title: 'Browse Hot Deals',
    body: 'The Deals tab shows promotions from your stores. Filter by store for savings.',
    location: 'tabbar',
  },
  {
    id: 4,
    targetKey: 'tab-scanner',
    title: 'Add Products & Scan Receipts',
    body: 'Tap the green button to add products or scan receipts to compare prices.',
    location: 'tabbar',
  },
  {
    id: 5,
    targetKey: 'tab-shoppinglist',
    title: 'Your Shopping List',
    body: 'All bookmarked items live here. See your total and filter by store or category.',
    location: 'tabbar',
  },
];
