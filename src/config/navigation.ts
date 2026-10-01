/**
 * Icon identifiers used by nav items. These are plain strings (not component
 * references) so the config stays serializable and can be passed from Server
 * Components into Client Components. The actual Lucide components are resolved
 * in the client via the icon map in `nav-links.tsx`.
 */
export type NavIcon =
  | "dashboard"
  | "expenses"
  | "income"
  | "accounts"
  | "categories"
  | "loans"
  | "investments"
  | "assets"
  | "reports"
  | "settings";

export interface NavItem {
  title: string;
  href: string;
  icon: NavIcon;
  /** Optional short description used by command palettes / tooltips. */
  description?: string;
}

/**
 * Primary navigation shown in the sidebar. Order here is the order rendered.
 */
export const primaryNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "dashboard",
    description: "Overview of your finances",
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: "expenses",
    description: "Track what you spend",
  },
  {
    title: "Income",
    href: "/income",
    icon: "income",
    description: "Track what you earn",
  },
  {
    title: "Accounts",
    href: "/accounts",
    icon: "accounts",
    description: "Cash, bank, cards and more",
  },
  {
    title: "Categories",
    href: "/categories",
    icon: "categories",
    description: "Organise transactions",
  },
  {
    title: "Loans",
    href: "/loans",
    icon: "loans",
    description: "Money borrowed and lent",
  },
  {
    title: "Investments",
    href: "/investments",
    icon: "investments",
    description: "Holdings and their performance",
  },
  {
    title: "Assets",
    href: "/assets",
    icon: "assets",
    description: "Property, vehicles and valuables",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: "reports",
    description: "Summaries and insights",
  },
];

export const secondaryNav: NavItem[] = [
  {
    title: "Settings",
    href: "/settings",
    icon: "settings",
    description: "Preferences and account",
  },
];

/** Destinations pinned to the mobile bottom bar; the rest live under "More". */
export const bottomNavHrefs = [
  "/dashboard",
  "/expenses",
  "/income",
  "/accounts",
] as const;

const allNav = [...primaryNav, ...secondaryNav];

/** The nav item that owns `pathname`, used for the mobile app bar title. */
export function findNavItem(pathname: string): NavItem | undefined {
  return allNav.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
