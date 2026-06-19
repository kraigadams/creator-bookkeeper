const RULES: Array<{ keywords: string[]; category: string }> = [
  // ── Income ──────────────────────────────────────────────────────────────
  {
    keywords: [
      "stripe", "youtube", "google adsense", "adsense",
      "sponsor", "sponsorship", "brand deal",
      "impact radius", "avant link", "avantlink", "linktree",
      "shareasale", "cj affiliate", "rakuten", "skimlinks",
      "amazon associates",
      "fedwire credit", "real time payment credit", "ach credit",
      "foreign remittance credit", "incoming wire",
      "fiorellapc", "saily", "icon talents", "pitchblend", "ayzenberg",
      "facebook payout", "meta payout",
    ],
    category: "Business Income",
  },
  {
    keywords: ["amazon europe co", "amazon.com", "amazon corp", "amazon servi"],
    category: "Business Income",
  },

  // ── Advertising & Marketing ──────────────────────────────────────────────
  {
    keywords: ["facebook ads", "meta ads", "google ads", "instagram ads", "tiktok ads"],
    category: "Advertising",
  },

  // ── Software & Subscriptions ─────────────────────────────────────────────
  {
    keywords: [
      "adobe", "dropbox", "google workspace", "notion", "chatgpt", "anthropic",
      "microsoft", "office 365", "github", "figma", "slack", "zoom",
      "1password", "lastpass", "loom", "grammarly", "rev.com",
      "descript", "frame.io", "lucidchart", "airtable", "asana",
      "intuit", "quickbooks", "turbotax",
      "spotify", "netflix", "hulu", "disney",
      "metapay",
    ],
    category: "Software",
  },

  // ── Visa / passport fees ─────────────────────────────────────────────────
  {
    keywords: ["nadra", "visa fee", "passport fee", "consulate"],
    category: "Travel",
  },

  // ── Travel ───────────────────────────────────────────────────────────────
  {
    keywords: [
      "delta", "united", "american airlines", "southwest", "jetblue",
      "alaska air", "spirit", "frontier", "flight", "airline",
      "jr east", "jr west",
    ],
    category: "Travel",
  },
  {
    keywords: ["airbnb", "hotel", "marriott", "hilton", "hyatt", "ihg", "lodging", "hostel"],
    category: "Lodging",
  },
  {
    keywords: ["uber", "lyft", "taxi", "rideshare", "via ride"],
    category: "Travel",
  },

  // ── Gear & Equipment ─────────────────────────────────────────────────────
  {
    keywords: [
      "b&h", "dji", "sony", "apple", "camera", "lens", "drone",
      "rode", "sennheiser", "manfrotto", "joby", "sandisk",
      "recreational equ", "rei ", "path projects",
      "shokz", "space station",
    ],
    category: "Gear / Equipment",
  },

  // ── Office & Workspace ───────────────────────────────────────────────────
  {
    keywords: ["industrious", "wework", "regus", "coworking", "office rent", "office space"],
    category: "Office / Rent",
  },
  {
    keywords: ["ups store", "fedex", "usps", "staples", "office depot"],
    category: "Supplies",
  },

  // ── Meals & Entertainment ─────────────────────────────────────────────────
  {
    keywords: [
      "restaurant", "coffee", "starbucks", "food", "grocery", "meal",
      "doordash", "grubhub", "uber eats", "seamless",
      "live nation", "ticketmaster", "eventbrite",
      "imperiya", "jr east shopping",
    ],
    category: "Meals & Entertainment",
  },

  // ── Internet & Phone ─────────────────────────────────────────────────────
  {
    keywords: ["at&t", "verizon", "t-mobile", "internet", "phone bill", "comcast", "spectrum"],
    category: "Internet / Phone",
  },

  // ── Contractor / Labor ───────────────────────────────────────────────────
  {
    keywords: ["editor", "contractor", "freelance", "upwork", "fiverr", "toptal"],
    category: "Contractor / Editor",
  },

  // ── Professional Services ────────────────────────────────────────────────
  {
    keywords: ["accountant", "lawyer", "legal", "bookkeeping", "cpa"],
    category: "Professional Services",
  },

  // ── Estimated quarterly tax payments (1040-ES / NYS) ────────────────────
  {
    keywords: ["usataxpymt", "irs treas 310", "estimated tax"],
    category: "Tax Payment – Estimated",
  },
  {
    keywords: ["nys dtf pit", "nys dtf bill pyt", "nys tax"],
    category: "Tax Payment – Estimated",
  },
  {
    keywords: ["irs", "nys dtf", "tax payment", "state tax"],
    category: "Tax Payment – Estimated",
  },

  // ── Taxes & Licenses (actual business licenses/fees) ─────────────────────
  {
    keywords: ["business license", "annual report fee", "llc fee", "franchise tax"],
    category: "Taxes & Licenses",
  },

  // ── Bank Fees ────────────────────────────────────────────────────────────
  {
    keywords: [
      "wire fee", "atm fee", "foreign exchange", "exchange rate",
      "non-chase atm", "domestic incoming wire fee", "international incoming wire fee",
      "online domestic wire", "online us dollar", "monthly service fee", "service fee",
      "renewal membership fee", "annual membership fee", "annual fee",
    ],
    category: "Bank Fees",
  },
  {
    keywords: ["remote online deposit"],
    category: "Business Income",
  },

  // ── Owner Draw / Personal ────────────────────────────────────────────────
  {
    keywords: ["atm withdrawal", "atm –", "non-chase atm withdraw", "cash withdrawal"],
    category: "Travel",
  },
  {
    keywords: ["kraig adams", "transfer to personal", "ach to personal", "owner draw", "zelle to self", "transfer to chk", "online transfer to"],
    category: "Owner Draw",
  },

  // ── Transfers (not income/expense) ───────────────────────────────────────
  {
    keywords: ["venmo", "zelle", "wire transfer", "ach transfer"],
    category: "Transfer",
  },
  {
    keywords: ["payment - thank you", "autopay payment", "online payment", "payment received", "mobile payment"],
    category: "Transfer",
  },
  {
    keywords: ["chase card", "loan_pmt", "loan pmt", "credit card payment"],
    category: "Transfer",
  },
];

export function suggestCategory(description: string): string {
  const lower = description.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return "Uncategorized";
}

const EXPENSE_CATEGORIES = new Set([
  "Advertising", "Gear / Equipment", "Travel", "Lodging",
  "Meals & Entertainment", "Software", "Subscriptions",
  "Office / Rent", "Supplies", "Internet / Phone",
  "Contractor / Editor", "Professional Services",
  "Insurance", "Bank Fees", "Taxes & Licenses",
  "Tax Payment – Estimated", "Tax Payment – Annual Return",
]);

const INCOME_CATEGORIES = new Set([
  "Business Income", "Affiliate Income", "Sponsorship Income", "YouTube / Ad Revenue",
]);

export function inferType(
  amount: number,
  category: string
): "Income" | "Expense" | "Transfer" | "Unknown" {
  if (category === "Transfer" || category === "Owner Draw" || category === "Tax Payment – Estimated" || category === "Tax Payment – Annual Return") return "Transfer";
  if (INCOME_CATEGORIES.has(category)) return "Income";
  if (EXPENSE_CATEGORIES.has(category)) return "Expense";
  if (amount < 0) return "Expense";
  if (amount > 0) return "Income";
  return "Unknown";
}

export function suggestCategoryAndType(description: string, amount: number): { category: string; type: string } {
  const category = suggestCategory(description);
  const resolvedCategory = category === "Uncategorized" && amount > 0 ? "Business Income" : category;
  const type = inferType(amount, resolvedCategory);
  return { category: resolvedCategory, type };
}

export const DEFAULT_CATEGORIES = [
  "Business Income",
  "Sponsorship Income",
  "YouTube / Ad Revenue",
  "Affiliate Income",
  "Advertising",
  "Gear / Equipment",
  "Travel",
  "Lodging",
  "Meals & Entertainment",
  "Software",
  "Subscriptions",
  "Office / Rent",
  "Supplies",
  "Internet / Phone",
  "Contractor / Editor",
  "Professional Services",
  "Insurance",
  "Bank Fees",
  "Taxes & Licenses",
  "Tax Payment – Estimated",
  "Tax Payment – Annual Return",
  "Owner Draw",
  "Transfer",
  "Uncategorized",
];
