// TypeScript definitions for IKU Sushi menu items
// This file provides type safety for menu operations

export type MenuCategory = 'entradas' | 'nigiri' | 'roll' | 'bebida' | 'postre';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  description?: string;
  pairing_notes?: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuQueryParams {
  category?: MenuCategory;
  is_available?: boolean;
  limit?: number;
  offset?: number;
  order_by?: 'name' | 'price' | 'category' | 'created_at';
  order_direction?: 'asc' | 'desc';
}

export interface MenuStats {
  total_items: number;
  items_by_category: Record<MenuCategory, number>;
  average_price: number;
  price_range: {
    min: number;
    max: number;
  };
}

// Example API responses
export interface MenuListResponse {
  items: MenuItem[];
  total: number;
  category?: MenuCategory;
}

export interface MenuItemResponse {
  item: MenuItem;
  suggested_pairings?: string[];
}

// Sommelier AI specific types
export interface PairingSuggestion {
  menu_item: MenuItem;
  suggested_drinks: string[];
  pairing_reason: string;
  price_compatibility: 'budget' | 'mid-range' | 'premium';
}

export interface CategoryRecommendations {
  category: MenuCategory;
  popular_items: MenuItem[];
  typical_pairings: string[];
  price_range: string;
}