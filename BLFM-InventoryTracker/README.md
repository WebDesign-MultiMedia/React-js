# BLFM Inventory Tracker

A mobile inventory management app built for BLFM (food/wholesale business) to track stock levels, log purchases, and capture receipts — all backed by a Google Sheet.

## Purpose

The app gives staff a fast way to:

- **Add new inventory items** by barcode or manual entry, recording quantity, category, unit type, and cost price
- **Scan barcodes** to instantly look up existing items and increment their stock count
- **Log purchase receipts** by photographing them, uploading the image to cloud storage, and attaching the link to an inventory entry

All data is stored in a Google Sheet via SheetDB, making it viewable and editable without any custom backend infrastructure.

## Screens

| Screen | File | Description |
|--------|------|-------------|
| Add Item | `app/index.tsx` | Form to add a new item — supports single-unit or full-case quantities |
| Scanner | `app/scanner.tsx` | Live barcode scanner; looks up existing items or routes to Add Item for new ones |
| Receipt | `app/receipt.tsx` | Capture or pick a receipt photo, upload it to ImgBB, and log it with vendor/amount/notes |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript |
| UI Framework | React Native |
| Mobile Toolchain | Expo (SDK 54) |
| Navigation | Expo Router (file-based) |
| Barcode Scanning | expo-camera |
| Image Capture | expo-image-picker |
| Haptic Feedback | expo-haptics |
| Icons | @expo/vector-icons (Ionicons) |
| Data Backend | SheetDB (Google Sheets REST API) |
| Image Hosting | ImgBB API |

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone, or a simulator

### Installation

```bash
npm install
npx expo start
```

Then scan the QR code with Expo Go (iOS/Android) or press `i` for iOS simulator / `a` for Android emulator.

### Configuration

Open `constants/api.ts` and set your credentials:

```ts
// Your SheetDB endpoint (wraps a Google Sheet as a REST API)
export const SHEETDB_URL = 'https://sheetdb.io/api/v1/YOUR_SHEETDB_ID_HERE';

// Your ImgBB API key for receipt photo uploads
export const IMGBB_API_KEY = 'YOUR_IMGBB_API_KEY_HERE';
```

**SheetDB setup** — the Google Sheet must have these column headers in row 1:

```
id | barcode | name | category | current_stock | unit_type | items_per_case | cost_price | receipt_url
```

**ImgBB** — sign up free at [imgbb.com](https://imgbb.com), then copy your API key from [api.imgbb.com](https://api.imgbb.com).

## Platforms

Runs on iOS, Android, and web (via Metro bundler).
