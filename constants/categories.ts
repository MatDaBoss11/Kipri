import { CategoryInfo } from '../types';

export const CATEGORIES: CategoryInfo[] = [
  { name: 'dairy', emoji: '🥛', displayName: 'Dairy' },
  { name: 'liquid', emoji: '🧃', displayName: 'Liquid' },
  { name: 'wheat', emoji: '🌾', displayName: 'Wheat' },
  { name: 'meat', emoji: '🥩', displayName: 'Meat' },
  { name: 'frozen', emoji: '🧊', displayName: 'Frozen' },
  { name: 'snacks', emoji: '🍬', displayName: 'Snacks' },
  { name: 'grown', emoji: '🥦', displayName: 'Grown' },
  { name: 'miscellaneous', emoji: '🧺', displayName: 'Miscellaneous' },
];

// STORES array removed - stores now come from database via StoreService
// STORE_INFO removed - store icons/colors now come from database via StoreService

// Backend URL removed - using integrated services now!