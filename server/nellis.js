const NELLIS_BASE = 'https://nellisauction.com';

const DEFAULT_HEADERS = {
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
};

function getHeaders(cookies) {
  return {
    ...DEFAULT_HEADERS,
    'cookie': cookies,
    'referer': `${NELLIS_BASE}/dashboard/purchases`,
  };
}

/**
 * Fetch the purchases list from Nellis dashboard.
 * Pagination uses _p param: s:<size>,n:<page> (0-indexed)
 */
export async function fetchPurchasesList(cookies, page = 0, size = 30) {
  const paginationParam = encodeURIComponent(`s:${size},n:${page}`);
  const url = `${NELLIS_BASE}/dashboard/purchases?_p=${paginationParam}&_data=routes%2Fdashboard.purchases._index`;
  const res = await fetch(url, { headers: getHeaders(cookies) });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Failed to fetch purchases list: ${res.status} - ${text.slice(0, 300)}`);
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Empty response from Nellis API — cookies may be expired. Re-export from browser.');
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    // Might be HTML redirect page if session expired
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      throw new Error('Nellis returned HTML instead of JSON — session expired. Update NELLIS_COOKIES in .env');
    }
    throw new Error(`Invalid JSON from Nellis: ${text.slice(0, 300)}`);
  }
}

/**
 * Fetch product detail by product ID and title slug.
 */
export async function fetchProductDetail(cookies, productId, titleSlug) {
  const slug = titleSlug || 'product';
  const url = `${NELLIS_BASE}/p/${encodeURIComponent(slug)}/${productId}?_data=routes%2Fp.%24title.%24productId._index`;
  const res = await fetch(url, { headers: getHeaders(cookies) });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Failed to fetch product ${productId}: ${res.status} - ${text.slice(0, 200)}`);
  }

  if (!text || text.trim().length === 0) {
    throw new Error(`Empty response for product ${productId}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      throw new Error(`HTML response for product ${productId} — session expired`);
    }
    throw new Error(`Invalid JSON for product ${productId}: ${text.slice(0, 200)}`);
  }
}

/**
 * Extract a clean purchase record from a product detail response.
 */
export function extractPurchaseData(productDetail) {
  const p = productDetail.product;
  if (!p) return null;

  const winningBid = productDetail.bidHistory?.find(b => b.type === 'Winning');
  const purchasePrice = winningBid
    ? parseFloat(winningBid.amount.replace(/[^0-9.]/g, ''))
    : p.currentPrice;

  return {
    product_id: p.id,
    title: p.title,
    image_url: p.photos?.[0]?.url || null,
    purchase_price: purchasePrice,
    retail_price: p.retailPrice || null,
    location: p.location?.name || null,
    purchase_date: p.closeTime?.value || null,
    category: [p.taxonomyLevel1, p.taxonomyLevel2].filter(Boolean).join(' > ') || null,
    condition: p.grade?.conditionType?.description || null,
  };
}

/**
 * Fetch receipt detail for a specific purchase by buyNowId.
 * Returns buyer premium %, tax %, and the bid amount.
 */
export async function fetchReceiptDetail(cookies, buyNowId) {
  const url = `${NELLIS_BASE}/dashboard/purchases/${buyNowId}?_data=routes%2Fdashboard.purchases.%24buyNowId`;
  const res = await fetch(url, { headers: getHeaders(cookies) });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Failed to fetch receipt ${buyNowId}: ${res.status} - ${text.slice(0, 200)}`);
  }

  if (!text || text.trim().length === 0) {
    throw new Error(`Empty response for receipt ${buyNowId}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      throw new Error(`HTML response for receipt ${buyNowId} — session expired`);
    }
    throw new Error(`Invalid JSON for receipt ${buyNowId}: ${text.slice(0, 200)}`);
  }
}

/**
 * Extract fee data from a receipt detail response.
 */
export function extractReceiptFees(receiptData) {
  const item = receiptData.itemData;
  if (!item) return null;

  const amount = item.amount || 0;
  const premiumPct = item.buyerPremiumPercent || 0;
  const taxPct = item.taxPercent || 0;

  const premium = +(amount * premiumPct / 100).toFixed(2);
  const tax = +((amount + premium) * taxPct / 100).toFixed(2);
  const totalCost = +(amount + premium + tax).toFixed(2);

  return {
    buy_now_id: item.buyNowId,
    product_id: item.projectId,
    purchase_price: amount,
    buyer_premium_pct: premiumPct,
    tax_pct: taxPct,
    buyer_premium: premium,
    tax_amount: tax,
    total_cost: totalCost,
  };
}

/**
 * Submit a return request to Nellis Auction.
 * returnTypeId: 1=No Longer Wanted, 2=Inaccurate Description, 3=Never Received, 4=Other
 * Returns true on 204/success, throws on error.
 */
export async function submitReturn(cookies, buyNowId, returnTypeId, returnReason) {
  const url = `${NELLIS_BASE}/dashboard/purchases/${buyNowId}?_data=routes%2Fdashboard.purchases.%24buyNowId`;
  const body = new URLSearchParams({
    __rvfInternalFormId: 'returnForm',
    returnTypeId: String(returnTypeId),
    returnReason,
    id: String(buyNowId),
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      'cookie': cookies,
      'referer': `${NELLIS_BASE}/dashboard/purchases/${buyNowId}`,
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'origin': NELLIS_BASE,
    },
    body: body.toString(),
  });

  // Nellis returns 204 No Content on success
  if (res.status === 204 || res.status === 200) {
    return { success: true };
  }

  const text = await res.text();
  throw new Error(`Return request failed: ${res.status} — ${text.slice(0, 300)}`);
}
