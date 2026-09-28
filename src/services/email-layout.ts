import { env } from '../config/env';
import { supabase } from '../config/supabase';

/**
 * The branded shell every transactional email is sent in.
 *
 * Email clients are not browsers: no external CSS, flexbox or web fonts in
 * Gmail, and Outlook lays out with Word. So this is tables and inline styles,
 * a PNG logo on an absolute URL (the site's AVIF images do not display in most
 * inboxes), and a serif that falls back to Georgia where Source Serif cannot
 * load. The palette is the website's (app.css tokens).
 *
 * Contact details in the footer come from Settings, so the emails say what the
 * website says and change when the office does. Nothing is invented: a detail
 * that is not set is simply left out.
 */

export const EMAIL_COLORS = {
  forest: '#272B22',
  deepGreen: '#393D32',
  gold: '#E4A92E',
  cream: '#F3EFE7',
  savanna: '#F1E3C8',
  ink: '#393D32',
  muted: '#6E7166',
  line: '#E7E1D4',
  clay: '#AA3D1D',
  white: '#FFFFFF'
} as const;

const C = EMAIL_COLORS;
const SERIF = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const SANS = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

export type EmailAudience = 'traveller' | 'staff';

export type EmailLayoutOptions = {
  /** The grey line inbox lists show after the subject. Defaults to the start of the body. */
  preheader?: string;
  /**
   * Travellers get the sign-off, the "questions?" box and a footer that says
   * why they are hearing from us; staff alerts stay plain and say they are
   * internal. Defaults to traveller.
   */
  audience?: EmailAudience;
};

export type EmailBrand = {
  siteName: string;
  companyName: string;
  tagline: string;
  siteUrl: string;
  logoUrl: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  mapsUrl: string;
  hours: string;
  socials: Array<{ label: string; url: string }>;
};

const SETTING_KEYS = [
  'site_name',
  'company_name',
  'tagline',
  'canonical_base_url',
  'contact_email',
  'contact_phone',
  'whatsapp_number',
  'office_address',
  'city',
  'country',
  'google_maps_url',
  'business_hours',
  'facebook_url',
  'instagram_url',
  'youtube_url',
  'tiktok_url',
  'linkedin_url',
  'tripadvisor_url'
];

const SOCIALS: Array<[string, string]> = [
  ['facebook_url', 'Facebook'],
  ['instagram_url', 'Instagram'],
  ['youtube_url', 'YouTube'],
  ['tiktok_url', 'TikTok'],
  ['linkedin_url', 'LinkedIn'],
  ['tripadvisor_url', 'Tripadvisor']
];

const escape = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isPublicHttps = (url: string) => /^https:\/\//i.test(url) && !/localhost|127\.0\.0\.1/i.test(url);

/**
 * The website's public address. An email is read outside the server, so a
 * localhost origin (a developer's FRONTEND_URL) would give it a broken logo
 * and dead links: the first public https origin wins.
 */
const siteOriginFrom = (settingUrl: string): string => {
  const candidates = [settingUrl, process.env.PUBLIC_SITE_URL ?? '', ...env.FRONTEND_URL.split(',')]
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return candidates.find(isPublicHttps) ?? candidates[0] ?? '';
};

let cache: { brand: EmailBrand; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

/** Brand and contact details from Settings, read at most every five minutes. */
export const loadEmailBrand = async (): Promise<EmailBrand> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.brand;

  const settings: Record<string, string> = {};
  try {
    const { data } = await supabase
      .from('website_settings')
      .select('setting_key,setting_value')
      .eq('is_public', true)
      .is('deleted_at', null)
      .in('setting_key', SETTING_KEYS);
    for (const row of data ?? []) {
      if (typeof row.setting_value === 'string') settings[String(row.setting_key)] = row.setting_value.trim();
    }
  } catch {
    // An email must still go out if Settings is unreachable — just without the extras.
  }

  const siteUrl = siteOriginFrom(settings.canonical_base_url ?? '');
  const brand: EmailBrand = {
    siteName: settings.site_name || 'Goldfinch Adventures',
    companyName: settings.company_name || settings.site_name || 'Goldfinch Adventures',
    tagline: settings.tagline ?? '',
    siteUrl,
    logoUrl: siteUrl ? `${siteUrl}/favicon1.png` : '',
    email: settings.contact_email ?? '',
    phone: settings.contact_phone ?? '',
    whatsapp: settings.whatsapp_number ?? '',
    address: [settings.office_address, settings.city, settings.country].filter(Boolean).join(', '),
    mapsUrl: settings.google_maps_url ?? '',
    hours: settings.business_hours ?? '',
    socials: SOCIALS.filter(([key]) => /^https?:\/\//i.test(settings[key] ?? '')).map(([key, label]) => ({ label, url: settings[key] }))
  };
  cache = { brand, at: Date.now() };
  return brand;
};

/** Drops the cached details, so the next email re-reads Settings. */
export const clearEmailBrandCache = () => {
  cache = null;
};

const plainText = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
const waHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;
const hostOf = (url: string) => url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

/** A button Outlook draws too: the colour sits on the table cell, not only the link. */
const button = (label: string, url: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 8px">
    <tr>
      <td align="center" bgcolor="${C.gold}" style="border-radius:8px;background:${C.gold}">
        <a href="${url}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${SANS};font-size:15px;font-weight:bold;line-height:1;color:${C.forest};text-decoration:none;border-radius:8px">${label}&nbsp;&rarr;</a>
      </td>
    </tr>
  </table>
  <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted}">Button not working? Open this link:<br /><a href="${url}" target="_blank" style="color:${C.clay};word-break:break-all">${url}</a></p>`;

/** For travellers: how to reach a person, straight after the message. */
const helpBox = (brand: EmailBrand) => {
  const ways: string[] = [];
  if (brand.whatsapp) ways.push(`<a href="${escape(waHref(brand.whatsapp))}" target="_blank" style="color:${C.clay};font-weight:bold;text-decoration:none">WhatsApp ${escape(brand.whatsapp)}</a>`);
  if (brand.phone && brand.phone !== brand.whatsapp) ways.push(`<a href="${escape(telHref(brand.phone))}" style="color:${C.clay};font-weight:bold;text-decoration:none">Call ${escape(brand.phone)}</a>`);
  if (brand.email) ways.push(`<a href="mailto:${escape(brand.email)}" style="color:${C.clay};font-weight:bold;text-decoration:none">${escape(brand.email)}</a>`);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px">
      <tr>
        <td style="background:${C.cream};border-left:4px solid ${C.gold};border-radius:8px;padding:20px 22px">
          <p style="margin:0 0 6px;font-family:${SERIF};font-size:17px;font-weight:bold;color:${C.forest}">Questions about your trip?</p>
          <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.7;color:${C.ink}">Just reply to this email${
            ways.length ? `, or reach us on ${ways.join(' &middot; ')}` : ''
          }.${brand.hours ? `<br /><span style="color:${C.muted};font-size:13px">${escape(brand.hours)}</span>` : ''}</p>
        </td>
      </tr>
    </table>`;
};

/** One labelled contact line in the footer. */
const contactLine = (label: string, valueHtml: string) => `
  <tr>
    <td valign="top" width="92" style="padding:5px 0;font-family:${SANS};font-size:10px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:${C.gold}">${label}</td>
    <td valign="top" style="padding:4px 0;font-family:${SANS};font-size:13px;line-height:1.55;color:${C.savanna}">${valueHtml}</td>
  </tr>`;

const footerLink = `color:${C.savanna};text-decoration:none`;

const footer = (brand: EmailBrand, audience: EmailAudience) => {
  const lines: string[] = [];
  if (brand.email) lines.push(contactLine('Email', `<a href="mailto:${escape(brand.email)}" style="${footerLink}">${escape(brand.email)}</a>`));
  if (brand.phone) lines.push(contactLine('Call', `<a href="${escape(telHref(brand.phone))}" style="${footerLink}">${escape(brand.phone)}</a>`));
  if (brand.whatsapp) lines.push(contactLine('WhatsApp', `<a href="${escape(waHref(brand.whatsapp))}" target="_blank" style="${footerLink}">${escape(brand.whatsapp)}</a>`));
  if (brand.address) {
    const address = escape(brand.address);
    lines.push(contactLine('Office', brand.mapsUrl ? `<a href="${escape(brand.mapsUrl)}" target="_blank" style="${footerLink}">${address}</a>` : address));
  }
  if (brand.hours) lines.push(contactLine('Hours', escape(brand.hours)));
  if (brand.siteUrl) lines.push(contactLine('Website', `<a href="${escape(brand.siteUrl)}" target="_blank" style="color:${C.gold};text-decoration:none;font-weight:bold">${escape(hostOf(brand.siteUrl))}</a>`));

  const socials = brand.socials
    .map((social) => `<a href="${escape(social.url)}" target="_blank" style="color:${C.gold};text-decoration:none;font-weight:bold">${escape(social.label)}</a>`)
    .join(`<span style="color:${C.savanna};opacity:.5">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>`);

  const why =
    audience === 'staff'
      ? `Internal notification from the ${escape(brand.siteName)} website.`
      : `You are receiving this email because you contacted ${escape(brand.siteName)} about a trip. Reply any time to reach our team.`;

  return `
    <tr>
      <td class="gf-pad" style="background:${C.forest};border-radius:0 0 14px 14px;padding:34px 44px 30px">
        <p style="margin:0;font-family:${SERIF};font-size:19px;font-weight:bold;color:${C.gold}">${escape(brand.siteName)}</p>
        ${brand.tagline ? `<p style="margin:4px 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.savanna};opacity:.75">${escape(brand.tagline)}</p>` : ''}
        ${lines.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px">${lines.join('')}</table>` : ''}
        ${socials ? `<p style="margin:20px 0 0;font-family:${SANS};font-size:13px">${socials}</p>` : ''}
        <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid rgba(241,227,200,.16);font-family:${SANS};font-size:11px;line-height:1.6;color:${C.savanna};opacity:.6">
          ${why}<br />&copy; ${new Date().getFullYear()} ${escape(brand.companyName)}
        </p>
      </td>
    </tr>`;
};

export type EmailDetail = { label: string; value: string; href?: string };

/**
 * Everything a form collected, as a label / value table rather than a block of
 * text, so a specialist can scan an enquiry. Values are plain text, escaped
 * here; line breaks are kept. Empty values are left out.
 */
export const emailDetails = (rows: EmailDetail[]): string => {
  const filled = rows.filter((row) => row.value.trim());
  if (!filled.length) return '';
  const cells = filled
    .map((row, index) => {
      const value = escape(row.value.trim()).replace(/\n/g, '<br />');
      const shown = row.href ? `<a href="${escape(row.href)}" target="_blank" style="color:${C.clay};text-decoration:none;font-weight:bold">${value}</a>` : value;
      const rule = index ? `border-top:1px solid ${C.line};` : '';
      return `<tr>
        <td valign="top" width="34%" style="${rule}padding:11px 14px 11px 0;font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${C.muted}">${escape(row.label)}</td>
        <td valign="top" style="${rule}padding:10px 0;font-family:${SANS};font-size:14px;line-height:1.55;color:${C.ink}">${shown}</td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px;background:${C.cream};border-left:4px solid ${C.gold};border-radius:8px">
    <tr><td style="padding:6px 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>
    </td></tr>
  </table>`;
};

/** A small uppercase caption above a details table. */
export const emailCaption = (text: string): string =>
  `<p style="margin:22px 0 8px;font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:${C.clay}">${escape(text)}</p>`;

/**
 * The whole email. `heading` and `bodyHtml` are HTML the caller has already
 * escaped; the brand's own values are escaped here.
 */
export const renderEmail = (
  brand: EmailBrand,
  heading: string,
  bodyHtml: string,
  cta?: { label: string; url: string },
  options: EmailLayoutOptions = {}
): string => {
  const audience = options.audience ?? 'traveller';
  const preheader = escape(options.preheader ?? plainText(bodyHtml).slice(0, 140));
  const title = plainText(heading);
  const logo = brand.logoUrl
    ? `<img src="${escape(brand.logoUrl)}" width="52" height="52" alt="${escape(brand.siteName)}" style="display:block;width:52px;height:52px;border:0;border-radius:50%" />`
    : '';
  const homeLink = (inner: string) => (brand.siteUrl ? `<a href="${escape(brand.siteUrl)}" target="_blank" style="text-decoration:none">${inner}</a>` : inner);

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    body { margin:0; padding:0; background:${C.cream}; -webkit-text-size-adjust:100%; }
    a { color:${C.clay}; }
    @media (max-width: 620px) {
      .gf-pad { padding-left:24px !important; padding-right:24px !important; }
      .gf-h1 { font-size:24px !important; }
      .gf-outer { padding:14px 8px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${C.cream}">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream}">
    <tr>
      <td class="gf-outer" align="center" style="padding:32px 12px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
          <tr>
            <td class="gf-pad" style="background:${C.forest};border-radius:14px 14px 0 0;padding:26px 44px">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${logo ? `<td valign="middle" width="52" style="padding-right:16px">${homeLink(logo)}</td>` : ''}
                  <td valign="middle">
                    ${homeLink(`<span style="font-family:${SERIF};font-size:22px;font-weight:bold;color:${C.gold}">${escape(brand.siteName)}</span>`)}
                    ${brand.tagline ? `<div style="margin-top:4px;font-family:${SANS};font-size:10px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${C.savanna};opacity:.8">${escape(brand.tagline)}</div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="background:${C.gold};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
          <tr>
            <td class="gf-pad" style="background:${C.white};padding:42px 44px 40px">
              <h1 class="gf-h1" style="margin:0 0 20px;font-family:${SERIF};font-size:28px;line-height:1.25;font-weight:bold;color:${C.forest}">${heading}</h1>
              <div style="font-family:${SANS};font-size:15px;line-height:1.7;color:${C.ink}">${bodyHtml}</div>
              ${cta ? button(cta.label, cta.url) : ''}
              ${
                audience === 'traveller'
                  ? `<p style="margin:32px 0 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.ink}">Warm regards,<br /><strong style="font-family:${SERIF};font-size:16px;color:${C.forest}">The ${escape(brand.siteName)} team</strong></p>${helpBox(brand)}`
                  : ''
              }
            </td>
          </tr>
          ${footer(brand, audience)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/** The branded email for `heading` and `bodyHtml`, with the current brand details from Settings. */
export const emailLayout = async (
  heading: string,
  bodyHtml: string,
  cta?: { label: string; url: string },
  options: EmailLayoutOptions = {}
): Promise<string> => renderEmail(await loadEmailBrand(), heading, bodyHtml, cta, options);
