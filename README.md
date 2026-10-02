# News App

A React Native app, built with [Expo](https://expo.dev), that shows the main news of the moment from [NewsAPI](https://newsapi.org) and opens each article on the newspaper's website.

## Features

- **Two categories**, chosen with a chip bar under the header: **Italia** (the top headlines of la Repubblica and Il Sole 24 Ore, followed by up to 10 of the latest ANSA articles) and **USA** (the top headlines of the United States). "Italia" is selected at start; with the English interface the chips read "Italy" and "USA". When only one of the two requests of "Italia" fails, the list shows the articles of the other one, with a non-blocking notice.
- **Groups with a heading**: the list is divided into one group per request, each under its own heading, so that the two blocks of "Italia", which are not in one chronological order, are told apart: "Notizie principali" (the headlines of the two outlets) and "Ultime da ANSA", then "Altre notizie" for the news loaded at the end of the list; in "USA", "Notizie principali" too and "Altre notizie". In English: "Top headlines" (for both categories), "Latest from ANSA" and "More news". A request without articles has no heading.
- **One card per article**, with image (or a placeholder), source, title, description, publication date and author. The title loses the " - Source" suffix that NewsAPI appends to the US headlines when it repeats the source name or the domain of the article, which the card already shows. A tap opens the article in the in-app browser, or in a new tab on web.
- **Pull-to-refresh** on Android and iOS. On web, where the gesture does not exist, a **Refresh** button ("Aggiorna") next to the last check time reloads the list. If the refresh fails, the list stays as it was, including the news added at the end, and more can still be loaded.
- **More news at the end of the list**: every time the scrolling reaches the bottom, the app loads one page of 20 articles from NewsAPI's `everything` on all the outlets of the category (ANSA, la Repubblica and Il Sole 24 Ore in "Italia", the US outlets listed in `data/repositories/news-section-requests.ts` in "USA"), sorted by date and appended without duplicates, up to 100 results per category. The first page never changes. When a page brings nothing new, the next one is requested right away; when a page fails, a "Retry" button ("Riprova") at the end of the list loads it again.
- **Last check time** under the header: the time when the list was received ("Ultimo controllo alle 14:30" / "Last checked at 2:30 PM"), or date and time when the list is from another day. It says when the app last asked NewsAPI, not how recent the articles are: on the free plan they are about one day old.
- **Saved list**: the first page of the last list received for each category is kept on the device, request by request, so that it comes back with its groups and headings (the articles added at the end of the list are not saved, and a first page with a failed request does not replace the saved one). When loading fails and there is nothing else to show, for example when the app is opened without a network connection, the saved list appears with a non-blocking message and the time it was saved.
- **Mobile and desktop layout**: one card per row on phones; in windows at least 768 points wide (CSS pixels on web; tablets too, and large phones held sideways) a grid of cards that are always at least 320 points wide: two per row from 768 points, three from 1056, and one more column whenever the cards stay that wide. Every heading spans the whole width and every group starts a new row. The app rotates with the device.
- **Settings screen**, opened with the gear at the top right of the header: a "Theme" setting and a "Language" setting, each with its options side by side in a segmented control, the current one highlighted, and at the bottom the app version and the footer. The back button returns to the news list as it was, without new requests.
- **Italian and English interface**, chosen in the settings between "Italiano" and "English", each written in its own language. The choice is remembered across restarts and dates follow the language.
- **Light and dark theme**: the app follows the theme of the device, also while it changes, until "Light" or "Dark" is chosen in the settings; "System" goes back to the device theme. The choice is remembered across restarts.
- **Accessibility**: screen reader labels on cards, chips, buttons and the settings gear ("Impostazioni" / "Settings"); the chips say which one is selected, as tabs of a tab list on web and as buttons on Android and iOS, the settings options are radio buttons named with their setting ("Tema: Scuro" / "Theme: Dark", "Lingua: Italiano" / "Language: Italiano") and the group headings of the list are announced as headings.
- **App name and icon**: on web the browser tab always shows "News App" and the newspaper icon of the app, whatever the language, the category and the screen; on Android and iOS the same newspaper is the app icon and the image of the splash screen.
- **Start-up**: the saved theme and the saved language are read together while the splash screen stays visible, so the first screen already appears with both.
- Loading, error and empty states, the last two with a "Retry" button ("Riprova"); a 10-second timeout on every request and, after a network failure, a single retry one second later; requests cancelled when a new load starts. The error message follows the answer of NewsAPI: its error code when it says more than the HTTP status (too many requests, daily quota used up, results limit reached), and "service unavailable" for every 5xx status. The errors that only a developer can fix (missing or rejected API key, invalid request) show the same neutral "service unavailable" message, and their details go to the log.

### Known limits of the sources

- NewsAPI's `top-headlines` returns at most 10 headlines per outlet, so "Italia" starts with at most 20 headlines followed by up to 10 ANSA articles, the latest ones, which are more recent than the headlines before them: the two headings mark the two blocks. The pages added at the end of the list, sorted by date across the three outlets, are mostly ANSA articles, and the first of them repeats part of the first page, so it adds fewer than 20 cards.
- NewsAPI appends " - Source" to every US headline. The app removes the suffix when it is the source name or the domain of the article (26 titles out of 35 in the saved response); abbreviations and variants such as "WSJ", "AP News", "BBC" or "Yahoo Finance" stay in the title rather than being guessed.
- Il Sole 24 Ore often returns the image URL as the string `"null"`: those cards show the placeholder.
- ANSA publishes the same piece on different URLs for its regional editions: articles with the same title, the same source and the same publication day appear only once, as the first one received, which can be a regional edition. An edition with a different title remains a separate card, and so do two articles of the same outlet that share a recurring title on different days.
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

If the app shows "The news service is unavailable." ("Il servizio notizie non è disponibile.") without "Try again later", the key is missing or rejected, or a request is not valid: the user reads a neutral message and the details are in the log (the terminal of `npx expo start`, or the browser console on web), in a warning that starts with "NewsAPI configuration error". Check `EXPO_PUBLIC_NEWS_API_KEY` in `.env` and restart the server. "Too many requests in a short time. Try again later." and "Daily request limit reached. Try again tomorrow." mean that the key has hit a limit of NewsAPI, the rate limit or the daily quota: switch to fixture mode (see below). The app never retries these errors automatically.

## Run

```bash
npm install
npx expo start
```

Then scan the QR code with Expo Go on your device, or press `a` for an Android emulator, `i` for the iOS simulator (macOS only) or `w` for web. Open the web version only at the `localhost` address printed by Expo, in the browser of the same machine (see the limits below). After every change to `.env`, stop and start the server again.

### Fixture mode: develop without using the API quota

Set `EXPO_PUBLIC_NEWS_USE_FIXTURES=true` in `.env`, or in the shell before `npx expo start` (bash: `EXPO_PUBLIC_NEWS_USE_FIXTURES=true npx expo start`; PowerShell: `$env:EXPO_PUBLIC_NEWS_USE_FIXTURES='true'; npx expo start`), and the app serves the real responses saved in `data/services/fixtures/` instead of calling NewsAPI: no request is sent and no key is needed. Leave the variable empty to use NewsAPI. Restart the server after changing it.

Use it for day-to-day development: on the free plan every reload of the page, every Fast Refresh and every category switch costs requests. The fixtures hold one page per request: in fixture mode the first arrival at the end of the list adds the articles of the more-news fixture of the category (9 new cards in "Italia", 20 in "USA") and the next ones add nothing. A request with no fixture, such as one of a new category, ends with "An unexpected error occurred.". Leave the variable empty when checking the app against the real API.

The fixtures reach the app bundle only in fixture mode: the news service reads the variable itself and loads the fixtures with a `require` behind it, so a production build (`npx expo export`, or a store build) made with the variable empty leaves them out. In development, with `npx expo start`, they are always in the bundle. Metro caches the transformed files without the values of the `EXPO_PUBLIC_*` variables: after changing the variable, or the key, run the export with `--clear`. The tests start with fixture mode off, whatever the shell sets.

## Checks

```bash
npm run lint       # ESLint, including the rules on the direction of imports between layers
npx tsc --noEmit   # TypeScript type check
npm test           # Jest (jest-expo preset, React Native Testing Library): pure functions, the domain use cases with a fake repository, services and repositories with fetch, storage and browser doubles, the news reducer and ViewModel with fake use cases, UI components, the news screen and the app start-up
```

## Limits of the NewsAPI free plan

- **100 requests per day per key**, shared by web, Android and iOS. Every start, refresh, "Retry" and category switch loads the first page of the selected category: two requests for "Italia" (headlines plus ANSA), one for "USA". Every page loaded at the end of the list costs one request, in both categories, and a category asks at most five pages; a page that brings nothing new is followed at once by the next one, within the same five, and every retry of a failed page costs one request. Opening the settings, switching language or theme and showing the saved list cost no requests. The app never polls and retries a request at most once, only for network errors and after a one-second pause.
- **24-hour delay** on the articles of every category: the "news of the moment" is about one day old, which is why each card shows the publication date.
- **CORS enabled only for `localhost`**: the web version works only in the browser of the machine that runs `npx expo start`, opened at `localhost`. From another device on the local network, or once published, the requests fail with the "No connection" message.
- **At most 100 results per request**, a limit reported by developers and not documented by NewsAPI (beyond it the API answers HTTP 426): the app asks for no page beyond 100 results per request.
- Development and testing use only, as stated on the NewsAPI pricing page.

## On the web

- The "Refresh" button replaces pull-to-refresh and shows an activity indicator while the list reloads.
- Non-blocking notices (failed refresh, incomplete first page, failed load at the end of the list, saved list, article that cannot be opened) appear in a banner under the category bar instead of a system alert.
- The chosen theme, the chosen language and the saved lists are stored in the browser's `localStorage` of the `localhost` origin.

## Project structure

The code follows a Clean Architecture with MVVM on the presentation side, with one root folder per layer, and ESLint checks the direction of the imports, which always points to the domain:

- the **domain** (`domain/`) is the centre and imports nothing, not even a library: the models, the interfaces of the repositories and the use cases, which hold the rules of the app (what happens when a load fails with or without a saved list, which page of more news to ask for and when to skip one that adds nothing, one article opening at a time);
- the **data layer** (`data/`) implements those interfaces with services, which talk to NewsAPI, to the storage of the device and to the browser, and repositories, which turn DTOs and transport errors into models and domain errors;
- `di/container.ts` is the composition root, the only module that knows the data layer: it builds the use cases with the repositories and services and hands them to the presentation side;
- in the **presentation** (`presentation/`), the **ViewModel** of a screen (a custom hook) receives the use cases, by default the ones of the container, keeps the state and prepares everything the screen renders (translated headings and labels, formatted dates, the props of the cards and the non-blocking notice), with no platform library; the **screen** only picks the component for the current status and passes the props down to the **UI components**.

Test files (`*.test.ts`, `*.test.tsx`) sit next to the modules they test.

```
app/                Expo Router routes: root layout, the "/" route (news screen) and the "/settings" route (settings screen), each showing only its screen
domain/             The centre: models/ (news, language and theme models, the rule on duplicate articles), repositories/ (the interfaces that the data layer implements) and use-cases/ (load the news of a category, load more news, open an article)
data/               Data layer
  services/         NewsAPI client and DTOs, fixture mode, saved list, language and theme storage, app version, browser; fixtures/ with real responses
  repositories/     The implementations of the domain interfaces, the mapper from DTO to Model, the NewsAPI requests of each category
  config.ts         Configuration of the NewsAPI requests
  utils/            Pure functions of the data layer: ISO dates of the responses, URLs
di/
  container.ts      Composition root: builds the use cases with the repositories and services of data/ and exposes them, with the repositories of the saved preferences and of the app version, to ViewModels, providers and start-up
presentation/       Presentation (MVVM)
  screens/          One folder per screen, each with the screen and its ViewModel (a custom hook): news/ and settings/
  components/       UI components that receive everything through props: card, list, image, category chips, states, text button, banner, icon button (the settings gear), segmented control (the options of a setting)
  i18n/             Italian and English dictionaries and the language provider
  theme/            The theme provider (theme preference: system, light or dark; active theme and saving) and theme.ts, with the colors of the two themes and the layout measures
  hooks/            Theme hooks and the context of the active theme
  bootstrap/        App start-up: reads the saved theme and language together behind the splash screen, then mounts the two providers
  utils/            Pure functions of the presentation: date formatting, layout
```

Constants (base URL, 50 articles per headlines request, 20 articles per page at the end of the list, 100 results per request, 10-second timeout, one-second pause before the retry of a network failure) live in `data/config.ts`. The categories are the keys of `NEWS_SECTION_KEYS` in `domain/models/news-model.ts`, in the order of the chips; the requests of their first page and the request of their more news live in the data layer, in `data/repositories/news-section-requests.ts`, typed with the request DTO of the service. A new category needs its key, its requests, its chip label in `presentation/i18n/it.ts` and `presentation/i18n/en.ts` and, for fixture mode, a fixture for each of its requests in `data/services/fixtures/` mapped in `data/services/news-fixture-service.ts`.
