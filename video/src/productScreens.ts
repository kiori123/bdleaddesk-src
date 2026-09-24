import { staticFile } from "remotion";

export type ProductScreen = {
  src: string;
  url: string;
  title: string;
  subtitle: string;
};

export const PRODUCT_SCREENS: ProductScreen[] = [
  {
    src: staticFile("screenshots/login.png"),
    url: "leaddesk.onpoint.vn/login",
    title: "Sign in",
    subtitle: "Supabase Auth handles identity. No separate PIN or OTP layer.",
  },
  {
    src: staticFile("screenshots/dashboard.png"),
    url: "leaddesk.onpoint.vn",
    title: "Every brand, one board",
    subtitle: "Brands researched, contacts revealed, and how complete each one is, at a glance.",
  },
  {
    src: staticFile("screenshots/newscan.png"),
    url: "leaddesk.onpoint.vn/scan",
    title: "Three ways in, one budget",
    subtitle: "Explore a brand, find a role, or get a single contact — today's scan and credit limits shown up front.",
  },
  {
    src: staticFile("screenshots/searchform.png"),
    url: "leaddesk.onpoint.vn/scan/role",
    title: "Search the way BD actually thinks",
    subtitle: "Brand, category and region narrow the search. Title words only reorder — nobody gets dropped.",
  },
  {
    src: staticFile("screenshots/brandpipeline.png"),
    url: "leaddesk.onpoint.vn/brand/[id]",
    title: "Stage, category, documents",
    subtitle: "Everything about one brand — pipeline stage, category access, shared files — in one place.",
  },
  {
    src: staticFile("screenshots/admin.png"),
    url: "leaddesk.onpoint.vn/admin",
    title: "Credit, on a budget",
    subtitle: "Every category gets a monthly credit budget. It resets on the 1st and never rolls over.",
  },
];
