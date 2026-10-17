import React, { useEffect, useRef } from 'react';
import { createGlassInstance, destroyGlassInstance } from '../utils/glass';

/**
 * 可复用的液态玻璃胶囊组件。
 * 任意圆角容器包一层即可获得 WebGL 液态玻璃质感（形状自动取自 CSS border-radius），
 * 实例生命周期与主题材质切换由共享工具自动管理，便于二次使用。
 */
export interface LiquidGlassCapsuleProps {
  /** 附加类名（如尺寸/位置样式） */
  className?: string;
  /** LiquidGlass 实例参数（frost / tint / tintTone / opacity / maxDpr ...） */
  glassOptions?: Record<string, any>;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  title?: string;
  ariaLabel?: string;
}

export default function LiquidGlassCapsule({
  className = '',
  glassOptions,
  style,
  children,
  onClick,
  title,
  ariaLabel,
}: LiquidGlassCapsuleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const instRef = useRef<any>(null);
  const optsRef = useRef(glassOptions);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const inst = await createGlassInstance(ref.current as HTMLElement, optsRef.current);
      if (cancelled) {
        destroyGlassInstance(inst);
        return;
      }
      instRef.current = inst;
    })();
    return () => {
      cancelled = true;
      destroyGlassInstance(instRef.current);
      instRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={`liquid-glass-capsule ${className}`}
      style={style}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
