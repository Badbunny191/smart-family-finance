'use client';

import {
  Banknote,
  Briefcase,
  Building2,
  Car,
  CirclePlus,
  CreditCard,
  Droplets,
  Fuel,
  House,
  Key,
  Landmark,
  LucideIcon,
  Package,
  PiggyBank,
  ReceiptText,
  ShoppingCart,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Banknote,
  Landmark,
  Package,
  ReceiptText,
  Building2,
  Droplets,
  Wifi,
  Zap,
  Wrench,
  ShoppingCart,
  Car,
  House,
  CirclePlus,
  Key,
  Wallet,
  CreditCard,
  PiggyBank,
  UtensilsCrossed,
  Fuel,
  Briefcase,
};

const FALLBACK_ICON = ReceiptText;

// Legacy emoji icons (stored in DB before icon migration)
const LEGACY_EMOJI_MAP: Record<string, string> = {
  '💰': 'Banknote',
  '🛒': 'ShoppingCart',
  '🏠': 'House',
  '🚗': 'Car',
  '💧': 'Droplets',
  '⚡': 'Zap',
  '🔧': 'Wrench',
  '📦': 'Package',
  '🏢': 'Building2',
  '➕': 'CirclePlus',
};

export function CategoryIcon({ name, size = 20, className = '' }: { name: string | null; size?: number; className?: string }) {
  // Handle null/undefined
  if (!name) return <FALLBACK_ICON size={size} className={className} />;

  // Normalize legacy emoji to icon name
  const normalizedName = LEGACY_EMOJI_MAP[name] ?? name;

  // Look up in icon map
  const Icon = ICON_MAP[normalizedName];
  if (!Icon) return <FALLBACK_ICON size={size} className={className} />;

  return <Icon size={size} className={className} />;
}

export const CATEGORY_ICONS = [
  // Finance
  { name: 'Banknote', label: 'ธนบัตร' },
  { name: 'Wallet', label: 'กระเป๋าสตางค์' },
  { name: 'CreditCard', label: 'บัตรเครดิต' },
  { name: 'PiggyBank', label: 'กระปุกออมสิน' },
  { name: 'Landmark', label: 'ธนาคาร' },
  // Property
  { name: 'House', label: 'บ้าน' },
  { name: 'Building2', label: 'อาคาร' },
  { name: 'Key', label: 'กุญแจ' },
  // Utilities
  { name: 'Wifi', label: 'อินเทอร์เน็ต' },
  { name: 'Zap', label: 'ไฟฟ้า' },
  { name: 'Droplets', label: 'น้ำ' },
  { name: 'Wrench', label: 'ซ่อมบำรุง' },
  // Lifestyle
  { name: 'ShoppingCart', label: 'ช้อปปิ้ง' },
  { name: 'UtensilsCrossed', label: 'อาหาร' },
  { name: 'Car', label: 'รถยนต์' },
  { name: 'Fuel', label: 'น้ำมัน' },
  // General
  { name: 'Package', label: 'พัสดุ' },
  { name: 'ReceiptText', label: 'ใบเสร็จ' },
  { name: 'Briefcase', label: 'การทำงาน' },
  { name: 'CirclePlus', label: 'เพิ่มเติม' },
] as const;
