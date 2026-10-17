import React from 'react';
import LiquidGlassCapsule from './LiquidGlassCapsule';
import { CAPSULE_GLASS_OPTIONS } from '../utils/glass';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

/** 深色/浅色切换：液态玻璃胶囊按钮（复用 LiquidGlassCapsule） */
export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <LiquidGlassCapsule
      className="theme-toggle"
      glassOptions={CAPSULE_GLASS_OPTIONS}
      onClick={onToggle}
      ariaLabel={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
      title={theme === 'light' ? '深色模式' : '浅色模式'}
    >
      <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`} />
    </LiquidGlassCapsule>
  );
}
