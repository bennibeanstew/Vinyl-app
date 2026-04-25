# Vinyl Collection

A beautiful, production-ready website that displays your Discogs vinyl collection.

## Setup

### 1. Deploy to Vercel
- Import this folder to a new Vercel project
- No build step needed — it's pure HTML/CSS/JS

### 2. Use It
Visit your deployed site with your Discogs username:
```
https://your-site.vercel.app/?username=YOUR_DISCOGS_USERNAME
```

Or just visit the site and enter your username in the prompt.

## Features
- **A–Z** — Alphabetical by artist, with letter filters
- **Year** — Grouped by decade (1960s, 1970s, etc.)
- **Price** — Grouped by Discogs median price tiers
- **New** — Most recently added to your collection
- **Search** — Filter by artist, title, or genre
- **Stats** — Top artists, genres, and years at a glance
- **Random** — Open a random album from your collection
- **Modal** — Click any cover for full album details
- **Keyboard nav** — Arrow keys to browse in modal, Esc to close

## Notes
- Uses the public Discogs API — no authentication needed for public collections
- Your Discogs collection must be set to **public** in your Discogs privacy settings
- Large collections (500+ albums) may take a few seconds to fully load due to Discogs API pagination

## Discogs Privacy
Make your collection public: Discogs → Settings → Privacy → Collection visibility: Public
