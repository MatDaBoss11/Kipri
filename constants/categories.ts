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

export const STORES = ['Winners', 'Kingsavers', 'Super U'];

export const STORE_INFO = [
  { name: 'Super U', icon: '🛒', color: '#2196F3' },
  { name: 'Winners', icon: '🏆', color: '#FF9800' },
  { name: 'Kingsavers', icon: '💰', color: '#9C27B0' },
  { name: 'Tous Les Produits', icon: '🏪', color: '#4CAF50' },
];

export const BACKEND_URL = 'https://grocery-price-scanner-backend.onrender.com';