import { dirname, isAbsolute } from 'node:path';

import globjoin from 'globjoin';
import micromatch from 'micromatch';
import normalizePath from 'normalize-path';

import configurationError from './utils/configurationError.mjs';
import dynamicImport from './utils/dynamicImport.mjs';
import getModulePath from './utils/getModulePath.mjs';
import normalizeAllRuleSettings from './normalizeAllRuleSettings.mjs';

/** @typedef {import('tripleten-stylelint').InternalApi} StylelintInternalApi */
/** @typedef {import('tripleten-stylelint').Config} StylelintConfig */
/** @typedef {import('tripleten-stylelint').CosmiconfigResult} StylelintCosmiconfigResult */

/**
 * @param {string} glob
 * @param {string} basedir
 * @returns {string}
 */
function absolutizeGlob(glob, basedir) {
	const result = isAbsolute(glob.replace(/^!/, '')) ? glob : globjoin(basedir, glob);

	// Glob patterns for micromatch should be in POSIX-style
	return normalizePath(result);
}

/**
 * - Merges config and stylelint options
 * - Makes all paths absolute
 * - Merges extends
 * @param {StylelintInternalApi} stylelint
 * @param {StylelintConfig} config
 * @param {string} configDir
 * @param {boolean} allowOverrides
 * @param {string} rootConfigDir
 * @param {string} [filePath]
 * @returns {Promise<StylelintConfig>}
 */
async function augmentConfigBasic(
	stylelint,
	config,
	configDir,
	allowOverrides,
	rootConfigDir,
	filePath,
) {
	let augmentedConfig = config;

	if (allowOverrides) {
		augmentedConfig = addOptions(stylelint, augmentedConfig);
	}

	if (filePath) {
		augmentedConfig = applyOverrides(augmentedConfig, rootConfigDir, filePath);
	}

	augmentedConfig = await extendConfig(
		stylelint,
		augmentedConfig,
		configDir,
		rootConfigDir,
		filePath,
	);

	const cwd = stylelint._options.cwd;

	return absolutizePaths(augmentedConfig, configDir, cwd);
}

/**
 * Extended configs need to be run through augmentConfigBasic
 * but do not need the full treatment. Things like pluginFunctions
 * will be resolved and added by the parent config.
 * @param {string} cwd
 * @returns {(cosmiconfigResult?: StylelintCosmiconfigResult) => Promise<StylelintCosmiconfigResult>}
 */
export function augmentConfigExtended(cwd) {
	return async (cosmiconfigResult) => {
		if (!cosmiconfigResult) {
			return null;
		}

		const configDir = dirname(cosmiconfigResult.filepath || '');
		const { config } = cosmiconfigResult;

		const augmentedConfig = absolutizePaths(config, configDir, cwd);

		return {
			config: augmentedConfig,
			filepath: cosmiconfigResult.filepath,
		};
	};
}

/**
 * @param {StylelintInternalApi} stylelint
 * @param {string} [filePath]
 * @param {StylelintCosmiconfigResult} [cosmiconfigResult]
 * @returns {Promise<StylelintCosmiconfigResult>}
 */
export async function augmentConfigFull(stylelint, filePath, cosmiconfigResult) {
	if (!cosmiconfigResult) {
		return null;
	}

	const config = cosmiconfigResult.config;
	const filepath = cosmiconfigResult.filepath;

	const configDir = stylelint._options.configBasedir || dirname(filepath || '');

	let augmentedConfig = await augmentConfigBasic(
		stylelint,
		config,
		configDir,
		true,
		configDir,
		filePath,
	);

	augmentedConfig = await addPluginFunctions(augmentedConfig, stylelint._options);

	if (!augmentedConfig.rules) {
		throw configurationError(
			'No rules found within configuration. Have you provided a "rules" property?',
		);
	}

	augmentedConfig = await normalizeAllRuleSettings(augmentedConfig);

	return {
		config: augmentedConfig,
		filepath: cosmiconfigResult.filepath,
	};
}

/**
 * Make all paths in the config absolute.
 *
 * @param {StylelintConfig} config
 * @param {string} configDir
 * @param {string} cwd
 * @returns {StylelintConfig}
 */
function absolutizePaths(config, configDir, cwd) {
	if (config.ignoreFiles) {
		config.ignoreFiles = [config.ignoreFiles].flat().map((glob) => absolutizeGlob(glob, configDir));
	}

	if (config.plugins) {
		config.plugins = [config.plugins].flat().map((lookup) => {
			if (typeof lookup === 'string') {
				return getModulePath(configDir, lookup, cwd);
			}

			return lookup;
		});
	}

	return config;
}

/**
 * @param {StylelintInternalApi} stylelint
 * @param {StylelintConfig} config
 * @param {string} configDir
 * @param {string} rootConfigDir
 * @param {string} [filePath]
 * @return {Promise<StylelintConfig>}
 */
async function extendConfig(stylelint, config, configDir, rootConfigDir, filePath) {
	if (config.extends === undefined) {
		return config;
	}

	const { extends: configExtends, ...originalWithoutExtends } = config;
	const normalizedExtends = [configExtends].flat();

	let resultConfig = originalWithoutExtends;

	for (const extendLookup of normalizedExtends) {
		let extendResult;

		if (typeof extendLookup === 'string') {
			extendResult = await loadExtendedConfig(stylelint, configDir, extendLookup);
		} else if (typeof extendLookup === 'object' && extendLookup !== null) {
			extendResult = { config: extendLookup };
		}

		if (extendResult) {
			let extendResultConfig = extendResult.config;
			const extendConfigDir = dirname(extendResult.filepath || '');

			extendResultConfig = await augmentConfigBasic(
				stylelint,
				extendResultConfig,
				extendConfigDir,
				false,
				rootConfigDir,
				filePath,
			);

			resultConfig = mergeConfigs(resultConfig, extendResultConfig);
		}
	}

	return mergeConfigs(resultConfig, originalWithoutExtends);
}

/**
 * @param {StylelintInternalApi} stylelint
 * @param {string} configDir
 * @param {string} extendLookup
 * @return {Promise<StylelintCosmiconfigResult>}
 */
function loadExtendedConfig(stylelint, configDir, extendLookup) {
	const extendPath = getModulePath(configDir, extendLookup, stylelint._options.cwd);

	return stylelint._extendExplorer.load(extendPath);
}

/**
 * When merging configs (via extends)
 * - plugin, extends, overrides arrays are joined
 * - rules are merged via Object.assign, so there is no attempt made to
 *   merge any given rule's settings. If b contains the same rule as a,
 *   b's rule settings will override a's rule settings entirely.
 * - Everything else is merged via Object.assign
 * @param {StylelintConfig} a
 * @param {StylelintConfig} b
 * @returns {StylelintConfig}
 */
function mergeConfigs(a, b) {
	/** @type {Pick<StylelintConfig, 'plugins'>} */
	const pluginMerger = {};

	if (a.plugins || b.plugins) {
		pluginMerger.plugins = [];

		if (a.plugins) {
			pluginMerger.plugins = pluginMerger.plugins.concat(a.plugins);
		}

		if (b.plugins) {
			pluginMerger.plugins = [...new Set(pluginMerger.plugins.concat(b.plugins))];
		}
	}

	/** @type {Pick<StylelintConfig, 'overrides'>} */
	const overridesMerger = {};

	if (a.overrides || b.overrides) {
		overridesMerger.overrides = [];

		if (a.overrides) {
			overridesMerger.overrides = overridesMerger.overrides.concat(a.overrides);
		}

		if (b.overrides) {
			overridesMerger.overrides = [...new Set(overridesMerger.overrides.concat(b.overrides))];
		}
	}

	/** @type {Pick<StylelintConfig, 'extends'>} */
	const extendsMerger = {};

	if (a.extends || b.extends) {
		extendsMerger.extends = [];

		if (a.extends) {
			extendsMerger.extends = extendsMerger.extends.concat(a.extends);
		}

		if (b.extends) {
			extendsMerger.extends = extendsMerger.extends.concat(b.extends);
		}

		// Remove duplicates from the array, the last item takes precedence
		extendsMerger.extends = extendsMerger.extends.filter(
			(item, index, arr) => arr.lastIndexOf(item) === index,
		);
	}

	const rulesMerger = {};

	if (a.rules || b.rules) {
		rulesMerger.rules = { ...a.rules, ...b.rules };
	}

	const result = {
		...a,
		...b,
		...extendsMerger,
		...pluginMerger,
		...overridesMerger,
		...rulesMerger,
	};

	return result;
}

/**
 * @param {StylelintConfig} config
 * @param {import('tripleten-stylelint').LinterOptions} options
 * @returns {Promise<StylelintConfig>}
 */
async function addPluginFunctions(config, { quietDeprecationWarnings }) {
	if (!config.plugins) {
		return config;
	}

	const normalizedPlugins = [config.plugins].flat();

	/** @type {StylelintConfig['pluginFunctions']} */
	const pluginFunctions = {};

	for (const pluginLookup of normalizedPlugins) {
		let pluginImport;

		if (typeof pluginLookup === 'string') {
			pluginImport = await dynamicImport(pluginLookup);

			// NOTE: This '.cjs' check is limited. Some CommonJS plugins may have the '.js' extension.
			if (!quietDeprecationWarnings && pluginLookup.endsWith('.cjs')) {
				console.warn(
					`CommonJS plugins are deprecated ("${pluginLookup}"). See https://stylelint.io/migration-guide/to-16`,
				);
			}
		} else {
			pluginImport = pluginLookup;
		}

		// Handle either ES6 or CommonJS modules
		pluginImport = pluginImport.default || pluginImport;

		// A plugin can export either a single rule definition
		// or an array of them
		const normalizedPluginImport = [pluginImport].flat();

		for (const pluginRuleDefinition of normalizedPluginImport) {
			if (!pluginRuleDefinition.ruleName) {
				throw configurationError(
					`stylelint requires plugins to expose a ruleName. The plugin "${pluginLookup}" is not doing this, so will not work with stylelint. Please file an issue with the plugin.`,
				);
			}

			if (!pluginRuleDefinition.ruleName.includes('/')) {
				throw configurationError(
					`stylelint requires plugin rules to be namespaced, i.e. only \`plugin-namespace/plugin-rule-name\` plugin rule names are supported. The plugin rule "${pluginRuleDefinition.ruleName}" does not do this, so will not work. Please file an issue with the plugin.`,
				);
			}

			pluginFunctions[pluginRuleDefinition.ruleName] = pluginRuleDefinition.rule;
		}
	}

	config.pluginFunctions = pluginFunctions;

	return config;
}

/**
 * @param {StylelintConfig} fullConfig
 * @param {string} rootConfigDir
 * @param {string} filePath
 * @return {StylelintConfig}
 */
export function applyOverrides(fullConfig, rootConfigDir, filePath) {
	let { overrides, ...config } = fullConfig;

	if (!overrides) {
		return config;
	}

	if (!Array.isArray(overrides)) {
		throw new TypeError(
			'The `overrides` configuration property should be an array, e.g. { "overrides": [{ "files": "*.css", "rules": {} }] }.',
		);
	}

	for (const override of overrides) {
		const { files, ...configOverrides } = override;

		if (!files) {
			throw new Error(
				'Every object in the `overrides` configuration property should have a `files` property with globs, e.g. { "overrides": [{ "files": "*.css", "rules": {} }] }.',
			);
		}

		const absoluteGlobs = [files].flat().map((glob) => absolutizeGlob(glob, rootConfigDir));

		if (
			micromatch.isMatch(filePath, absoluteGlobs, { dot: true }) ||
			// E.g. `*.css` matches any CSS files in any directories.
			micromatch.isMatch(filePath, files, { dot: true, basename: true })
		) {
			config = mergeConfigs(config, configOverrides);
		}
	}

	return config;
}

/**
 * Add options to the config
 *
 * @param {StylelintInternalApi} stylelint
 * @param {StylelintConfig} config
 *
 * @returns {StylelintConfig}
 */
function addOptions(stylelint, config) {
	const augmentedConfig = {
		...config,
	};

	if (stylelint._options.ignoreDisables) {
		augmentedConfig.ignoreDisables = stylelint._options.ignoreDisables;
	}

	if (stylelint._options.quiet) {
		augmentedConfig.quiet = stylelint._options.quiet;
	}

	if (stylelint._options.reportNeedlessDisables) {
		augmentedConfig.reportNeedlessDisables = stylelint._options.reportNeedlessDisables;
	}

	if (stylelint._options.reportInvalidScopeDisables) {
		augmentedConfig.reportInvalidScopeDisables = stylelint._options.reportInvalidScopeDisables;
	}

	if (stylelint._options.reportDescriptionlessDisables) {
		augmentedConfig.reportDescriptionlessDisables =
			stylelint._options.reportDescriptionlessDisables;
	}

	if (stylelint._options.customSyntax) {
		augmentedConfig.customSyntax = stylelint._options.customSyntax;
	}

	if (stylelint._options.fix) {
		augmentedConfig.fix = stylelint._options.fix;
	}

	return augmentedConfig;
}
