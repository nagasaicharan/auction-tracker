# API Documentation

Base path: `/api`

## Health

### GET /health

Returns API health status.

Response 200:

```json
{
  "status": "ok",
  "timestamp": "2026-04-18T00:00:00.000Z"
}
```

## Auth

### GET /auth/status

Checks whether the server currently has a Nellis session cookie.

Response 200:

```json
{
  "loggedIn": true
}
```

### POST /auth/login

Logs in to Nellis Auction using credentials and stores the returned session cookie server-side.

Request body:

```json
{
  "email": "you@example.com",
  "password": "your-password"
}
```

Responses:

- 200: `{ "success": true }`
- 400: missing email/password
- 401: invalid credentials or no session cookie returned
- 500: upstream or parsing error

### POST /auth/logout

Clears stored session cookies.

Response 200:

```json
{
  "success": true
}
```

## Purchases

### GET /purchases

Returns paginated purchases list.

Query parameters:

- `page` (number, default `1`)
- `limit` (number, default `20`, max `100`)
- `status` (`all` or one of purchase statuses)
- `search` (text, matched against title)

Response 200:

```json
{
  "purchases": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### GET /purchases/summary

Returns aggregate metrics for dashboard summary.

Response includes:

- `total_items`
- `total_spent`
- Status counts (`received_count`, `inspected_count`, etc.)
- `total_fb_revenue`
- `total_profit`
- `returned_cost`
- `effective_spent_after_returns`
- `non_returned_items`
- `retained_count` (items not returned and currently marked `keep`/`sell_fb`/`sold_fb`)
- `retained_cost` (cost basis for retained items)
- `return_rate_pct`
- `avg_retained_cost`

### PATCH /purchases/:id

Updates one purchase record.

Allowed fields:

- `status`
- `fb_sold_price`
- `fb_sold_date`
- `notes`

Request body example:

```json
{
  "status": "sold_fb",
  "fb_sold_price": 72.5,
  "notes": "Sold via Marketplace"
}
```

Responses:

- 200: updated row JSON
- 400: no valid fields supplied
- 404: purchase not found

### PATCH /purchases/bulk/status

Bulk update status for a list of purchase ids.

Request body:

```json
{
  "ids": [1, 2, 3],
  "status": "inspected"
}
```

Valid statuses:

- `pending`
- `received`
- `inspected`
- `returned`
- `keep`
- `sell_fb`
- `sold_fb`

Response 200:

```json
{
  "updated": 3
}
```

## Sync

### POST /sync

Synchronizes purchases from Nellis and enriches local data with product and receipt details.

Requirements:

- Active Nellis session (login first)

Response 200:

```json
{
  "success": true,
  "total_found": 120,
  "synced": 120,
  "details_fetched": 35,
  "details_errors": 0,
  "receipts_fetched": 20,
  "receipts_errors": 1
}
```

Possible errors:

- 401: not logged in
- 500: sync/remote API error

## Search

### GET /search

Searches live Nellis auction listings using your stored Nellis session and returns current bid-ready items.

Query parameters (optional):

- `Location Name` (string) — preferred location filter (example: `Delran`)
- `search` (string) — keyword filter
- `MarketStatus` (`open` recommended)
- Any additional filter keys supported by Nellis can be passed through as query params.

Response:

```json
{
  "items": [
    {
      "id": 110000000,
      "title": "Example item",
      "inventoryNumber": "ABC123",
      "image": "https://...",
      "retailPrice": 120,
      "currentPrice": 45,
      "valueMargin": 75,
      "valueMarginPercent": 62.5,
      "nextBid": 46,
      "bidCount": 4,
      "bidderCount": 2,
      "closeTime": "2026-06-04T00:00:00.000Z",
      "marketStatus": "open",
      "rating": 4.8,
      "canBid": true
    }
  ],
  "searchResultsCount": 500,
  "selectedFilters": [],
  "filterCount": 0,
  "currentShoppingLocation": {}
}
```

## Saved Searches

### GET /saved-searches

Lists Nellis website saved searches plus locally saved Auction Tracker live-search presets. Website searches are read-only and use the saved search text as an open-auction keyword preset.

Response 200:

```json
{
  "searches": [
    {
      "id": 1,
      "name": "Delran · tools · open",
      "filters": {
        "search": "tools",
        "Location Name": "Delran",
        "MarketStatus": "open"
      },
      "sortBy": "valueMarginPercent",
      "secondarySortBy": "",
      "onlyNoDamage": false,
      "onlyMinorDamage": false,
      "autoRefresh": true,
      "pollSeconds": 30,
      "lastRunAt": null,
      "lastResultCount": null,
      "source": "local",
      "readOnly": false
    },
    {
      "id": "nellis-1956392",
      "name": "Chime",
      "filters": {
        "search": "Chime",
        "MarketStatus": "open"
      },
      "sortBy": "valueMarginPercent",
      "source": "nellis",
      "readOnly": true,
      "nellisId": 1956392
    }
  ],
  "websiteTotal": 34
}
```

### POST /saved-searches

Creates a saved search preset.

Request body:

```json
{
  "name": "Delran · tools · open",
  "filters": {
    "search": "tools",
    "Location Name": "Delran",
    "MarketStatus": "open"
  },
  "sortBy": "valueMarginPercent",
  "secondarySortBy": "",
  "onlyNoDamage": false,
  "onlyMinorDamage": false,
  "autoRefresh": true,
  "pollSeconds": 30
}
```

Responses:

- 201: `{ "search": { ... } }`
- 400: invalid payload

### PATCH /saved-searches/:id

Updates an existing saved search. Uses the same body shape as `POST /saved-searches`.

Responses:

- 200: `{ "search": { ... } }`
- 404: saved search not found

### POST /saved-searches/:id/run

Updates local run metadata for a saved search.

Request body:

```json
{
  "resultCount": 12
}
```

### DELETE /saved-searches/:id

Deletes a saved search.

Responses:

- 204: deleted
- 404: saved search not found

## Lost Auctions

### GET /lost-auctions/live-matches

Returns cached lost-auction relist matches from local SQLite. This endpoint does not call Nellis; start or refresh the background cache with `POST /lost-auctions/scan`.

Query parameters:

- `limit` (number, default `100`, max `500`) — number of cached lost rows to return
- `locationName` (string, optional) — limits current open matches to a Nellis location
- `onlyMatches` (`1`/`true`, optional) — only return lost rows with at least one current match

Response 200:

```json
{
  "rows": [
    {
      "lostItem": {
        "id": 110000000,
        "title": "Example item",
        "image": "https://...",
        "lastSoldPrice": 45,
        "closeTime": "2026-06-04T00:00:00.000Z",
        "locationName": "Delran"
      },
      "search": "Example item",
      "matches": [
        {
          "id": 120000000,
          "title": "Example item",
          "currentPrice": 20,
          "nextBid": 21,
          "closeTime": "2026-06-24T20:00:00.000Z",
          "marketStatus": "open",
          "canBid": true
        }
      ]
    }
  ],
  "count": 1,
  "scan": {
    "status": "completed",
    "processedCount": 414,
    "totalLost": 414,
    "matchedCount": 12,
    "searchDelayMs": 3000
  },
  "cacheOnly": true,
  "returnedAt": "2026-06-24T12:00:00.000Z"
}
```

### GET /lost-auctions/scan

Returns the current background scan status.

### POST /lost-auctions/scan

Starts a throttled background scan. The scan fetches lost-auction pages, searches current open auctions one lost item at a time, stores matches locally, and spaces Nellis search calls by `3000ms`.

Request body:

```json
{
  "locationName": "Delran"
}
```

Responses:

- 202: scan accepted
- 409: scan already running

## Bids

### GET /bids/items/:productId

Fetches one live auction item by Nellis product ID for scheduled bidding.

Response 200:

```json
{
  "item": {
    "id": 114175533,
    "title": "Example item",
    "currentPrice": 45,
    "nextBid": 46,
    "closeTime": "2026-06-04T00:00:00.000Z",
    "canBid": true
  }
}
```

### GET /bids/scheduled

Lists scheduled bids. Requires an active Nellis session.

Query parameters:

- `status` (`all`, `pending`, `placed`, `failed`, `missed`, or `cancelled`; default `all`)

Response 200:

```json
{
  "bids": [
    {
      "id": 1,
      "productId": 110000000,
      "title": "Example item",
      "imageUrl": "https://...",
      "closeTime": "2026-06-04T00:00:00.000Z",
      "scheduledFor": "2026-06-03T23:59:31.000Z",
      "bidAmount": 46,
      "status": "pending",
      "attempts": 0,
      "lastError": null
    }
  ]
}
```

### POST /bids/scheduled

Creates or updates the pending scheduled bid for a product. The bid worker submits exactly `bidAmount` when the item is about 29 seconds from closing, but only if the current next bid is not above `bidAmount`.

Request body:

```json
{
  "productId": 110000000,
  "title": "Example item",
  "imageUrl": "https://...",
  "closeTime": "2026-06-04T00:00:00.000Z",
  "bidAmount": 46
}
```

Responses:

- 201: `{ "bid": { ... } }`
- 400: invalid product, close time, or bid amount
- 401: not logged in

### GET /bids/scheduled/:id

Returns one scheduled bid.

### POST /bids/scheduled/:id/cancel

Cancels a pending scheduled bid.

Responses:

- 200: `{ "bid": { ... } }`
- 404: pending scheduled bid not found

## Returns

### POST /returns/:buyNowId

Submits a return request to Nellis for a specific order and marks it as returned locally.

Path parameter:

- `buyNowId` (number)

Request body:

```json
{
  "returnTypeId": 123,
  "returnReason": "Item not as described"
}
```

Responses:

- 200: `{ "success": true }`
- 400: missing required fields
- 401: not logged in
- 500: upstream return submission failure
