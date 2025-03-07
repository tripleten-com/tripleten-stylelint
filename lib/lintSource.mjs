import { isAbsolute } from 'node:path';

import getConfigForFile from './getConfigForFile.mjs';
import getPostcssResult from './getPostcssResult.mjs';
import isPathIgnored from './isPathIgnored.mjs';
import isPathNotFoundError from './utils/isPathNotFoundError.mjs';
import lintPostcssResult from './lintPostcssResult.mjs';

/** @typedef {import('tripleten-stylelint').InternalApi} StylelintInternalApi */
/** @typedef {import('tripleten-stylelint').GetLintSourceOptions} Options */
/** @typedef {import('postcss').Result} Result */
/** @typedef {import('tripleten-stylelint').PostcssResult} PostcssResult */
/** @typedef {import('tripleten-stylelint').StylelintPostcssResult} StylelintPostcssResult */

/**
 * Run stylelint on a PostCSS Result, either one that is provided
 * or one that we create
 * @param {StylelintInternalApi} stylelint
 * @param {Options} options
 * @returns {Promise<PostcssResult>}
 */
export default async function lintSource(stylelint, options = {}) {
	if (!options.filePath && options.code === undefined && !options.existingPostcssResult) {
		return Promise.reject(new Error('You must provide filePath, code, or existingPostcssResult'));
	}

	const isCodeNotFile = options.code !== undefined;

	const inputFilePath = isCodeNotFile ? options.codeFilename : options.filePath;

	if (inputFilePath !== undefined && !isAbsolute(inputFilePath)) {
		if (isCodeNotFile) {
			return Promise.reject(new Error('codeFilename must be an absolute path'));
		}

		return Promise.reject(new Error('filePath must be an absolute path'));
	}

	const isIgnored = await isPathIgnored(stylelint, inputFilePath).catch((err) => {
		if (isCodeNotFile && isPathNotFoundError(err)) return false;

		throw err;
	});

	if (isIgnored) {
		return options.existingPostcssResult
			? Object.assign(options.existingPostcssResult, {
					stylelint: createEmptyStylelintPostcssResult(),
			  })
			: createEmptyPostcssResult(inputFilePath);
	}

	const configSearchPath = stylelint._options.configFile || inputFilePath;
	const cwd = stylelint._options.cwd;

	let configForFile;

	try {
		configForFile = await getConfigForFile(stylelint, configSearchPath, inputFilePath);
	} catch (err) {
		if (isCodeNotFile && isPathNotFoundError(err)) {
			configForFile = await getConfigForFile(stylelint, cwd);
		} else {
			throw err;
		}
	}

	if (!configForFile) {
		return Promise.reject(new Error('Config file not found'));
	}

	const config = configForFile.config;
	const existingPostcssResult = options.existingPostcssResult;

	if (options.cache) {
		stylelint._fileCache.calcHashOfConfig(config);

		if (options.filePath && !stylelint._fileCache.hasFileChanged(options.filePath)) {
			return existingPostcssResult
				? Object.assign(existingPostcssResult, {
						stylelint: createEmptyStylelintPostcssResult(),
				  })
				: createEmptyPostcssResult(inputFilePath);
		}
	}

	/** @type {StylelintPostcssResult} */
	const stylelintResult = {
		ruleSeverities: {},
		customMessages: {},
		ruleMetadata: {},
		disabledRanges: {},
	};

	const postcssResult =
		existingPostcssResult ||
		(await getPostcssResult(stylelint, {
			code: options.code,
			codeFilename: options.codeFilename,
			filePath: inputFilePath,
			customSyntax: config.customSyntax,
		}));

	const stylelintPostcssResult = Object.assign(postcssResult, {
		stylelint: stylelintResult,
	});

	await lintPostcssResult(stylelint._options, stylelintPostcssResult, config);

	return stylelintPostcssResult;
}

/**
 * @returns {StylelintPostcssResult}
 */
function createEmptyStylelintPostcssResult() {
	return {
		ruleSeverities: {},
		customMessages: {},
		ruleMetadata: {},
		disabledRanges: {},
		ignored: true,
		stylelintError: false,
		stylelintWarning: false,
	};
}

/**
 * @param {string} [filePath]
 * @returns {PostcssResult}
 */
function createEmptyPostcssResult(filePath) {
	return {
		root: {
			source: {
				input: { file: filePath },
			},
		},
		messages: [],
		opts: undefined,
		stylelint: createEmptyStylelintPostcssResult(),
		warn: () => {},
	};
}
