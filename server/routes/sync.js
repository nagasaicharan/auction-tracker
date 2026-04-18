import { Router } from 'express';
import db from '../db.js';
import { fetchPurchasesList, fetchProductDetail, extractPurchaseData, fetchReceiptDetail, extractReceiptFees } from '../nellis.js';
import { getCookies } from '../cookies.js';

const router = Router();

const upsertFromList = db.prepare(`
  INSERT INTO purchases (product_id, title, image_url, location, purchase_date, buy_now_id, synced_at)
  VALUES (@product_id, @title, @image_url, @location, @purchase_date, @buy_now_id, datetime('now'))
  ON CONFLICT(product_id) DO UPDATE SET
    title = excluded.title,
    image_url = COALESCE(excluded.image_url, purchases.image_url),
    location = COALESCE(excluded.location, purchases.location),
    purchase_date = COALESCE(excluded.purchase_date, purchases.purchase_date),
    buy_now_id = COALESCE(excluded.buy_now_id, purchases.buy_now_id),
    synced_at = datetime('now'),
    updated_at = datetime('now')
`);

const updateFromDetail = db.prepare(`
  UPDATE purchases SET
    purchase_price = @purchase_price,
    retail_price = @retail_price,
    category = @category,
    condition = @condition,
    image_url = COALESCE(@image_url, image_url),
    updated_at = datetime('now')
  WHERE product_id = @product_id
`);

const updateFromReceipt = db.prepare(`
  UPDATE purchases SET
    purchase_price = @purchase_price,
    buyer_premium_pct = @buyer_premium_pct,
    tax_pct = @tax_pct,
    buyer_premium = @buyer_premium,
    tax_amount = @tax_amount,
    total_cost = @total_cost,
    updated_at = datetime('now')
  WHERE product_id = @product_id
`);

// POST /api/sync — Sync purchases from Nellis auction
router.post('/', async (req, res) => {
  try {
    const cookies = getCookies();
    if (!cookies || cookies.includes('YOUR_SESSION_COOKIE_HERE')) {
      return res.status(401).json({ error: 'Not logged in — please log in first' });
    }

    // Step 1: Fetch all pages of purchases list
    let allRecords = [];
    let page = 0;
    let totalItems = 0;

    console.log('Starting sync — fetching purchases list...');

    while (true) {
      const data = await fetchPurchasesList(cookies, page);
      const purchases = data.purchases;
      
      if (!purchases || !purchases.records) {
        console.log('Unexpected response shape:', Object.keys(data));
        break;
      }

      totalItems = purchases.total;
      const records = purchases.records;

      for (const record of records) {
        allRecords.push({
          product_id: record.projectId,
          title: record.leadDescription,
          image_url: record.photo?.url || null,
          location: record.locationName || null,
          purchase_date: record.originalReceiptCreatedAt?.value || null,
          buy_now_id: record.buyNowId || null,
        });
      }

      console.log(`Page ${page}: got ${records.length} items (${allRecords.length}/${totalItems} total)`);

      // Check if we've fetched all pages
      if (allRecords.length >= totalItems || records.length === 0) break;
      page++;

      // Small delay between pages
      await new Promise(r => setTimeout(r, 300));
    }

    // Step 2: Upsert all into DB (fast, batch transaction)
    const upsertAll = db.transaction((items) => {
      for (const item of items) {
        upsertFromList.run(item);
      }
    });
    upsertAll(allRecords);
    console.log(`Upserted ${allRecords.length} purchase records into DB`);

    // Step 3: Fetch product details for items missing purchase_price
    const needDetails = db.prepare(
      'SELECT product_id, title FROM purchases WHERE purchase_price IS NULL'
    ).all();

    let detailsFetched = 0;
    let detailErrors = [];

    if (needDetails.length > 0) {
      console.log(`Fetching price details for ${needDetails.length} items...`);

      for (const item of needDetails) {
        try {
          await new Promise(r => setTimeout(r, 200));
          const slug = (item.title || 'product').replace(/[^a-zA-Z0-9]+/g, '-').substring(0, 80);
          const detail = await fetchProductDetail(cookies, item.product_id, slug);
          const parsed = extractPurchaseData(detail);

          if (parsed) {
            updateFromDetail.run({
              product_id: item.product_id,
              purchase_price: parsed.purchase_price,
              retail_price: parsed.retail_price,
              category: parsed.category,
              condition: parsed.condition,
              image_url: parsed.image_url,
            });
            detailsFetched++;
          }
        } catch (err) {
          detailErrors.push({ product_id: item.product_id, error: err.message });
          console.error(`Detail error for ${item.product_id}:`, err.message);
        }

        // Log progress every 10 items
        if ((detailsFetched + detailErrors.length) % 10 === 0) {
          console.log(`Details progress: ${detailsFetched + detailErrors.length}/${needDetails.length}`);
        }
      }
    }

    // Step 4: Fetch receipt details for items missing fee data
    const needReceipts = db.prepare(
      'SELECT product_id, buy_now_id FROM purchases WHERE buy_now_id IS NOT NULL AND total_cost = 0'
    ).all();

    let receiptsFetched = 0;
    let receiptErrors = [];

    if (needReceipts.length > 0) {
      console.log(`Fetching receipt/fee details for ${needReceipts.length} items...`);

      for (const item of needReceipts) {
        try {
          await new Promise(r => setTimeout(r, 200));
          const receiptData = await fetchReceiptDetail(cookies, item.buy_now_id);
          const fees = extractReceiptFees(receiptData);

          if (fees) {
            updateFromReceipt.run({
              product_id: item.product_id,
              purchase_price: fees.purchase_price,
              buyer_premium_pct: fees.buyer_premium_pct,
              tax_pct: fees.tax_pct,
              buyer_premium: fees.buyer_premium,
              tax_amount: fees.tax_amount,
              total_cost: fees.total_cost,
            });
            receiptsFetched++;
          }
        } catch (err) {
          receiptErrors.push({ buy_now_id: item.buy_now_id, error: err.message });
          console.error(`Receipt error for ${item.buy_now_id}:`, err.message);
        }

        if ((receiptsFetched + receiptErrors.length) % 10 === 0) {
          console.log(`Receipts progress: ${receiptsFetched + receiptErrors.length}/${needReceipts.length}`);
        }
      }
    }

    res.json({
      success: true,
      total_found: totalItems,
      synced: allRecords.length,
      details_fetched: detailsFetched,
      details_errors: detailErrors.length,
      receipts_fetched: receiptsFetched,
      receipts_errors: receiptErrors.length,
      errors: [...detailErrors, ...receiptErrors].length > 0 ? [...detailErrors, ...receiptErrors] : undefined,
    });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
