// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { basename } from 'path';
// Workaround: https://github.com/microsoft/vscode/issues/197494.
process.env['DEBUG'] = process.env['VSCODE_DEBUG'];
const debug = require('debug')('vscode-testing');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('vscode-testing.closeTest', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		debug(`closeTest! ${__filename}`);
		vscode.workspace.openTextDocument(__filename).then(doc => {
            vscode.window.showTextDocument(doc).then(() => {
				const basePath = basename(doc.uri.path);
                debug(`showing: "${basePath}"`);
				vscode.commands.executeCommand('workbench.action.closeActiveEditor').then(() => {
					debug(`active editor closed: "${basePath}"`);
				});
            });
        });
	});
	context.subscriptions.push(disposable);

	disposable = vscode.workspace.onDidOpenTextDocument((e: vscode.TextDocument) => {
		const basePath = basename(e.uri.path);
		debug(`opened: "${basePath}"`);
	});
	context.subscriptions.push(disposable);

	disposable = vscode.workspace.onDidCloseTextDocument((e: vscode.TextDocument) => {
		const basePath = basename(e.uri.path);
		debug(`closed: "${basePath}"`);
	});
	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
