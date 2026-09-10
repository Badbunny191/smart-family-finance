'use client';

import { CategoryIcon, CATEGORY_ICONS } from '@/components/category-icon';
import { Check, X } from 'lucide-react';

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
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {CATEGORY_ICONS.map((icon) => {
          const isSelected = value === icon.name;
          return (
            <button
              key={icon.name}
              type="button"
              onClick={() => onChange(icon.name)}
              title={icon.label}
              className={`relative flex h-12 w-12 items-center justify-center rounded-xl border-2 text-slate-600 transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <CategoryIcon name={icon.name} size={20} />
              {isSelected && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-sm">
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
