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
 * CustomDropdown Component
 * 
 * Replaces native HTML <select> with a sleek dark-glassmorphic custom dropdown.
 * Eliminates browser-default blue highlights, providing neon purple hover states,
 * smooth 180-degree chevron rotation, and floating glass menu.
 * 
 * @param {Object} props
 * @param {number|string} [props.value=60] Current selected value
 * @param {Function} props.onChange Callback when a new value is selected
 * @param {Array<{value: number|string, label: string}>} [props.options=TIME_OPTIONS] Options list
 * @param {string} [props.id] Optional ID for testing and accessibility
 * @param {string} [props.className] Optional wrapper CSS classes
 */
export default function CustomDropdown({
  value = 60,
  onChange,
  options = TIME_OPTIONS,
  id = 'select-timer',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState(value);
  const dropdownRef = useRef(null);

  // Synchronize internal state with external value changes
  useEffect(() => {
    if (value !== undefined && value !== null) {
      setSelectedTime(value);
    }
  }, [value]);

  // Dismiss dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dismiss dropdown on Escape key
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
    setSelectedTime(optionValue);
    if (typeof onChange === 'function') {
      onChange(optionValue);
    }
    setIsOpen(false);
  };

  const currentOption = options.find(
    (opt) => String(opt.value) === String(selectedTime)
  ) || options[0];

  return (
    // 1. Relative wrapper to anchor the absolutely positioned dropdown menu
    <div ref={dropdownRef} className={`relative w-full ${className}`}>
      
      {/* 2. The Trigger Button */}
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-3 text-white flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer focus:outline-none focus:border-purple-500/50"
      >
        <span className="text-sm font-medium tracking-wide">
          {currentOption ? currentOption.label : `${selectedTime} seconds`}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-purple-400' : ''
          }`}
        />
      </button>

      {/* 3. The Glassmorphism Menu (Renders only when isOpen is true) */}
      {isOpen && (
        <ul
          role="listbox"
          tabIndex={-1}
          className="absolute top-full mt-2 w-full z-50 bg-[#0f0f16]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden divide-y divide-white/5 animate-fadeIn"
        >
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(selectedTime);
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                className={`px-4 py-3 text-sm flex items-center justify-between transition-colors cursor-pointer select-none ${
                  isSelected
                    ? 'text-white font-medium bg-white/5 text-purple-200'
                    : 'text-slate-300 hover:bg-purple-500/20 hover:text-purple-300'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <Check className="w-4 h-4 text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
