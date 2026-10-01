import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

import { NewsScreen } from '@/screens/news/news-screen';
import {
  useNewsViewModel,
  type NewsCardGroup,
  type NewsCardItem,
  type NewsViewModel,
} from '@/screens/news/use-news-view-model';

jest.mock('@/screens/news/use-news-view-model', () => ({ useNewsViewModel: jest.fn() }));

// The Italian dictionary, without the provider: the tests read the texts the screen shows.
jest.mock('@/i18n/i18n-provider', () => {
  const { it: dictionary } = jest.requireActual<typeof import('@/i18n/it')>('@/i18n/it');
  const translate = (key: keyof typeof dictionary, params?: Record<string, string | number>) =>
    dictionary[key].replace(/\{(\w+)\}/g, (placeholder: string, name: string) =>
      params?.[name] === undefined ? placeholder : String(params[name])
    );
  return {
    useI18n: () => ({ language: 'it', locale: 'it-IT', t: translate, setLanguage: jest.fn() }),
  };
});

// The header options reach the navigator through Stack.Screen: the mock keeps the last ones.
type ScreenOptions = { title: string; headerRight: () => React.ReactElement };
const headerOptions: { current: ScreenOptions | null } = { current: null };
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: {
    Screen: ({ options }: { options: ScreenOptions }) => {
      headerOptions.current = options;
      return null;
    },
  },
}));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default
);

const useViewModel = useNewsViewModel as jest.MockedFunction<typeof useNewsViewModel>;

type HostNode = { type: string; props: Record<string, unknown>; children: (HostNode | string)[] | null };

// The host nodes of the rendered tree that satisfy the predicate, in depth-first order.
function findHostNodes(predicate: (node: HostNode) => boolean): HostNode[] {
  const json = screen.toJSON();
  const roots = (Array.isArray(json) ? json : [json]).filter((node) => node !== null) as HostNode[];
  const found: HostNode[] = [];
  const visit = (node: HostNode | string) => {
    if (typeof node === 'string') {
      return;
    }
    if (predicate(node)) {
      found.push(node);
    }
    node.children?.forEach(visit);
  };
  roots.forEach(visit);
  return found;
}

const activityIndicators = () => findHostNodes((node) => node.type === 'ActivityIndicator');
const alerts = () => findHostNodes((node) => node.props.accessibilityRole === 'alert');

function makeItem(slug: string, onPress: () => void = jest.fn()): NewsCardItem {
  return {
    id: `https://example.com/${slug}`,
    title: `Title ${slug}`,
    sourceName: 'ANSA.it',
    dateLabel: '24 set 2026, 14:30',
    accessibilityLabel: `Apri notizia: Title ${slug}, ANSA.it`,
    onPress,
  };
}

const GROUPS: NewsCardGroup[] = [
  { key: 'frontPages', title: 'Prime pagine', items: [makeItem('first'), makeItem('second')] },
  { key: 'latestAnsa', title: 'Ultime da ANSA', items: [makeItem('third')] },
];

function viewModel(overrides: Partial<NewsViewModel> = {}): NewsViewModel {
  return {
    status: 'success',
    selectedSection: 'italy',
    sectionOptions: [
      { key: 'italy', label: 'Italia' },
      { key: 'usa', label: 'USA' },
    ],
    groups: GROUPS,
    errorMessage: null,
    updatedAtLabel: 'Ultimo controllo alle 14:30',
    notice: null,
    hasMore: true,
    loadMoreFailed: false,
    selectSection: jest.fn(),
    refresh: jest.fn(),
    loadMore: jest.fn(),
    dismissNotice: jest.fn(),
    ...overrides,
  };
}

async function renderScreen(overrides: Partial<NewsViewModel> = {}) {
  const model = viewModel(overrides);
  useViewModel.mockReturnValue(model);
  await render(<NewsScreen />);
  return model;
}

const onWeb = () => jest.replaceProperty(Platform, 'OS', 'web');

describe('NewsScreen', () => {
  let alert: jest.SpyInstance;

  beforeEach(() => {
    headerOptions.current = null;
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sets the app name as header title and a settings gear that opens the settings', async () => {
    await renderScreen();

    expect(headerOptions.current?.title).toBe('News App');
    await render(headerOptions.current!.headerRight());
    await fireEvent.press(screen.getByRole('button', { name: 'Impostazioni' }));
    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  it('shows the loading state while the first page loads, with the category bar and without the update label', async () => {
    await renderScreen({ status: 'loading', groups: [], updatedAtLabel: undefined });

    expect(screen.getByText('Caricamento notizie...')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Italia' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'USA' })).toBeOnTheScreen();
    expect(screen.queryByText('Prime pagine')).toBeNull();
    expect(screen.queryByText(/^Ultimo controllo/)).toBeNull();
  });

  it('shows the error state with the message and a retry button when the load failed without articles', async () => {
    const model = await renderScreen({
      status: 'error',
      groups: [],
      errorMessage: 'Connessione assente. Controlla la rete e riprova.',
      updatedAtLabel: undefined,
      hasMore: false,
    });

    expect(screen.getByText('Connessione assente. Controlla la rete e riprova.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Riprova' }));
    expect(model.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Caricamento notizie...')).toBeNull();
  });

  it('falls back to the unknown error message when the error state has no message', async () => {
    await renderScreen({ status: 'error', groups: [], errorMessage: null, updatedAtLabel: undefined });

    expect(screen.getByText('Si è verificato un errore imprevisto.')).toBeOnTheScreen();
  });

  it('renders the groups of cards under their headings, the update label and the selected chip', async () => {
    await renderScreen();

    expect(screen.getByRole('header', { name: 'Prime pagine' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Ultime da ANSA' })).toBeOnTheScreen();
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByText('Title third')).toBeOnTheScreen();
    expect(screen.getByText('Ultimo controllo alle 14:30')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Italia' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'USA' })).not.toBeSelected();
  });

  it('opens an article through the card it belongs to', async () => {
    const onPress = jest.fn();
    await renderScreen({
      groups: [{ key: 'topHeadlines', title: 'Notizie principali', items: [makeItem('only', onPress)] }],
    });

    await fireEvent.press(screen.getByRole('link', { name: 'Apri notizia: Title only, ANSA.it' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('selects another section from the category bar', async () => {
    const model = await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'USA' }));

    expect(model.selectSection).toHaveBeenCalledWith('usa');
  });

  it('keeps the list on screen when a load failed with articles', async () => {
    await renderScreen({ status: 'error', errorMessage: 'Il server non risponde. Riprova.' });

    expect(screen.getByRole('header', { name: 'Prime pagine' })).toBeOnTheScreen();
    expect(screen.queryByText('Il server non risponde. Riprova.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Riprova' })).toBeNull();
  });

  it('shows the empty state with a retry button when the list has no articles', async () => {
    const model = await renderScreen({ groups: [], hasMore: false });

    expect(screen.getByText('Nessuna notizia disponibile')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Riprova' }));
    expect(model.refresh).toHaveBeenCalledTimes(1);
  });

  it('ends the list with a retry button when a page of more news failed, which loads that page again', async () => {
    const model = await renderScreen({
      status: 'error',
      errorMessage: 'Connessione assente. Controlla la rete e riprova.',
      loadMoreFailed: true,
    });

    const controls = screen.getAllByRole(/^(link|button)$/).map((element) => element.props.accessibilityLabel);
    expect(controls.slice(-2)).toEqual(['Apri notizia: Title third, ANSA.it', 'Riprova']);
    expect(activityIndicators()).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Riprova' }));

    expect(model.loadMore).toHaveBeenCalledTimes(1);
    expect(model.refresh).not.toHaveBeenCalled();
  });

  it('shows the indicator of more news while a page loads, without a retry button', async () => {
    await renderScreen({ status: 'loadingMore' });

    expect(activityIndicators()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Riprova' })).toBeNull();
  });

  it('shows no indicator when no page is loading', async () => {
    await renderScreen();

    expect(activityIndicators()).toHaveLength(0);
  });

  it('shows the notice as a system alert once and consumes it on Android and iOS', async () => {
    const model = await renderScreen({ notice: 'Connessione assente. Controlla la rete e riprova.' });

    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('Connessione assente. Controlla la rete e riprova.', undefined, [{ text: 'Chiudi' }]);
    expect(model.dismissNotice).toHaveBeenCalledTimes(1);
    expect(alerts()).toHaveLength(0);
    expect(screen.queryByText('Connessione assente. Controlla la rete e riprova.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aggiorna' })).toBeNull();
  });

  it('shows no alert without a notice', async () => {
    await renderScreen();

    expect(alert).not.toHaveBeenCalled();
  });

  describe('on web', () => {
    beforeEach(onWeb);

    it('shows the refresh button next to the update label and refreshes on press', async () => {
      const model = await renderScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'Aggiorna' }));

      expect(model.refresh).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Ultimo controllo alle 14:30')).toBeOnTheScreen();
    });

    it('shows the refresh button busy during a refresh', async () => {
      await renderScreen({ status: 'refreshing' });

      expect(screen.getByRole('button', { name: 'Aggiorna' })).toBeBusy();
    });

    it('shows the refresh button on the empty list as well, even without the update label', async () => {
      await renderScreen({ groups: [], updatedAtLabel: undefined, hasMore: false });

      expect(screen.getByRole('button', { name: 'Aggiorna' })).not.toBeBusy();
      expect(screen.getByText('Nessuna notizia disponibile')).toBeOnTheScreen();
    });

    it('hides the refresh button while loading', async () => {
      await renderScreen({ status: 'loading', groups: [], updatedAtLabel: undefined });

      expect(screen.queryByRole('button', { name: 'Aggiorna' })).toBeNull();
    });

    it('hides the refresh button in the error state without articles', async () => {
      await renderScreen({ status: 'error', groups: [], errorMessage: 'Errore', updatedAtLabel: undefined });

      expect(screen.queryByRole('button', { name: 'Aggiorna' })).toBeNull();
      expect(screen.getByText('Errore')).toBeOnTheScreen();
    });

    it('shows the notice in a banner with a close button instead of an alert', async () => {
      const model = await renderScreen({ notice: "Impossibile aprire l'articolo." });

      expect(alerts()).toHaveLength(1);
      expect(screen.getByText("Impossibile aprire l'articolo.")).toBeOnTheScreen();
      expect(alert).not.toHaveBeenCalled();
      expect(model.dismissNotice).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole('button', { name: 'Chiudi' }));
      expect(model.dismissNotice).toHaveBeenCalledTimes(1);
    });

    it('renders no banner without a notice', async () => {
      await renderScreen();

      expect(alerts()).toHaveLength(0);
      expect(screen.queryByRole('button', { name: 'Chiudi' })).toBeNull();
    });
  });
});
