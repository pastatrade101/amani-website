import { writable } from 'svelte/store';
import { brand } from '$lib/admin/brand';

export type BrandColors = {
  clay: string;
  deep_green: string;
  forest: string;
  goldfinch_gold: string;
  ink: string;
  sand: string;
  savanna: string;
};

export type Branding = {
  ai_advisor_name: string;
  colors: BrandColors;
  company_name: string;
  favicon_url: string;
  logo_url: string;
  positioning: string;
  primary_cta: string;
  secondary_cta: string;
  site_name: string;
  support_email: string;
  support_phone: string;
  tagline: string;
  whatsapp_cta: string;
};

export const defaultColors: BrandColors = {
  clay: '#AA3D1D',
  deep_green: '#0F2D4E',
  forest: '#173E61',
  goldfinch_gold: '#F6D21B',
  ink: '#0F2D4E',
  sand: '#EEF3F8',
  savanna: '#EEF3F8'
};

export const defaultBranding: Branding = {
  ai_advisor_name: brand.aiAdvisorName,
  colors: { ...defaultColors },
  company_name: brand.companyName,
  favicon_url: '',
  logo_url: '',
  positioning: brand.positioning,
  primary_cta: brand.primaryCta,
  secondary_cta: brand.secondaryCta,
  site_name: brand.name,
  support_email: '',
  support_phone: '',
  tagline: brand.tagline,
  whatsapp_cta: brand.whatsappCta
};

export const branding = writable<Branding>(defaultBranding);

// Maps each color key to its CSS custom property (defined in app.css :root).
const cssVarMap: Record<keyof BrandColors, string> = {
  clay: '--c-clay',
  deep_green: '--c-deep-green',
  forest: '--c-forest',
  goldfinch_gold: '--c-goldfinch-gold',
  ink: '--c-ink',
  sand: '--c-sand',
  savanna: '--c-savanna'
};

/** Convert "#2D3027" → "31 77 58" (the space-separated RGB Tailwind needs). */
export const hexToRgbTriple = (hex: string): string | null => {
  const match = /^#?([0-9a-fA-F]{6})$/.exec((hex ?? '').trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
};

const BRAND_STYLE_ID = 'brand-color-vars';

/**
 * Applies brand colors as a `:root { … }` rule in a <style> tag (not inline on
 * <html>). This matters for dark mode: an inline style would beat the
 * `html.dark` overrides, but a `:root` rule has lower specificity than
 * `html.dark`, so the dark palette still wins when active — while these brand
 * values still override the light defaults in app.css.
 */
export const applyBrandColors = (colors: Partial<BrandColors>) => {
  if (typeof document === 'undefined') return;
  const declarations: string[] = [];
  for (const key of Object.keys(cssVarMap) as (keyof BrandColors)[]) {
    const value = colors[key];
    if (!value) continue;
    const triple = hexToRgbTriple(value);
    if (triple) declarations.push(`${cssVarMap[key]}: ${triple};`);
  }
  if (declarations.length === 0) return;

  let style = document.getElementById(BRAND_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = BRAND_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `:root{${declarations.join('')}}`;
};

const setFavicon = (url: string) => {
  if (typeof document === 'undefined' || !url) return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
};

/** Merge incoming branding with defaults, update the store, and apply colors + favicon live. */
export const applyBranding = (data: Partial<Branding> | null | undefined) => {
  const incoming = data ?? {};
  const merged: Branding = {
    ...defaultBranding,
    ...incoming,
    colors: { ...defaultColors, ...(incoming.colors ?? {}) }
  };
  branding.set(merged);
  applyBrandColors(merged.colors);
  if (merged.favicon_url) setFavicon(merged.favicon_url);
  return merged;
};
