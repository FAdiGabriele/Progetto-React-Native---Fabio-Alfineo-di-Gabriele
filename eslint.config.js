// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Project modules are matched both as `@/` aliases and as relative paths;
// relative paths are matched by folder name, at any depth.
const PROJECT = String.raw`^(?:@/|(?:\.\./)+)`;
const folder = (name) => String.raw`${PROJECT}${name}(?:/|$)`;
const file = (name) => String.raw`${PROJECT}${name}(?:\.\w+)*$`;

const APP = folder('app');
const SERVICES = folder('services');
const REPOSITORIES = folder('repositories');
const REPOSITORIES_EXCEPT_MODELS = String.raw`${PROJECT}repositories(?!/[^/]+-model(?:\.ts)?$)(?:/|$)`;
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
const HOOKS = folder('hooks');
const HOOKS_EXCEPT_COLOR_SCHEME = String.raw`${PROJECT}hooks(?!/use-color-scheme(?:\.ts)?$)(?:/|$)`;
const UTILS = folder('utils');
const THEME = file('constants/theme');
const CONFIG = file('constants/config');
const NEWS_SECTIONS = file('constants/news-sections');
const REACT = String.raw`^react(?:-native)?(?:/|$)`;
const ANYTHING = '.';

const forbid = (message, paths) => ({ regex: paths.join('|'), message });

const NO_REACT = forbid('Services and repositories must not depend on React.', [REACT]);

const SCREEN_MESSAGE =
  'Screens may import only their own view model and folder constants, models, components, i18n, theme, utils and constants/news-sections, never the folder of another screen.';
const SCREEN_FORBIDDEN = [
  APP,
  SERVICES,
  REPOSITORIES_EXCEPT_MODELS,
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
    ['services/**'],
    forbid('Services may import only DTOs, other services, constants/config and utils.', [
      APP,
      REPOSITORIES,
      SCREENS,
      COMPONENTS,
      I18N,
      THEME_PREFERENCE,
      HOOKS,
      THEME,
      NEWS_SECTIONS,
    ]),
    NO_REACT
  ),
  restrictImports(
    ['repositories/**'],
    forbid(
      'Repositories may import only services, DTOs, models, other repositories, constants/config, constants/news-sections and utils.',
      [APP, SCREENS, COMPONENTS, I18N, THEME_PREFERENCE, HOOKS, THEME]
    ),
    NO_REACT
  ),
  restrictImports(
    ['services/**/*-dto.ts', 'repositories/**/*-model.ts'],
    forbid('DTO and model files only declare types and error classes: they import nothing.', [
      ANYTHING,
    ])
  ),
  restrictImports(['screens/**'], forbid(SCREEN_MESSAGE, SCREEN_FORBIDDEN)),
  restrictImports(['screens/news/**'], forbid(SCREEN_MESSAGE, [...SCREEN_FORBIDDEN, SETTINGS_SCREEN])),
  restrictImports(['screens/settings/**'], forbid(SCREEN_MESSAGE, [...SCREEN_FORBIDDEN, NEWS_SCREEN])),
  // After the screen blocks, so that a view model keeps its own rule.
  restrictImports(
    ['screens/**/use-*-view-model.ts'],
    forbid(
      'View models may import only repositories, models, constants/news-sections, i18n, utils, React and platform libraries.',
      [APP, SERVICES, SCREENS, SCREENS_RELATIVE, COMPONENTS, THEME_PREFERENCE, HOOKS, THEME, CONFIG]
    )
  ),
  restrictImports(
    ['components/**'],
    forbid(
      'UI components may import only other components, constants/theme, hooks and UI libraries: data and texts arrive via props.',
      [APP, SERVICES, REPOSITORIES, SCREENS, I18N, THEME_PREFERENCE, UTILS, CONFIG, NEWS_SECTIONS]
    )
  ),
  restrictImports(
    ['i18n/**'],
    forbid(
      'i18n may import only its own files, repositories, models, constants/news-sections, React and platform libraries.',
      [APP, SERVICES, SCREENS, COMPONENTS, THEME_PREFERENCE, HOOKS, UTILS, THEME, CONFIG]
    )
  ),
  restrictImports(
    ['theme/**'],
    forbid(
      'theme may import only its own files, repositories, models, constants/news-sections, React, platform libraries and the color scheme context of hooks/use-color-scheme.',
      [APP, SERVICES, SCREENS, COMPONENTS, I18N, HOOKS_EXCEPT_COLOR_SCHEME, UTILS, THEME, CONFIG]
    )
  ),
  restrictImports(
    ['constants/**', 'utils/**', 'hooks/**'],
    forbid('constants, utils and hooks must not import routes, layers, i18n or theme.', [
      APP,
      SERVICES,
      REPOSITORIES,
      SCREENS,
      COMPONENTS,
      I18N,
      THEME_PREFERENCE,
    ])
  ),
]);
