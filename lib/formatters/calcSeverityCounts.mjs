/**
 * @typedef {import('tripleten-stylelint').Severity} Severity
 *
 * @param {Severity} severity
 * @param {Record<Severity, number>} counts
 * @returns {void}
 */
export default function calcSeverityCounts(severity, counts) {
	switch (severity) {
		case 'error':
			counts.error += 1;
			break;
		case 'warning':
			counts.warning += 1;
			break;
		default:
			throw new Error(`Unknown severity: "${severity}"`);
	}
}
