// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Project modules are matched both as `@/` aliases and as relative paths;
// relative paths are matched by folder name, at any depth.
const PROJECT = String.raw`^(?:@/|(?:\.\./)+)`;
const folder = (name) => String.raw`${PROJECT}${name}(?:/|$)`;
const file = (name) => String.raw`${PROJECT}${name}(?:\.\w+)*$`;
// A folder inside `parent`, also as a sibling folder imports it: `../<name>/`.
const nested = (parent, name) => String.raw`^(?:@/${parent}/|(?:\.\./)+(?:${parent}/)?)${name}(?:/|$)`;

const APP = folder('app');
const DATA = folder('data');
const DATA_REPOSITORIES = nested('data', 'repositories');
const DOMAIN = folder('domain');
const DOMAIN_EXCEPT_MODELS = String.raw`${PROJECT}domain(?!/models/)(?:/|$)`;
const CONTAINER = file('container');
const SCREENS = folder('screens');
// From a file in screens/<name>/: `./` is its own folder, `../<other>/` another screen.
const SCREENS_RELATIVE = String.raw`^\.\.?/(?!\.\./)`;
// From a file in screens/<name>/: `../<other>/` is another screen, `../../` the project root.
const OTHER_SCREEN_RELATIVE = String.raw`^\.\./(?!\.\./)`;
const NEWS_SCREEN = folder('screens/news');
const SETTINGS_SCREEN = folder('screens/settings');
const COMPONENTS = folder('components');
const I18N = folder('i18n');
const THEME_PREFERENCE = folder('theme');
const BOOTSTRAP = folder('bootstrap');
const HOOKS = folder('hooks');
const HOOKS_EXCEPT_COLOR_SCHEME = String.raw`${PROJECT}hooks(?!/use-color-scheme(?:\.ts)?$)(?:/|$)`;
const UTILS = folder('utils');
const CONSTANTS = folder('constants');
const THEME = file('constants/theme');
const CONFIG = file('constants/config');
const REACT_LIBRARY = String.raw`^react(?:/|$)`;
const REACT = String.raw`^react(?:-native)?(?:/|$)`;
const PLATFORM_LIBRARIES = [String.raw`^react-native(?:[-/]|$)`, String.raw`^@react-native`, String.raw`^expo(?:[-/]|$)`];
// Anything that is neither a file of the domain nor a relative path.
const OUTSIDE_DOMAIN = String.raw`^(?!@/domain/|\.\.?/)`;
const ANYTHING = '.';

const forbid = (message, paths) => ({ regex: paths.join('|'), message });

const NO_REACT = forbid('The data layer and the container must not depend on React.', [REACT]);

const SERVICE_FORBIDDEN = forbid(
  'Services may import only DTOs, other services, constants/config and utils.',
  [
    APP,
    DATA_REPOSITORIES,
    DOMAIN,
    CONTAINER,
    SCREENS,
    COMPONENTS,
    I18N,
    THEME_PREFERENCE,
    BOOTSTRAP,
    HOOKS,
    THEME,
  ]
);

const SCREEN_MESSAGE =
  'Screens may import only their own view model and folder constants, models, components, i18n, theme and utils, never the folder of another screen.';
const SCREEN_FORBIDDEN = [
  APP,
  DATA,
  DOMAIN_EXCEPT_MODELS,
  CONTAINER,
  BOOTSTRAP,
  HOOKS,
  THEME,
  CONFIG,
  OTHER_SCREEN_RELATIVE,
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
      CONTAINER,
    ])
  ),
  restrictImports(
    ['domain/**'],
    forbid('The domain imports only its own files: no library, no layer, no support module.', [
      OUTSIDE_DOMAIN,
      APP,
      DATA,
      CONTAINER,
      SCREENS,
      COMPONENTS,
      I18N,
      THEME_PREFERENCE,
      BOOTSTRAP,
      HOOKS,
      UTILS,
      CONSTANTS,
    ])
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
      'Repositories may import only services, DTOs, the domain, the other files of data/repositories, constants/config and utils.',
      [APP, CONTAINER, SCREENS, COMPONENTS, I18N, THEME_PREFERENCE, BOOTSTRAP, HOOKS, THEME]
    ),
    NO_REACT
  ),
  restrictImports(
    ['data/services/**/*-dto.ts', 'domain/models/**/*-model.ts'],
    forbid('DTO and model files only declare types, constants and error classes: they import nothing.', [
      ANYTHING,
    ])
  ),
  restrictImports(
    ['container.ts'],
    forbid('The container may import only the data layer and the domain.', [
      APP,
      SCREENS,
      COMPONENTS,
      I18N,
      THEME_PREFERENCE,
      BOOTSTRAP,
      HOOKS,
      UTILS,
      CONSTANTS,
    ]),
    NO_REACT
  ),
  restrictImports(['screens/**'], forbid(SCREEN_MESSAGE, SCREEN_FORBIDDEN)),
  restrictImports(['screens/news/**'], forbid(SCREEN_MESSAGE, [...SCREEN_FORBIDDEN, SETTINGS_SCREEN])),
  restrictImports(['screens/settings/**'], forbid(SCREEN_MESSAGE, [...SCREEN_FORBIDDEN, NEWS_SCREEN])),
  // After the screen blocks, so that a view model keeps its own rule.
  restrictImports(
    ['screens/**/use-*-view-model.ts'],
    forbid('View models may import only the container, the domain, i18n, utils and React.', [
      APP,
      DATA,
      SCREENS,
      SCREENS_RELATIVE,
      COMPONENTS,
      THEME_PREFERENCE,
      BOOTSTRAP,
      HOOKS,
      THEME,
      CONFIG,
    ]),
    forbid(
      'View models must not use platform libraries: platform effects belong to the services, behind a use case.',
      PLATFORM_LIBRARIES
    )
  ),
  restrictImports(
    ['components/**'],
    forbid(
      'UI components may import only other components, constants/theme, hooks and UI libraries: data and texts arrive via props.',
      [
        APP,
        DATA,
        DOMAIN,
        CONTAINER,
        SCREENS,
        I18N,
        THEME_PREFERENCE,
        BOOTSTRAP,
        UTILS,
        CONFIG,
      ]
    )
  ),
  restrictImports(
    ['i18n/**'],
    forbid(
      'i18n may import only its own files, the container, the domain, React and platform libraries.',
      [APP, DATA, SCREENS, COMPONENTS, THEME_PREFERENCE, BOOTSTRAP, HOOKS, UTILS, THEME, CONFIG]
    )
  ),
  restrictImports(
    ['theme/**'],
    forbid(
      'theme may import only its own files, the container, the domain, React, platform libraries and the color scheme context of hooks/use-color-scheme.',
      [
        APP,
        DATA,
        SCREENS,
        COMPONENTS,
        I18N,
        BOOTSTRAP,
        HOOKS_EXCEPT_COLOR_SCHEME,
        UTILS,
        THEME,
        CONFIG,
      ]
    )
  ),
  restrictImports(
    ['bootstrap/**'],
    forbid(
      'bootstrap may import only its own files, the i18n and theme providers, the container, the domain, React and platform libraries.',
      [APP, DATA, SCREENS, COMPONENTS, HOOKS, UTILS, THEME, CONFIG]
    )
  ),
  restrictImports(
    ['constants/**', 'utils/**', 'hooks/**'],
    forbid(
      'constants, utils and hooks must not import routes, layers, the container, i18n, theme or bootstrap.',
      [
        APP,
        DATA,
        DOMAIN,
        CONTAINER,
        SCREENS,
        COMPONENTS,
        I18N,
        THEME_PREFERENCE,
        BOOTSTRAP,
      ]
    )
  ),
]);
