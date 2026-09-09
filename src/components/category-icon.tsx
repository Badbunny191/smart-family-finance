'use client';

import {
  Banknote,
  Building2,
  Car,
  CirclePlus,
  Droplets,
  House,
  Landmark,
  LucideIcon,
  Package,
  ReceiptText,
  ShoppingCart,
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
  { name: 'Banknote', label: 'ธนบัตร' },
  { name: 'Landmark', label: 'อาคาร' },
  { name: 'Package', label: 'พัสดุ' },
  { name: 'ReceiptText', label: 'ใบเสร็จ' },
  { name: 'Building2', label: 'อาคารสำนักงาน' },
  { name: 'Droplets', label: 'หยดน้ำ' },
  { name: 'Wifi', label: 'อินเทอร์เน็ต' },
  { name: 'Zap', label: 'ไฟฟ้า' },
  { name: 'Wrench', label: 'ซ่อมบำรุง' },
  { name: 'ShoppingCart', label: 'ช้อปปิ้ง' },
  { name: 'Car', label: 'รถยนต์' },
  { name: 'House', label: 'บ้าน' },
  { name: 'CirclePlus', label: 'เพิ่มเติม' },
] as const;
