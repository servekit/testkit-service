// Project-level umi plugin entry. umi auto-loads ./plugin.ts from the cwd as a
// full plugin (with the complete PluginAPI), unlike a `presets:` config entry
// which gets a restricted preset-only API. We re-export @umijs/max-plugin-openapi
// here so its `openapi` command (= `max openapi`, run via the `openapi` npm
// script) is registered with access to the dev middlewares it needs.
// The plugin enables itself via EnableBy.config when the `openAPI` key is set.
export { default } from '@umijs/max-plugin-openapi';
