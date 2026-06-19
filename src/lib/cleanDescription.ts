// Extract a readable merchant/payee name from raw bank description strings.
// Handles Chase ACH format: "ORIG CO NAME:GOOGLE ORIG ID:..."
// Falls back to title-casing the raw string if no known pattern matches.

const MERCHANT_MAP: Array<[RegExp, string]> = [
  [/amazon.*associates/i, "Amazon Associates"],
  [/amazon\.com\s*servi/i, "Amazon Associates"],
  [/amazon\s*japan/i, "Amazon Japan"],
  [/amazon\s*europe/i, "Amazon Europe"],
  [/amazon\s*mktplace/i, "Amazon Marketplace"],
  [/amazon/i, "Amazon"],
  [/google.*youtube/i, "Google / YouTube"],
  [/google\s*pay(ment)?/i, "Google Payment"],
  [/apple\.com\/bill/i, "Apple"],
  [/apple\s+card/i, "Apple Card"],
  [/paypal/i, "PayPal"],
  [/venmo/i, "Venmo"],
  [/zelle/i, "Zelle"],
  [/shopify/i, "Shopify"],
  [/stripe/i, "Stripe"],
  [/squarespace/i, "Squarespace"],
];

export function cleanDescription(raw: string): string {
  // Named merchant lookup before any other processing
  for (const [pattern, name] of MERCHANT_MAP) {
    if (pattern.test(raw)) return name;
  }

  // Chase ACH: "ORIG CO NAME:GOOGLE ORIG ID:..."
  const origCoName = raw.match(/ORIG CO NAME:([^O][^\s](?:[^O]|O(?!RIG))*?)(?:\s+ORIG|\s+DESC|\s+CO ENTRY|$)/i);
  if (origCoName) return toTitleCase(origCoName[1].trim());

  // Chase wire: "REAL TIME TRANSFER RECD FROM ABA/CONTR BNK-... FROM: PayeeName Via..."
  const wireFrom = raw.match(/FROM:\s+(.+?)\s+Via\s/i);
  if (wireFrom) return toTitleCase(wireFrom[1].trim());

  // Chase ATM: "ATM WITHDRAWAL 005025 06/14401 FLATB" → "ATM Withdrawal"
  if (/^ATM\s/i.test(raw)) {
    const place = raw.match(/ATM\s+\w+\s+[\d/]+\s+(.+)/i);
    return place ? `ATM – ${toTitleCase(place[1].trim())}` : "ATM Withdrawal";
  }

  // Chase card payments: "Payment to Chase card ending in 3118 07/08"
  const cardPayment = raw.match(/Payment to (.+?) ending in (\d+)/i);
  if (cardPayment) return `${toTitleCase(cardPayment[1])} …${cardPayment[2]}`;

  // Chase online transfers: "Online Transfer to CHK ...9595 transaction#: ..."
  const onlineTransfer = raw.match(/Online Transfer (to|from) (\w+)\s*\.\.\.(\d+)/i);
  if (onlineTransfer) return `Transfer ${onlineTransfer[1]} ${onlineTransfer[2].toUpperCase()} …${onlineTransfer[3]}`;

  // Already short enough — just title-case it
  if (raw.length <= 40) return toTitleCase(raw);

  // Long unrecognized string — take first meaningful segment before extra metadata
  const firstSegment = raw.split(/\s{2,}|\s+ORIG\s+ID|\s+TRACE#|\s+IND\s+/)[0];
  return toTitleCase(firstSegment.trim().slice(0, 60));
}

const KEEP_UPPER = new Set([
  "IRS", "NYS", "DTF", "ATM", "ACH", "LLC", "INC", "CO", "PIT",
  "USA", "ABA", "PPD", "CCD", "WEB", "DJI", "US", "UK", "EU",
]);

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w+/g, (word) => {
      const upper = word.toUpperCase();
      return KEEP_UPPER.has(upper) ? upper : word.charAt(0).toUpperCase() + word.slice(1);
    });
}
