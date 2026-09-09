'use client';

import { CategoryIcon, CATEGORY_ICONS } from '@/components/category-icon';
import { X } from 'lucide-react';

type IconPickerProps = {
  value: string;
  onChange: (icon: string) => void;
  onClose: () => void;
};

export function IconPicker({ value, onChange, onClose }: IconPickerProps) {
  return (
    <div className="mt-1">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">เลือกไอคอน</span>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {CATEGORY_ICONS.map((icon) => (
          <button
            key={icon.name}
            type="button"
            onClick={() => onChange(icon.name)}
            title={icon.label}
            className={`grid h-12 w-12 place-items-center rounded-xl border-2 text-slate-600 transition-all ${
              value === icon.name
                ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <CategoryIcon name={icon.name} size={20} />
          </button>
        ))}
      </div>
      {value && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3">
          <span className="text-sm text-slate-500">ไอคอนที่เลือก:</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
            <CategoryIcon name={value} size={18} />
          </span>
          <span className="text-sm font-medium text-slate-700">{CATEGORY_ICONS.find((i) => i.name === value)?.label}</span>
        </div>
      )}
    </div>
  );
}
