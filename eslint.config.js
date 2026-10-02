// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Project modules are matched both as `@/` aliases and as relative paths;
// relative paths are matched by folder name, at any depth.
const PROJECT = String.raw`^(?:@/|(?:\.\./)+)`;
const folder = (name) => String.raw`${PROJECT}${name}(?:/|$)`;
// The start of a module inside `parent`, also as a sibling folder imports it: `../<name>`.
const inside = (parent) => String.raw`^(?:@/${parent}/|(?:\.\./)+(?:${parent}/)?)`;
const nested = (parent, name) => String.raw`${inside(parent)}${name}(?:/|$)`;

const APP = folder('app');
const DATA = folder('data');
const DATA_REPOSITORIES = nested('data', 'repositories');
const DOMAIN = folder('domain');
const DOMAIN_EXCEPT_MODELS = String.raw`${PROJECT}domain(?!/models/)(?:/|$)`;
const DI = folder('di');
const PRESENTATION = folder('presentation');
const SCREENS = nested('presentation', 'screens');
// From a file in presentation/screens/<name>/: `./` is its own folder, `../<other>/` another screen.
const SCREENS_RELATIVE = String.raw`^\.\.?/(?!\.\./)`;
// From a file in presentation/screens/<name>/: `../<other>/` is another screen, `../../` the presentation folder.
const OTHER_SCREEN_RELATIVE = String.raw`^\.\./(?!\.\./)`;
const NEWS_SCREEN = nested('presentation', 'screens/news');
const SETTINGS_SCREEN = nested('presentation', 'screens/settings');
const COMPONENTS = nested('presentation', 'components');
const I18N = nested('presentation', 'i18n');
// presentation/theme/ holds theme.ts, with the colors and the layout measures, and the theme provider.
const THEME_FOLDER = nested('presentation', 'theme');
const THEME = String.raw`${inside('presentation')}theme/theme(?:\.\w+)*$`;
const THEME_PREFERENCE = String.raw`${inside('presentation')}theme(?:/(?!theme(?:\.\w+)*$)|$)`;
// The same two, as a file of presentation/theme/ imports them.
const THEME_SIBLING = String.raw`^\./theme(?:\.\w+)*$`;
const THEME_PREFERENCE_SIBLING = String.raw`^\./(?!theme(?:\.\w+)*$)`;
const BOOTSTRAP = nested('presentation', 'bootstrap');
const HOOKS = nested('presentation', 'hooks');
const HOOKS_EXCEPT_COLOR_SCHEME = String.raw`${inside('presentation')}hooks(?!/use-color-scheme(?:\.ts)?$)(?:/|$)`;
const PRESENTATION_UTILS = nested('presentation', 'utils');
const PROJECT_EXCEPT_CONFIG = String.raw`^(?!(?:@/data/|\./)config(?:\.\w+)*$)(?:@/|\.\.?/)`;
const PROJECT_EXCEPT_DATA_UTILS = String.raw`^(?!@/data/utils/|\./|(?:\.\./)+(?:data/)?utils/)(?:@/|\.\.?/)`;
const REACT_LIBRARY = String.raw`^react(?:/|$)`;
const REACT = String.raw`^react(?:-native)?(?:/|$)`;
const PLATFORM_LIBRARIES = [String.raw`^react-native(?:[-/]|$)`, String.raw`^@react-native`, String.raw`^expo(?:[-/]|$)`];
// Anything that is neither a file of the domain nor a relative path.
const OUTSIDE_DOMAIN = String.raw`^(?!@/domain/|\.\.?/)`;
const ANYTHING = '.';

const forbid = (message, paths) => ({ regex: paths.join('|'), message });

const NO_REACT = forbid('The data layer and the container must not depend on React.', [REACT]);

const SERVICE_FORBIDDEN = forbid(
  'Services may import only DTOs, other services, data/config and data/utils.',
  [APP, DATA_REPOSITORIES, DOMAIN, DI, PRESENTATION]
);

const SCREEN_MESSAGE =
  'Screens may import only their own view model and folder constants, models, components, i18n, the theme provider and presentation/utils, never the folder of another screen.';
const SCREEN_FORBIDDEN = [
  APP,
  DATA,
  DOMAIN_EXCEPT_MODELS,
  DI,
  BOOTSTRAP,
  HOOKS,
  THEME,
  OTHER_SCREEN_RELATIVE,
];

const SUPPORT_MESSAGE =
  'presentation/theme/theme, presentation/hooks and presentation/utils must not import routes, layers, the container, screens, components, i18n, the theme provider or bootstrap.';
const SUPPORT_FORBIDDEN = [
  APP,
  DATA,
  DOMAIN,
  DI,
  SCREENS,
  COMPONENTS,
  I18N,
  THEME_PREFERENCE,
  BOOTSTRAP,
];

// When several blocks match a file, the last one sets the rule.
const restrictImports = (files, ...patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns }] },
});

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  restrictImports(
    ['app/**'],
    forbid('Routes show a screen: they must not import the data layer, the domain or the container.', [
      DATA,
      DOMAIN,
      DI,
    ])
  ),
  restrictImports(
    ['domain/**'],
    forbid('The domain imports only its own files: no library, no layer, no support module.', [
      OUTSIDE_DOMAIN,
      APP,
      DATA,
      DI,
      PRESENTATION,
    ])
  ),
  // Any file of the data layer; the blocks below set the rule of its folders.
  restrictImports(
    ['data/**'],
    forbid('The data layer must not import routes, the container or the presentation.', [
      APP,
      DI,
      PRESENTATION,
    ]),
    NO_REACT
  ),
  restrictImports(['data/services/**'], SERVICE_FORBIDDEN, NO_REACT),
  // The browser service opens URLs with the platform APIs of react-native.
  restrictImports(
    ['data/services/browser-service.ts', 'data/services/browser-service.test.ts'],
    SERVICE_FORBIDDEN,
    forbid('Services must not depend on React.', [REACT_LIBRARY])
  ),
  restrictImports(
    ['data/repositories/**'],
    forbid(
      'Repositories may import only services, DTOs, the domain, the other files of data/repositories, data/config and data/utils.',
      [APP, DI, PRESENTATION]
    ),
    NO_REACT
  ),
  restrictImports(
    ['data/config.ts', 'data/config.test.ts'],
    forbid('data/config must not import other modules of the project.', [PROJECT_EXCEPT_CONFIG])
  ),
  restrictImports(
    ['data/utils/**'],
    forbid('data/utils may import only its own files, no other module of the project.', [
      PROJECT_EXCEPT_DATA_UTILS,
    ])
  ),
  restrictImports(
    ['data/services/**/*-dto.ts', 'domain/models/**/*-model.ts'],
    forbid('DTO and model files only declare types, constants and error classes: they import nothing.', [
      ANYTHING,
    ])
  ),
  restrictImports(
    ['di/**'],
    forbid('The container may import only the data layer and the domain.', [APP, PRESENTATION]),
    NO_REACT
  ),
  // Any file of the presentation; the blocks below set the rule of its folders.
  restrictImports(
    ['presentation/**'],
    forbid('The presentation must not import routes, the data layer, the container or bootstrap.', [
      APP,
      DATA,
      DI,
      BOOTSTRAP,
    ])
  ),
  restrictImports(['presentation/screens/**'], forbid(SCREEN_MESSAGE, SCREEN_FORBIDDEN)),
  restrictImports(
    ['presentation/screens/news/**'],
    forbid(SCREEN_MESSAGE, [...SCREEN_FORBIDDEN, SETTINGS_SCREEN])
  ),
  restrictImports(
    ['presentation/screens/settings/**'],
    forbid(SCREEN_MESSAGE, [...SCREEN_FORBIDDEN, NEWS_SCREEN])
  ),
  // After the screen blocks, so that a view model keeps its own rule.
  restrictImports(
    ['presentation/screens/**/use-*-view-model.ts'],
    forbid('View models may import only the container, the domain, i18n, presentation/utils and React.', [
      APP,
      DATA,
      SCREENS,
      SCREENS_RELATIVE,
      COMPONENTS,
      THEME_FOLDER,
      BOOTSTRAP,
      HOOKS,
    ]),
    forbid(
      'View models must not use platform libraries: platform effects belong to the services, behind a use case.',
      PLATFORM_LIBRARIES
    )
  ),
  restrictImports(
    ['presentation/components/**'],
    forbid(
      'UI components may import only other components, presentation/theme/theme, the theme hooks and UI libraries: data and texts arrive via props.',
      [
        APP,
        DATA,
        DOMAIN,
        DI,
        SCREENS,
        I18N,
        THEME_PREFERENCE,
        BOOTSTRAP,
        PRESENTATION_UTILS,
      ]
    )
  ),
  restrictImports(
    ['presentation/i18n/**'],
    forbid(
      'i18n may import only its own files, the container, the domain, React and platform libraries.',
      [APP, DATA, SCREENS, COMPONENTS, THEME_FOLDER, BOOTSTRAP, HOOKS, PRESENTATION_UTILS]
    )
  ),
  // presentation/theme/theme.ts and its test take the rule of their own block, further down.
  restrictImports(
    ['presentation/theme/**'],
    forbid(
      'The theme provider may import only the container, the domain, React, platform libraries and the color scheme context of presentation/hooks/use-color-scheme, not presentation/theme/theme.',
      [
        APP,
        DATA,
        SCREENS,
        COMPONENTS,
        I18N,
        BOOTSTRAP,
        HOOKS_EXCEPT_COLOR_SCHEME,
        PRESENTATION_UTILS,
        THEME,
        THEME_SIBLING,
      ]
    )
  ),
  restrictImports(
    ['presentation/bootstrap/**'],
    forbid(
      'bootstrap may import only its own files, the i18n and theme providers, the container, the domain, React and platform libraries.',
      [APP, DATA, SCREENS, COMPONENTS, HOOKS, PRESENTATION_UTILS, THEME]
    )
  ),
  restrictImports(['presentation/hooks/**', 'presentation/utils/**'], forbid(SUPPORT_MESSAGE, SUPPORT_FORBIDDEN)),
  // From theme.ts, the other files of its folder belong to the theme provider.
  restrictImports(
    ['presentation/theme/theme.ts', 'presentation/theme/theme.test.ts'],
    forbid(SUPPORT_MESSAGE, [...SUPPORT_FORBIDDEN, THEME_PREFERENCE_SIBLING])
  ),
]);
