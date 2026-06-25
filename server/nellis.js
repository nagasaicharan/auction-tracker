const NELLIS_BASE = 'https://nellisauction.com';
const NELLIS_WEB_BASE = 'https://www.nellisauction.com';

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

function getHeaders(cookies, refererPath = '/dashboard/purchases') {
  return {
    ...DEFAULT_HEADERS,
    'cookie': cookies,
    'referer': `${NELLIS_BASE}${refererPath}`,
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
  } catch {
    // Might be HTML redirect page if session expired
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      throw new Error('Nellis returned HTML instead of JSON — session expired. Update NELLIS_COOKIES in .env');
    }
    throw new Error(`Invalid JSON from Nellis: ${text.slice(0, 300)}`);
  }
}

export async function fetchSearchResults(cookies, query = {}) {
  const params = new URLSearchParams();
  const normalizedQuery = new URLSearchParams();
  normalizedQuery.set('_data', 'routes/search');

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === undefined || item === null || item === '') return;
        params.append(key, String(item));
      });
    } else {
      params.set(key, String(value));
    }
  }

  for (const [key, value] of params.entries()) {
    normalizedQuery.append(key, value);
  }

  async function executeSearchRequest(queryObject) {
    const requestQuery = new URLSearchParams(queryObject);
    const url = `${NELLIS_WEB_BASE}/search?${requestQuery.toString()}`;
    const searchRes = await fetch(url, {
      headers: {
        ...DEFAULT_HEADERS,
        accept: 'application/json',
        'cookie': cookies,
        'origin': NELLIS_WEB_BASE,
        'referer': `${NELLIS_WEB_BASE}/search`,
        'sec-fetch-site': 'same-site',
      },
    });
    const text = await searchRes.text();
    return { searchRes, text };
  }

  const primary = await executeSearchRequest(normalizedQuery);
  let res = primary.searchRes;
  let text = primary.text;

  if (!res.ok && res.status === 403 && text.includes('Unexpected Server Error')) {
    const warmup = new URLSearchParams(normalizedQuery);
    warmup.set('_data', 'root');
    await executeSearchRequest(warmup);
    const retryQuery = new URLSearchParams(normalizedQuery);
    retryQuery.set('_data', 'routes/search');
    const retry = await executeSearchRequest(retryQuery);
    res = retry.searchRes;
    text = retry.text;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch search results: ${res.status} - ${text.slice(0, 300)}`);
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Empty response from Nellis search API.');
  }

  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      throw new Error('Nellis search endpoint returned HTML — session may be expired.');
    }
    throw new Error(`Invalid JSON from Nellis search: ${text.slice(0, 300)}`);
  }
}

export async function fetchLostAuctions(cookies, { page = 0, size = 20 } = {}) {
  const paginationParam = encodeURIComponent(`s:${size},n:${page}`);
  const url = `${NELLIS_WEB_BASE}/dashboard/auctions/lost?_p=${paginationParam}&_data=routes%2Fdashboard.auctions.lost`;
  const res = await fetch(url, {
    headers: {
      ...DEFAULT_HEADERS,
      accept: 'application/json',
      'cookie': cookies,
      'referer': `${NELLIS_WEB_BASE}/dashboard/auctions/lost`,
    },
  });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Failed to fetch lost auctions: ${res.status} - ${text.slice(0, 300)}`);
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Empty response from Nellis lost auctions API.');
  }

  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      throw new Error('Nellis lost auctions endpoint returned HTML — session may be expired.');
    }
    throw new Error(`Invalid JSON from Nellis lost auctions: ${text.slice(0, 300)}`);
  }
}

export async function fetchNellisSavedSearches(cookies, { size = 15, maxPages = 10 } = {}) {
  const records = [];
  let total = null;

  for (let page = 0; page < maxPages; page += 1) {
    const paginationParam = encodeURIComponent(`s:${size},n:${page}`);
    const url = `${NELLIS_WEB_BASE}/dashboard/saved-searches?_p=${paginationParam}&_data=routes%2Fdashboard.saved-searches`;
    const res = await fetch(url, {
      headers: {
        ...DEFAULT_HEADERS,
        accept: 'application/json',
        'cookie': cookies,
        'referer': `${NELLIS_WEB_BASE}/dashboard/saved-searches`,
      },
    });
    const text = await res.text();

    if (!res.ok) {
      throw new Error(`Failed to fetch saved searches: ${res.status} - ${text.slice(0, 300)}`);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (text.includes('<html') || text.includes('<!DOCTYPE')) {
        throw new Error('Nellis saved searches endpoint returned HTML — session may be expired.');
      }
      throw new Error(`Invalid JSON from Nellis saved searches: ${text.slice(0, 300)}`);
    }

    const pageData = data?.page || {};
    const pageRecords = Array.isArray(pageData.records) ? pageData.records : [];
    total = Number.isFinite(Number(pageData.total)) ? Number(pageData.total) : total;
    records.push(...pageRecords.map(normalizeNellisSavedSearch).filter(Boolean));

    if (!pageRecords.length || (total !== null && records.length >= total)) break;
  }

  return {
    total: total ?? records.length,
    records,
  };
}

function parseCurrency(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'string'
    ? Number(value.replace(/[^0-9.-]/g, ''))
    : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function pickImage(rawItem) {
  return rawItem?.photos?.[0]?.url
    || rawItem?.imageUrl
    || rawItem?.image_url
    || rawItem?.image
    || rawItem?.product?.photos?.[0]?.url
    || null;
}

function findLikelyItemArrays(value, arrays = [], seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return arrays;
  seen.add(value);

  if (Array.isArray(value)) {
    const objectRows = value.filter((item) => item && typeof item === 'object');
    const likelyRows = objectRows.filter((item) => (
      item.title || item.product?.title || item.project?.title || item.productId || item.projectId || item.id
    ));
    if (likelyRows.length) arrays.push(value);
    value.forEach((item) => findLikelyItemArrays(item, arrays, seen));
    return arrays;
  }

  Object.values(value).forEach((child) => findLikelyItemArrays(child, arrays, seen));
  return arrays;
}

export function extractLostAuctionItems(data) {
  const candidates = [
    data?.auctions,
    data?.items,
    data?.products,
    data?.lostAuctions,
    data?.lostItems,
    data?.data?.auctions,
    data?.data?.items,
    data?.data?.products,
    ...findLikelyItemArrays(data),
  ].filter(Array.isArray);

  const best = candidates
    .map((rows) => rows.filter((item) => item && typeof item === 'object'))
    .sort((a, b) => b.length - a.length)[0] || [];

  return best.map(normalizeLostAuctionItem).filter(Boolean);
}

export function normalizeLostAuctionItem(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') return null;
  const product = rawItem.product || rawItem.project || rawItem.item || rawItem;
  const id = firstDefined(product.id, rawItem.productId, rawItem.projectId, rawItem.id);
  const title = firstDefined(product.title, rawItem.title, rawItem.name);

  if (!id && !title) return null;

  const lastSoldPrice = parseCurrency(firstDefined(
    rawItem.winningBidAmount,
    rawItem.finalPrice,
    rawItem.closePrice,
    rawItem.soldPrice,
    rawItem.currentPrice,
    rawItem.amount,
    product.currentPrice,
  ));

  return {
    id: id || null,
    title: title || 'Untitled',
    inventoryNumber: firstDefined(product.inventoryNumber, rawItem.inventoryNumber) || null,
    image: pickImage(rawItem),
    lastSoldPrice,
    closeTime: firstDefined(product.closeTime?.value, product.closeTime, rawItem.closeTime?.value, rawItem.closeTime) || null,
    locationName: firstDefined(product.location?.name, rawItem.location?.name, rawItem.locationName) || null,
  };
}

export function normalizeNellisSavedSearch(rawItem) {
  if (!rawItem || typeof rawItem !== 'object' || !rawItem.searchText) return null;
  const searchText = String(rawItem.searchText).trim();
  if (!searchText) return null;

  return {
    id: `nellis-${rawItem.id}`,
    source: 'nellis',
    name: searchText,
    filters: {
      search: searchText,
      MarketStatus: 'open',
    },
    sortBy: 'valueMarginPercent',
    secondarySortBy: '',
    onlyNoDamage: false,
    onlyMinorDamage: false,
    autoRefresh: true,
    pollSeconds: 30,
    readOnly: true,
    nellisId: rawItem.id,
    city: rawItem.city || null,
    state: rawItem.state || null,
    createdAt: rawItem.createdAt?.value || rawItem.createdAt || null,
    updatedAt: rawItem.updatedAt?.value || rawItem.updatedAt || null,
  };
}

export function normalizeSearchItem(rawItem) {
  if (!rawItem || !rawItem.id) return null;

  const currentPrice = parseCurrency(rawItem.currentPrice);
  const retailPrice = parseCurrency(rawItem.retailPrice);
  const margin = (retailPrice !== null && currentPrice !== null)
    ? Number((retailPrice - currentPrice).toFixed(2))
    : null;
  const marginPercent = (retailPrice && retailPrice > 0 && currentPrice !== null)
    ? Number((((retailPrice - currentPrice) / retailPrice) * 100).toFixed(2))
    : null;
  const image = rawItem.photos?.[0]?.url || null;
  const closeAt = rawItem.closeTime?.value || rawItem.closeTime || null;
  const photos = Array.isArray(rawItem.photos) ? rawItem.photos.map((photo) => photo?.url).filter(Boolean) : [];
  const grade = rawItem.grade || null;

  return {
    id: rawItem.id,
    title: rawItem.title || 'Untitled',
    inventoryNumber: rawItem.inventoryNumber || null,
    image,
    photos,
    retailPrice,
    currentPrice,
    bidCount: rawItem.bidCount || 0,
    bidderCount: rawItem.bidderCount || 0,
    closeTime: closeAt,
    isClosed: Boolean(rawItem.isClosed),
    marketStatus: rawItem.marketStatus || null,
    locationName: rawItem.location?.name || null,
    nextBid: parseCurrency(rawItem.userState?.nextBid),
    canBid: Boolean(rawItem.userState?.isAllowedToBid),
    isWinning: Boolean(rawItem.userState?.isWinning),
    notes: rawItem.notes || null,
    watchlistCount: rawItem.watchlistCount || 0,
    extensionInterval: rawItem.extensionInterval || null,
    projectExtended: Boolean(rawItem.projectExtended),
    notReturnable: Boolean(rawItem.notReturnable),
    valueMargin: margin,
    valueMarginPercent: marginPercent,
    rating: parseCurrency(grade?.rating),
    gradeCategory: grade?.conditionType?.description || null,
    damageType: grade?.damageType?.description || null,
    functionalType: grade?.functionalType?.description || null,
    packageType: grade?.packageType?.description || null,
    missingPartsType: grade?.missingPartsType?.description || null,
    assemblyType: grade?.assemblyType?.description || null,
  };
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
  } catch {
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
  } catch {
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

function normalizeAppointmentTimeValue(appointmentTime) {
  if (!appointmentTime) return null;
  const date = new Date(appointmentTime);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Fetch appointments from the Nellis dashboard.
 */
export async function fetchAppointments(cookies, page = 0, size = 20) {
  const paginationParam = encodeURIComponent(`s:${size},n:${page}`);
  const url = `${NELLIS_BASE}/dashboard/appointments?_p=${paginationParam}&_data=routes%2Fdashboard.appointments`;
  const res = await fetch(url, {
    headers: {
      ...DEFAULT_HEADERS,
      'cookie': cookies,
      'referer': `${NELLIS_BASE}/dashboard/appointments`,
    },
  });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Failed to fetch appointments: ${res.status} - ${text.slice(0, 300)}`);
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Empty response from Nellis appointments API.');
  }

  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      throw new Error('Nellis appointments endpoint returned HTML — session may be expired.');
    }
    throw new Error(`Invalid JSON from Nellis appointments: ${text.slice(0, 300)}`);
  }
}

/**
 * Fetch details and available slots for a specific appointment.
 */
export async function fetchAppointmentReschedule(cookies, appointmentId) {
  const url = `${NELLIS_BASE}/dashboard/appointments/${appointmentId}/reschedule?_data=routes%2Fdashboard.appointments_.%24appointmentId_.reschedule`;
  const res = await fetch(url, {
    headers: {
      ...DEFAULT_HEADERS,
      'cookie': cookies,
      'referer': `${NELLIS_BASE}/dashboard/appointments/${appointmentId}/reschedule`,
    },
  });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Failed to fetch appointment ${appointmentId} reschedule details: ${res.status} - ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      throw new Error(`Nellis returned HTML for appointment ${appointmentId} — session may be expired.`);
    }
    throw new Error(`Invalid JSON for appointment ${appointmentId}: ${text.slice(0, 300)}`);
  }
}

/**
 * Submit an appointment reschedule request.
 * appointmentTime can be any date string supported by JS Date; function normalizes to ISO.
 */
export async function submitAppointmentReschedule(cookies, appointmentId, appointmentTime) {
  const isoTime = normalizeAppointmentTimeValue(appointmentTime);
  if (!isoTime) {
    throw new Error('Invalid appointmentTime provided');
  }

  const url = `${NELLIS_BASE}/dashboard/appointments/${appointmentId}/reschedule?_data=routes%2Fdashboard.appointments_.%24appointmentId_.reschedule`;
  const body = new URLSearchParams({
    AppointmentTime: isoTime,
    Intent: '',
    AppointmentId: '',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      'cookie': cookies,
      'origin': NELLIS_BASE,
      'referer': `${NELLIS_BASE}/dashboard/appointments/${appointmentId}/reschedule`,
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: body.toString(),
  });

  if (res.status === 204 || res.status === 200) {
    return { success: true, appointmentTime: isoTime };
  }

  const text = await res.text();
  throw new Error(`Reschedule failed for ${appointmentId}: ${res.status} - ${text.slice(0, 300)}`);
}

export async function placeBid(cookies, productId, bid, recaptchaToken = null) {
  const url = 'https://www.nellisauction.com/api/bids';
  const normalizedBid = Number(bid);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      'cookie': cookies,
      'origin': NELLIS_BASE,
      'referer': `${NELLIS_BASE}/`,
      'accept': 'application/json',
      'content-type': 'application/json',
      'sec-fetch-site': 'same-site',
    },
    body: JSON.stringify({
      productId: Number(productId),
      bid: normalizedBid,
      recaptchaToken: recaptchaToken || null,
    }),
  });

  const text = await res.text();
  let responsePayload = null;
  if (text) {
    try {
      responsePayload = JSON.parse(text);
    } catch {
      responsePayload = text;
    }
  }

  if (!res.ok) {
    return {
      success: false,
      status: res.status,
      response: responsePayload,
      message:
        typeof responsePayload === 'string'
          ? responsePayload.slice(0, 500)
          : responsePayload?.message || responsePayload?.error || 'Bid request was rejected',
    };
  }

  return { success: true, status: res.status, response: responsePayload || null };
}

export { normalizeAppointmentTimeValue };
