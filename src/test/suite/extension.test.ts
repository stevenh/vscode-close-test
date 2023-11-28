import * as assert from 'assert';
import { error } from 'console';
import { basename } from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

// Store the DEBUG environment variable before we change it.
const envDebug = process.env['DEBUG'];
const debugLib = require('debug');
debugLib.enable('vscode-testing'); // Force enable debug logging.
const debug = debugLib('vscode-testing');

/**
 * Profiler is manager events including measuring their duration events.
 */
class Profiler {
	readonly second = 1000; // 1 second in milliseconds.

	private resolvers: Map<string, (value: void | PromiseLike<void>) => void> = new Map();
	private profile: Map<string, number> = new Map();

	/**
	 * Returns the time since the event with the given id in milliseconds.
	 *
	 * @param id The id of the event.
	 * @returns The time since the event in milliseconds.
	 */
	private since(id: string): number {
		const start = this.profile.get(id);
		if (start === undefined) {
			debug(`Profiler: "${id}" not found`);
			return 0;
		}
		return Math.round(performance.now() - start);
	}

	/**
	 * Returns the time since the event with the given id as a string.
	 * The string is formatted as: "s.ms".
	 * If the time is less than 1 second, the string is formatted as: "ms".
	 * If the time is less than 1 millisecond, the string is formatted as: "0ms".
	 *
	 * @param id The id of the event.
	 * @returns The time since the event as a string.
	 */
	private sinceSting(id: string) {
		let since = this.since(id);
		let seconds = Math.round(since / this.second);
		let ms = since % this.second;
		let sinceSting = (seconds > 0) ? `${seconds}s ` : '';
		return `${sinceSting}${ms}ms`;
	}

	/**
	 * Starts a new event with the given id.
	 */
	start(id: string) {
		this.profile.set(id, performance.now());
	}

	/**
	 * Ends the event with the given id and returns the time since the event started.
	 *
	 * @param id The id of the event.
	 * @returns The human time since event started.
	 */
	end(id: string): string {
		const since = this.sinceSting(id);
		this.profile.delete(id);
		return since;
	}

	/**
	 * Creates a promise which resolves when triggered externally.
	 *
	 * @param name The name of the promise.
	 * @param timeout The timeout in milliseconds.
	 * @returns A promise which resolves when resolved.
	 */
	wait(name: string, timeout: number = 1000): Promise<void> {
		this.start(name);

		let timer: NodeJS.Timeout;
		return new Promise<void>((resolve, reject) => {
			timer = setTimeout(() => {
				reject(new Error(`${name} timeout: "${name}" waited: ${profiler.end(name)}`));
			}, timeout);

			this.resolvers.set(name, () => {
				debug(`Resolved ${name}: took: ${this.end(name)}`);
				resolve();
			});
		}).finally(() => {
			debug(`Finally ${name}`);
			clearTimeout(timer);
			this.resolvers.delete(name);
		});
	}

	/**
	 * Resolves the promise with the given name.
	 *
	 * @param name The name of the promise.
	 */
	resolve(name: string): void {
		const resolver = this.resolvers.get(name);
		if (resolver) {
			resolver();
		}
	}
}

const profiler = new Profiler();
// Timeout for the close tests.
// If you increase this to around 3 minutes the close event will eventually trigger.
const closeTimeout = 10 * profiler.second;

// Report when documents are opened, to demonstrate that works as expected.
vscode.workspace.onDidOpenTextDocument((e: vscode.TextDocument) => {
	const basePath = basename(e.uri.path);
	debug(`opened: "${basePath}"`);
});

// Report when documents are closed and resolve associated promises.
vscode.workspace.onDidCloseTextDocument((e: vscode.TextDocument) => {
	const basePath = basename(e.uri.path);
	debug(`closed: "${basePath}"`);
	profiler.resolve(`closeTabs:${basePath}`);
	profiler.resolve(`closeActive:${basePath}`);
});

suite('Extension Test Suite', () => {
	// Issue: https://github.com/microsoft/vscode/issues/199282.
	test('Close Tab Groups', async function() {
		this.timeout(closeTimeout*2); // Ensure the test timeout doesn't trigger before our wait timeout.

		const basePath = basename(__filename);
		// Configure a wait which resolves when the onDidCloseTextDocument is triggered.
		const closePromise = profiler.wait(`closeTabs:${basePath}`, closeTimeout);

		// Open the file.
		const doc = await vscode.workspace.openTextDocument(__filename);
		debug(`opened file: "${basePath}"`);

		// Show the document, so we can close it.
		await vscode.window.showTextDocument(doc);
		debug(`shown doc: "${basePath}"`);

		// Close all tabs which match the document which should trigger the onDidCloseTextDocument event.
		const allTabs: vscode.Tab[] = vscode.window.tabGroups.all.map(tg => tg.tabs).flat();
		const matchingTabs = allTabs.filter(tab => tab.input instanceof vscode.TabInputText && tab.input.uri.path === doc.uri.path);
		await vscode.window.tabGroups.close(matchingTabs);
		debug(`active tabs closed: "${basePath}" count: ${matchingTabs.length}`);

		// Wait for the onDidCloseTextDocument event to trigger.
		await closePromise;
		debug(`test done: "${basePath}"`);
	});

	// Issue: https://github.com/microsoft/vscode/issues/199282.
	test('Close Active Editor', async function() {
		this.timeout(closeTimeout*2); // Ensure the test timeout doesn't trigger before our wait timeout.

		const basePath = basename(__filename);
		// Configure a wait which resolves when the onDidCloseTextDocument is triggered.
		const closePromise = profiler.wait(`closeActive:${basePath}`, closeTimeout);

		// Open the file.
		const doc = await vscode.workspace.openTextDocument(__filename);
		debug(`opened file: "${basePath}"`);

		// Show the document, so we can close it.
		await vscode.window.showTextDocument(doc);
		debug(`shown doc: "${basePath}"`);

		// Close the active editor which should trigger the onDidCloseTextDocument event.
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		debug(`active editor closed: "${basePath}"`);

		// Wait for the onDidCloseTextDocument event to trigger.
		await closePromise;
		debug(`test done: "${basePath}"`);
	});

	// Issue: https://github.com/microsoft/vscode/issues/197494.
	test('Process DEBUG Environment Variable', function() {
		assert.strictEqual(envDebug, process.env['VSCODE_DEBUG'], `DEBUG should be "${process.env['VSCODE_DEBUG']}" got: "${envDebug}"`);
	});
});
