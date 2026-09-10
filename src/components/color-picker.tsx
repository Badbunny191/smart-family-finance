'use client';

import { Palette } from 'lucide-react';

const PRESET_COLORS = [
  { name: 'Emerald', value: '#10b981' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Teal', value: '#14b8a6' },
];

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">สีพร้อมใช้</span>
        <span
          className="h-5 w-5 rounded-full ring-1 ring-slate-200"
          style={{ backgroundColor: value }}
          title={value}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => {
          const isSelected = value.toLowerCase() === color.value.toLowerCase();
          return (
            <button
              key={color.value}
              type="button"
              onClick={() => onChange(color.value)}
              title={color.name}
              className={`h-7 w-7 rounded-full transition-all ${
                isSelected
                  ? 'scale-110 ring-2 ring-offset-2'
                  : 'hover:scale-105'
              }`}
              style={{
                backgroundColor: color.value,
                '--tw-ring-color': color.value,
              } as React.CSSProperties}
            />
          );
        })}
        <label
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all hover:bg-slate-200"
          title="กำหนดเอง"
        >
          <Palette size={14} />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
}
