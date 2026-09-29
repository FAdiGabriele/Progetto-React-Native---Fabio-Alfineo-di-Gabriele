# News App

A React Native app, built with [Expo](https://expo.dev), that shows the main news of the moment from [NewsAPI](https://newsapi.org) and opens each article on the newspaper's website.

## Features

- **Two categories**, chosen with a chip bar under the header: **Italia** (the top headlines of la Repubblica and Il Sole 24 Ore, followed by up to 10 of the latest ANSA articles) and **USA** (the top headlines of the United States). "Italia" is selected at start; with the English interface the chips read "Italy" and "USA".
- **One card per article**, with image (or a placeholder), source, title, description, publication date and author. A tap opens the article in the in-app browser, or in a new tab on web.
- **Pull-to-refresh** on Android and iOS. On web, where the gesture does not exist, a **Refresh** button ("Aggiorna") next to the last update time reloads the list.
- **More news at the end of the list**: every time the scrolling reaches the bottom, the app loads one page of 20 articles from NewsAPI's `everything` on all the outlets of the category (ANSA, la Repubblica and Il Sole 24 Ore in "Italia", the US outlets listed in `constants/news-sections.ts` in "USA"), sorted by date and appended without duplicates, up to 100 results per category. The first page never changes.
- **Last update time** under the header: the time when the list was received ("Aggiornato alle 14:30"), or date and time when the list is from another day.
- **Saved list**: the first page of the last list received for each category is kept on the device (the articles added at the end of the list are not saved). When loading fails and there is nothing else to show, for example when the app is opened without a network connection, the saved list appears with a non-blocking message and the time it was saved.
- **Mobile and desktop layout**: one card per row on phones; in windows at least 768 points wide (CSS pixels on web; tablets too) a grid with at least three cards per row, with one more column whenever every card stays at least 320 points wide.
- **Settings screen**, opened with the gear at the top right of the header: a "Theme" row and a "Language" row, each showing the current value and switching to the other one on tap, and at the bottom the app version and the footer. The back button returns to the news list as it was, without new requests.
- **Italian and English interface**, chosen from the "Language" row of the settings, opened with the gear at the top right of the header: the row reads "Italiano" with the Italian interface and "English" with the English one, and a tap switches to the other language. The choice is remembered across restarts and dates follow the language.
- **Light and dark theme**: the app starts in the dark theme, whatever the system setting, and the "Theme" row of the settings switches to the light one; the choice is remembered across restarts. Screen reader labels on cards, chips, buttons, the settings gear ("Impostazioni" / "Settings") and the settings rows, read with their current value ("Tema: Scuro" / "Theme: Dark", "Lingua: Italiano" / "Language: English").
- **App name and icon in the browser tab** on web: the tab always shows "News App" and the newspaper icon of the app, whatever the language, the category and the screen.
- Loading, error and empty states, the last two with a "Retry" button ("Riprova"); a 10-second timeout on every request; requests cancelled when a new load starts.

### Known limits of the Italian sources

- NewsAPI's `top-headlines` returns at most 10 headlines per outlet, so "Italia" starts with at most 20 headlines followed by up to 10 ANSA articles. The pages added at the end of the list, sorted by date across the three outlets, are mostly ANSA articles, and the first of them repeats part of the first page, so it adds fewer than 20 cards.
- Il Sole 24 Ore often returns the image URL as the string `"null"`: those cards show the placeholder.
- ANSA publishes the same piece on different URLs for its regional editions: articles with the same title and the same source appear only once, as the first one received, which can be a regional edition. An edition with a different title remains a separate card.
- Google News Italia is excluded on purpose: its items point to redirect links and do not name the original outlet or the author.

## Prerequisites

- [Node.js](https://nodejs.org) LTS and npm.
- [Expo Go](https://expo.dev/go) for Expo SDK 57 on an Android or iOS device (the version in the app stores), or an Android emulator or iOS simulator. The app uses no custom native modules.
- A free [NewsAPI](https://newsapi.org/register) account and its API key.

## Configuration

1. Get an API key at https://newsapi.org/register.
2. Copy `.env.example` to `.env` in the project root and put the key in `EXPO_PUBLIC_NEWS_API_KEY`:

   ```
   EXPO_PUBLIC_NEWS_API_KEY=your_key
   EXPO_PUBLIC_NEWS_USE_FIXTURES=
   ```

3. Never commit `.env`: git ignores it. Only `.env.example`, with empty values, is versioned.

The key is sent in the `X-Api-Key` header, never in the URL. Note that `EXPO_PUBLIC_*` variables are embedded in the app bundle, so the key can be extracted from a client: acceptable for a development project on the free plan, not for a production app.

Restart the development server after every change to `.env`.

If the app shows "Missing or invalid API key. Check the .env file." ("Chiave API mancante o non valida. Controlla il file .env."), check `EXPO_PUBLIC_NEWS_API_KEY` in `.env` and restart the server. "Request limit reached. Try again later." means the daily quota of the key is used up: switch to fixture mode (see below). The app never retries these errors automatically.

## Run

```bash
npm install
npx expo start
```

Then scan the QR code with Expo Go on your device, or press `a` for an Android emulator, `i` for the iOS simulator (macOS only) or `w` for web. Open the web version only at the `localhost` address printed by Expo, in the browser of the same machine (see the limits below). After every change to `.env`, stop and start the server again.

### Fixture mode: develop without using the API quota

Set `EXPO_PUBLIC_NEWS_USE_FIXTURES=true` in `.env`, or in the shell before `npx expo start` (bash: `EXPO_PUBLIC_NEWS_USE_FIXTURES=true npx expo start`; PowerShell: `$env:EXPO_PUBLIC_NEWS_USE_FIXTURES='true'; npx expo start`), and the app serves the real responses saved in `services/fixtures/` instead of calling NewsAPI: no request is sent and no key is needed. Leave the variable empty to use NewsAPI. Restart the server after changing it.

Use it for day-to-day development: on the free plan every reload of the page, every Fast Refresh and every category switch costs requests. The fixtures hold one page per request: in fixture mode the first arrival at the end of the list adds the articles of the more-news fixture of the category (9 new cards in "Italia", 20 in "USA") and the next ones add nothing. A request with no fixture, such as one of a new category, ends with "An unexpected error occurred.". Leave the variable empty when checking the app against the real API.

## Checks

```bash
npm run lint       # ESLint, including the rules on the direction of imports between layers
npx tsc --noEmit   # TypeScript type check
npm test           # Unit tests of the pure functions (Jest with the jest-expo preset)
```

## Limits of the NewsAPI free plan

- **100 requests per day per key**, shared by web, Android and iOS. Every start, refresh, "Retry" and category switch loads the first page of the selected category: two requests for "Italia" (headlines plus ANSA), one for "USA". Every page loaded at the end of the list costs one request, in both categories, and a category asks at most five pages. Opening the settings, switching language or theme and showing the saved list cost no requests. The app never polls and retries a request at most once, only for network errors.
- **24-hour delay** on the articles of every category: the "news of the moment" is about one day old, which is why each card shows the publication date.
- **CORS enabled only for `localhost`**: the web version works only in the browser of the machine that runs `npx expo start`, opened at `localhost`. From another device on the local network, or once published, the requests fail with the "No connection" message.
- **At most 100 results per request**, a limit reported by developers and not documented by NewsAPI (beyond it the API answers HTTP 426): the app asks for no page beyond 100 results per request.
- Development and testing use only, as stated on the NewsAPI pricing page.

## On the web

- The "Refresh" button replaces pull-to-refresh and shows an activity indicator while the list reloads.
- Non-blocking notices (failed refresh, failed load at the end of the list, saved list, article that cannot be opened) appear in a banner under the category bar instead of a system alert.
- The chosen theme, the chosen language and the saved lists are stored in the browser's `localStorage` of the `localhost` origin.

## Project structure

The code follows a layered architecture (service, repository, ViewModel, screen, UI components), and ESLint checks the direction of the imports between the layers.

```
app/            Expo Router routes: root layout, the "/" route (news screen) and the "/settings" route (settings screen), each showing only its screen
services/       Service layer and DTOs: NewsAPI client, fixture mode, saved list, language and theme storage, app version; fixtures/ with real responses
repositories/   Repository layer and Model: news repository (sections, pages, saved list), mapper from DTO to Model, language, theme and app version repositories
screens/        One folder per screen, each with the screen and its ViewModel (a custom hook): news/ and settings/
components/     UI components that receive everything through props: card, list, image, category chips, states, text button, banner, icon button (the settings gear), list row (the settings rows)
i18n/           Italian and English dictionaries and the language provider
theme/          The theme provider: chosen theme, switch and saving
constants/      Configuration, news sections and theme
hooks/          Theme hooks and the context of the active theme
utils/          Pure functions: dates, URLs, layout
```

Constants (base URL, 50 articles per headlines request, 20 articles per page at the end of the list, 100 results per request, 10-second timeout) live in `constants/config.ts`. The categories, with the requests of their first page and the request of their more news, live in `constants/news-sections.ts`: a new category also needs its chip label in `i18n/it.ts` and `i18n/en.ts` and, for fixture mode, a fixture for each of its requests in `services/fixtures/` mapped in `services/news-fixture-service.ts`.
