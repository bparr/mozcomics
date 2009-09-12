/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var MozComics = new function() {

	this.init = init;

	this.onChromeLoad = onChromeLoad;
	this.onUnload = onUnload;
	this.togglePane = togglePane;
	this.toggleComicPickerPane = toggleComicPickerPane;
	this.handleKeyPress = handleKeyPress;
	this.buildComicsContextMenu = buildComicsContextMenu;
	this.showPreferences = showPreferences;

	function init() {
		// load code from resource module
		Components.utils.import("resource://mozcomics/utils.js"); this.Utils = Utils;
		Components.utils.import("resource://mozcomics/prefs.js"); this.Prefs = Prefs;
		Components.utils.import("resource://mozcomics/update.js"); this.Update = Update;
		
		// load other javascript files
		var scriptFiles = [
			"comicPicker",
			"comics",
			"dom",
			"strips"
		];
		var scriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader);
		for(var i = 0, len = scriptFiles.length; i < len; i++) {
			scriptLoader.loadSubScript("chrome://mozcomics/content/" + scriptFiles[i] + ".js");
		}

		window.addEventListener("load", MozComics.onChromeLoad, false);
	}

	function onChromeLoad() {
		window.removeEventListener("load", MozComics.onChromeLoad, false);
		window.addEventListener("unload", MozComics.onUnload, false);

		MozComics.Dom.init();
		MozComics.Strips.init();
		MozComics.ComicPicker.init();
		MozComics.Comics.init();
	}

	function onUnload() {
		window.removeEventListener("unload", MozComics.onUnload, false);

		MozComics.Strips.unload();
		MozComics.Comics.unload();
	}

	function togglePane() {
		var nowHidden = !MozComics.Dom.pane.hidden;
		MozComics.Dom.pane.hidden = nowHidden;
		MozComics.Dom.paneSplitter.hidden = nowHidden;
		(nowHidden) ? MozComics.Dom.pane.blur() : MozComics.Dom.pane.focus();
	}

	function toggleComicPickerPane() {
		MozComics.Dom.comicPickerPane.hidden = !MozComics.Dom.comicPickerPane.hidden;
		MozComics.Dom.comicPickerToolbarIcon.setAttribute("expand", MozComics.Dom.comicPickerPane.hidden);
	}

	function handleKeyPress(event, from) {
		var key = String.fromCharCode(event.which);
		if(from == "mozcomics-strip-pane" && !event.ctrlKey && !event.altKey && !event.metaKey) {
			if(event.shiftKey) {
				if(event.keyCode == event.DOM_VK_BACK_SPACE) {
					MozComics.Strips.setToForwardStrip();
				}
			}
			else {
				if(event.keyCode == event.DOM_VK_LEFT || key == 'p') {
					MozComics.Strips.setToPreviousStrip();
				}
				else if(event.keyCode == event.DOM_VK_RIGHT || key == 'n') {
					MozComics.Strips.setToNextStrip();
				}
				else if(event.keyCode == event.DOM_VK_BACK_SPACE) {
					MozComics.Strips.setToBackStrip();
				}
				else if(key == 'f') {
					MozComics.Strips.setToFirstStrip();
				}
				else if(key == 'l') {
					MozComics.Strips.setToLastStrip();
				}
				else if(key == 'r') {
					MozComics.Dom.updateRead.checked = !MozComics.Dom.updateRead.checked;
				}
				else if(key == 's') {
					MozComics.Dom.showRead.checked = !MozComics.Dom.showRead.checked;
				}
			}
		}
	}

	function buildComicsContextMenu() {
		var menu = MozComics.Dom.comicPickerContextMenu;
		var hideItems = !MozComics.ComicPicker.selectedComic;
		for(var i = 0, len = menu.childNodes.length; i < len; i++) {
			menu.childNodes[i].setAttribute('hidden', hideItems);
		}
	}

	function showPreferences() { // TODO implement

	}
}

MozComics.init();

