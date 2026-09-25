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
const COMPONENTS = folder('components');
const I18N = folder('i18n');
const HOOKS = folder('hooks');
const UTILS = folder('utils');
const THEME = file('constants/theme');
const CONFIG = file('constants/config');
const NEWS_SECTIONS = file('constants/news-sections');
const REACT = String.raw`^react(?:-native)?(?:/|$)`;
const ANYTHING = '.';

const forbid = (message, paths) => ({ regex: paths.join('|'), message });

const NO_REACT = forbid('Services and repositories must not depend on React.', [REACT]);

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
      [APP, SCREENS, COMPONENTS, I18N, HOOKS, THEME]
    ),
    NO_REACT
  ),
  restrictImports(
    ['services/**/*-dto.ts', 'repositories/**/*-model.ts'],
    forbid('DTO and model files only declare types and error classes: they import nothing.', [
      ANYTHING,
    ])
  ),
  restrictImports(
    ['screens/**'],
    forbid(
      'Screens may import only their own view model and folder constants, models, components, i18n, utils and constants/news-sections.',
      [APP, SERVICES, REPOSITORIES_EXCEPT_MODELS, HOOKS, THEME, CONFIG]
    )
  ),
  restrictImports(
    ['screens/**/use-*-view-model.ts'],
    forbid(
      'View models may import only repositories, models, constants/news-sections, React and platform libraries.',
      [APP, SERVICES, SCREENS, SCREENS_RELATIVE, COMPONENTS, I18N, HOOKS, UTILS, THEME, CONFIG]
    )
  ),
  restrictImports(
    ['components/**'],
    forbid(
      'UI components may import only other components, constants/theme, hooks and UI libraries: data and texts arrive via props.',
      [APP, SERVICES, REPOSITORIES, SCREENS, I18N, UTILS, CONFIG, NEWS_SECTIONS]
    )
  ),
  restrictImports(
    ['i18n/**'],
    forbid(
      'i18n follows the view model rules: besides its own files it may import only repositories, models, constants/news-sections, React and platform libraries.',
      [APP, SERVICES, SCREENS, COMPONENTS, HOOKS, UTILS, THEME, CONFIG]
    )
  ),
  restrictImports(
    ['constants/**', 'utils/**', 'hooks/**'],
    forbid('constants, utils and hooks must not import routes, layers or i18n.', [
      APP,
      SERVICES,
      REPOSITORIES,
      SCREENS,
      COMPONENTS,
      I18N,
    ])
  ),
]);
