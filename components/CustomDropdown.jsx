'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const TIME_OPTIONS = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '60 seconds' },
  { value: 90, label: '90 seconds' },
  { value: 120, label: '120 seconds' },
];

/**
 * Visual metadata fallback mapping for game difficulty modes
 */
const DIFFICULTY_META = {
  easy: {
    emoji: '🌱',
    title: 'Easy',
    sublabel: 'Common Words & Clues',
    badge: '6 Lives • Clues',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    accentColor: '#34d399',
    avatarClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.3)]',
    containerClass: 'hover:border-emerald-500/40 hover:bg-emerald-500/10',
  },
  medium: {
    emoji: '⚡',
    title: 'Medium',
    sublabel: 'Standard Vocabulary & Clues',
    badge: '6 Lives • Clues',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    accentColor: '#f59e0b',
    avatarClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]',
    containerClass: 'hover:border-amber-500/40 hover:bg-amber-500/10',
  },
  hard: {
    emoji: '💀',
    title: 'Hard',
    sublabel: 'Complex Words • 10 Lives',
    badge: '10 Lives • No Clues',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    accentColor: '#f43f5e',
    avatarClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]',
    containerClass: 'hover:border-rose-500/40 hover:bg-rose-500/10',
  },
  nightmare: {
    emoji: '🔥',
    title: 'Nightmare',
    sublabel: 'Extreme Words • 4 Lives',
    badge: '4 Lives • No Clues',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
    accentColor: '#ef4444',
    avatarClass: 'bg-gradient-to-br from-red-500/30 to-orange-500/25 text-red-300 border-red-500/50 shadow-[0_0_16px_rgba(239,68,68,0.4)]',
    containerClass: 'hover:border-red-500/50 hover:bg-red-500/15',
  },
};

function resolveOptionMeta(opt) {
  if (!opt) return null;
  const valKey = String(opt.value).toLowerCase();
  const meta = DIFFICULTY_META[valKey];

  const emoji = opt.emoji || meta?.emoji || (typeof opt.value === 'number' ? '⏱️' : null);
  const title = opt.name || meta?.title || (opt.label ? opt.label.split('(')[0].trim() : String(opt.value));
  const subtitle = opt.subtitle || opt.sublabel || meta?.sublabel || (opt.label && opt.label.includes('(') ? opt.label.replace(/^.*?\(|\)$/g, '') : null);
  const badge = opt.badge || meta?.badge || (typeof opt.value === 'number' ? `${opt.value}s` : null);
  const badgeClass = opt.badgeBg || meta?.badgeClass || 'bg-white/10 text-slate-300 border-white/10';
  const accentColor = opt.color || meta?.accentColor || '#a855f7';
  const avatarClass = meta?.avatarClass || 'bg-white/10 text-white border-white/20 shadow-sm';
  const containerClass = meta?.containerClass || 'hover:bg-purple-500/15';

  return {
    emoji,
    title,
    subtitle,
    badge,
    badgeClass,
    accentColor,
    avatarClass,
    containerClass,
  };
}

/**
 * CustomDropdown Component
 * 
 * High-end dark glassmorphic dropdown with rich emoji avatars, difficulty pills,
 * animated chevrons, and smooth neon glow hover states.
 */
export default function CustomDropdown({
  value = 60,
  onChange,
  options = TIME_OPTIONS,
  id = 'select-timer',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (value !== undefined && value !== null) {
      setSelectedValue(value);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    setSelectedValue(optionValue);
    if (typeof onChange === 'function') {
      onChange(optionValue);
    }
    setIsOpen(false);
  };

  const currentOption = options.find(
    (opt) => String(opt.value) === String(selectedValue)
  ) || options[0];

  const currentMeta = resolveOptionMeta(currentOption);

  return (
    <div ref={dropdownRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          borderColor: isOpen
            ? currentMeta?.accentColor || 'rgba(168, 85, 247, 0.6)'
            : undefined,
        }}
        className={`w-full bg-[#151424]/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3.5 py-2.5 text-white flex items-center justify-between gap-3 hover:border-white/20 transition-all duration-200 cursor-pointer focus:outline-none shadow-lg group ${
          isOpen ? 'ring-2 ring-purple-500/20 shadow-[0_0_20px_rgba(0,0,0,0.6)]' : ''
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
          {/* Emoji / Icon Avatar */}
          {currentMeta?.emoji && (
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border transition-transform duration-200 group-hover:scale-105 ${currentMeta.avatarClass}`}
            >
              <span>{currentMeta.emoji}</span>
            </div>
          )}

          {/* Title & Subtitle */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold tracking-wide text-white">
                {currentMeta?.title || currentOption?.label}
              </span>
              {currentMeta?.badge && (
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border shrink-0 ${currentMeta.badgeClass}`}
                >
                  {currentMeta.badge}
                </span>
              )}
            </div>
            {currentMeta?.subtitle && (
              <p className="text-xs text-slate-400 truncate mt-0.5 font-normal">
                {currentMeta.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Chevron Icon */}
        <div className="shrink-0 pl-1">
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-purple-400' : 'group-hover:text-white'
            }`}
          />
        </div>
      </button>

      {/* Floating Glassmorphism Menu */}
      {isOpen && (
        <ul
          role="listbox"
          tabIndex={-1}
          className="absolute top-full left-0 mt-2 w-full z-50 bg-[#0d0c18]/98 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden p-1.5 space-y-1 animate-fadeIn divide-y divide-white/5"
        >
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(selectedValue);
            const meta = resolveOptionMeta(opt);

            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                className={`px-3 py-2.5 rounded-xl text-sm flex items-center justify-between gap-3 transition-all duration-150 cursor-pointer select-none group border ${
                  isSelected
                    ? 'bg-white/10 border-white/20 text-white shadow-sm'
                    : `border-transparent text-slate-300 hover:text-white ${meta?.containerClass || 'hover:bg-white/5'}`
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  {/* Option Emoji Badge */}
                  {meta?.emoji && (
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 border transition-transform duration-150 group-hover:scale-110 ${meta.avatarClass}`}
                    >
                      <span>{meta.emoji}</span>
                    </div>
                  )}

                  {/* Option Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold tracking-wide transition-colors ${
                          isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                        }`}
                      >
                        {meta?.title || opt.label}
                      </span>
                    </div>
                    {meta?.subtitle && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 leading-snug">
                        {meta.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Side: Badge & Checkmark */}
                <div className="flex items-center gap-2 shrink-0">
                  {meta?.badge && (
                    <span
                      className={`hidden sm:inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${meta.badgeClass}`}
                    >
                      {meta.badge}
                    </span>
                  )}

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-purple-300 drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
