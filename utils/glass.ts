// ── 液态玻璃共享工具（apple-liquid-glass-webgl@2.6.0，CDN 动态加载） ──
// 供导航、主题切换胶囊、弹窗等所有玻璃面复用：统一加载、实例注册、主题材质切换。

let glassModulePromise: Promise<any> | null = null;

export async function loadGlassModule(): Promise<any> {
  if (glassModulePromise) return glassModulePromise;
  glassModulePromise = (async () => {
    try {
      // @ts-ignore – 运行时原生动态导入 CDN ES 模块，webpackIgnore 避免被打包
      return await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/apple-liquid-glass-webgl@2.6.0/src/index.js');
    } catch {
      try {
        // @ts-ignore – 备用 CDN
        return await import(/* webpackIgnore: true */ 'https://unpkg.com/apple-liquid-glass-webgl@2.6.0/src/index.js');
      } catch {
        return null;
      }
    }
  })();
  return glassModulePromise;
}

// 存活的玻璃实例注册表：主题切换时批量更新材质
interface RegistryEntry {
  inst: any;
  base: Record<string, any>;
}
const registry = new Set<RegistryEntry>();

export async function createGlassInstance(
  el: HTMLElement | string,
  options?: Record<string, any>,
): Promise<any> {
  const mod = await loadGlassModule();
  if (!mod || !mod.LiquidGlass) return null;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('lg-webgl');
  }
  try {
    const inst = new mod.LiquidGlass(el, options);
    registry.add({ inst, base: options || {} });
    return inst;
  } catch (e) {
    console.warn('[LiquidGlass] createGlassInstance:', e);
    return null;
  }
}

export function destroyGlassInstance(inst: any): void {
  if (!inst) return;
  registry.forEach((entry) => {
    if (entry.inst === inst) registry.delete(entry);
  });
  try {
    inst.destroy();
  } catch {
    /* noop */
  }
}

export function destroyGlass(list: any[]): void {
  if (!list) return;
  for (const inst of list) destroyGlassInstance(inst);
  list.length = 0;
}

/** 深浅主题切换：按各玻璃面基准参数叠加暗色材质（透镜折射面除外） */
export function applyGlassTheme(dark: boolean): void {
  registry.forEach(({ inst, base }) => {
    if (base.lens) return; // 导航高亮透镜保持完全透明折射
    try {
      inst.update({
        material: {
          frost: (base.frost ?? 0.28) + (dark ? 0.05 : 0),
          tint: (base.tint ?? 0.22) + (dark ? 0.14 : 0),
          body: dark ? 0.86 : 0.72,
        },
      });
    } catch {
      /* noop */
    }
  });
}

// 常用玻璃面参数
export const NAV_GLASS_OPTIONS = { frost: 0.4, tint: 0.3, tintTone: 'light', opacity: 0.95, maxDpr: 1.5 };
export const CAPSULE_GLASS_OPTIONS = { frost: 0.45, tint: 0.34, tintTone: 'light', opacity: 0.96, maxDpr: 1.5 };
// 导航高亮透镜：完全透明 + 折射放大（Liquid Glass V2 clear 材质，边缘折射缩放较为明显）
export const LENS_GLASS_OPTIONS = {
  lens: true, // 内部标记：不参与主题材质叠加
  frost: 0,
  backdropBlur: 0,
  refraction: 80,
  edgeReach: 0.5,  // 边缘折射区域（边缘明显缩放/扭曲感）
  edgeWidth: 0.5,
  dispersion: 0.8,
  body: 0,
  tint: 0,
  absorption: 0,
  rim: 0.22,        // 边缘亮边（高光折射感）
  reflection: 0.16,
  highlight: 0.28,
  echo: 0,
  hairline: 0.7,    // 边缘细线轮廓
  hairWidth: 0.5,
  roundness: 0.5,
  maxDpr: 1.5,
};
