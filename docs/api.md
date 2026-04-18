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
