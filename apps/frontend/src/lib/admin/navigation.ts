import type { Component } from 'svelte';
import {    Bot,
    CalendarDays,
    CalendarRange,
    ChevronDown,
    ChevronLeft,
    CircleDollarSign,
    CircleHelp,
    ClipboardList,
    Compass,
    GitCompare,
    LayoutTemplate,
    Heart,
    CreditCard,
    FileText,
    FolderTree,
    Globe,
    Home,
    Hotel,
    Image,
    Images,
    LayoutDashboard,
    ChartColumnBig,
    Plug,
    ListCheck,
    Mail,
    Map,
    MapPin,
    MessageCircle,
    MessageCircleHeart,
    Newspaper,
    Palette,
    Plane,
    Route,
    ScrollText,
    Search,
    Settings,
    ShieldCheck,
    Signpost,
    Star,
    Tags,
    TriangleAlert,
    Upload,
    Users,
    Waypoints,
    X} from '@lucide/svelte';
export type NavLink = { exact?: boolean; href: string; icon: Component; inactivePlaceholder?: boolean; label: string };
export type NavGroup = { label: string; links: NavLink[] };
export const groups: NavGroup[] = [
    { label: 'Workspace', links: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true }, { href: '/admin/analytics', label: 'Analytics', icon: ChartColumnBig }, { href: '/admin/attribution', label: 'Attribution', icon: Waypoints }] },
    {
      label: 'Safaris & destinations',
      links: [
        { href: '/admin/tours', label: 'Tours', icon: Map, exact: true },
        { href: '/admin/categories', label: 'Categories', icon: Tags },
        { href: '/admin/destinations', label: 'Destinations', icon: MapPin },
        { href: '/admin/lodges', label: 'Lodges & Camps', icon: Hotel },
        { href: '/admin/specialists', label: 'Tour Specialists', icon: Users },
        { href: '/admin/activities', label: 'Activities', icon: Compass },
        { href: '/admin/trip-points', label: 'Start & End Points', icon: Plane },
        { href: '/admin/itineraries', label: 'Itineraries', icon: Route },
        { href: '/admin/available-dates', label: 'Available Dates', icon: CalendarDays },
        { href: '/admin/pricing-options', label: 'Pricing Options', icon: CircleDollarSign },
        { href: '/admin/exchange-rates', label: 'Exchange Rates', icon: CircleDollarSign },
        { href: '/admin/tour-details', label: 'Tour Details', icon: ListCheck },
        { href: '/admin/import', label: 'Import Content (CSV)', icon: Upload }
      ]
    },
    {
      label: 'Bookings & guests',
      links: [
        { href: '/admin/bookings', label: 'Bookings', icon: ClipboardList },
        { href: '/admin/quotations', label: 'Quotations', icon: FileText },
        { href: '/admin/payments', label: 'Payments', icon: CreditCard },
        { href: '/admin/messages', label: 'Messages', icon: Mail }
      ]
    },
    {
      label: 'Website & content',
      links: [
        { href: '/admin/blog', label: 'Blog', icon: Newspaper, exact: true },
        { href: '/admin/blog/categories', label: 'Blog Categories', icon: FolderTree },
        { href: '/admin/gallery', label: 'Gallery', icon: Images },
        { href: '/admin/media', label: 'Media Library', icon: Image },
        { href: '/admin/testimonials', label: 'Testimonials', icon: MessageCircleHeart },
        { href: '/admin/reviews', label: 'Reviews', icon: Star },
        { href: '/admin/migration-calendar', label: 'Migration Calendar', icon: CalendarRange },
        { href: '/admin/faqs', label: 'FAQs', icon: CircleHelp },
        { href: '/admin/safety', label: 'Safety Guide', icon: ShieldCheck },
        { href: '/admin/travel-styles', label: 'Travel Styles', icon: Heart },
        { href: '/admin/safari-packages', label: 'Safari Packages', icon: LayoutTemplate },
        { href: '/admin/comparisons', label: 'Comparisons', icon: GitCompare },
        { href: '/admin/homepage', label: 'Homepage', icon: Home }
      ]
    },
    {
      label: 'Conversations',
      links: [
        { href: '/admin/ai-conversations', label: 'AI Conversations', icon: Bot, exact: true },
        { href: '/admin/whatsapp', label: 'WhatsApp Inbox', icon: MessageCircle, exact: true },
        { href: '/admin/ai-usage', label: 'AI Usage & Cost', icon: CircleDollarSign }
      ]
    },
    {
      label: 'Administration',
      links: [
        { href: '/admin/users', label: 'Users', icon: Users },
        { href: '/admin/roles', label: 'Roles & Permissions', icon: ShieldCheck },
        { href: '/admin/branding', label: 'Branding', icon: Palette },
        { href: '/admin/settings', label: 'Settings', icon: Settings },
        { href: '/admin/settings/integrations', label: 'Integrations', icon: Plug },
        { href: '/admin/redirects', label: 'Redirects', icon: Signpost },
        { href: '/admin/page-seo', label: 'Page SEO', icon: Globe },
        { href: '/admin/error-logs', label: 'Error Logs', icon: TriangleAlert },
        { href: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText }
      ]
    }
  ];
export const navigationLinks = groups.flatMap(group => group.links);
export function activeNavigation(path: string) { return navigationLinks.filter(link => path === link.href || (link.href !== '/admin' && path.startsWith(link.href + '/'))).sort((a,b) => b.href.length - a.href.length)[0]; }
