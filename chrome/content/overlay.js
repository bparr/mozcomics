/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var MozComics = new function() {

	this.init = init;

	this.isWindow = null;

	this.onChromeLoad = onChromeLoad;
	this.onUnload = onUnload;
	this.openWindow = openWindow;
	this.togglePane = togglePane;
	this.toggleComicPickerPane = toggleComicPickerPane;
	this.handleKeyPress = handleKeyPress;
	this.buildComicsContextMenu = buildComicsContextMenu;
	this.showPreferences = showPreferences;

	var MAX_BOOKMARK = 2;

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

		if(MozComics.Prefs.get('firstRun')) {
			var url = MozComics.Utils.URLS.FIRST_RUN;
			gBrowser.selectedTab = gBrowser.addTab(url, null);
			MozComics.Prefs.set('firstRun', false);
		}
	}

	function onUnload() {
		window.removeEventListener("unload", MozComics.onUnload, false);

		MozComics.Strips.unload();
		MozComics.Comics.unload();
	}

	function openWindow() {
		this.togglePane();
		window.open('chrome://mozcomics/content/window.xul',
			'_blank', 'chrome,resizable=yes'
		);
	}

	function togglePane() {
		if(this.isWindow) {
			return;
		}

		var nowHidden = !MozComics.Dom.pane.hidden;
		MozComics.Dom.pane.hidden = nowHidden;
		MozComics.Dom.paneSplitter.hidden = nowHidden;
		(nowHidden) ? MozComics.Dom.focusableStripPane.blur() : MozComics.Dom.focusableStripPane.focus();
	}

	function toggleComicPickerPane() {
		MozComics.Dom.comicPickerPane.hidden = !MozComics.Dom.comicPickerPane.hidden;
		MozComics.Dom.comicPickerToolbarIcon.setAttribute("expand", MozComics.Dom.comicPickerPane.hidden);
	}

	function handleKeyPress(event, from) {
		var key = String.fromCharCode(event.which);
		event.preventDefault();
		if(!event.ctrlKey && !event.altKey && !event.metaKey) {
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
					MozComics.Strips.setToRandomStrip();
				}
				else if(key == 'u') {
					MozComics.Dom.updateRead.checked = !MozComics.Dom.updateRead.checked;
				}
				else if(key == 's') {
					MozComics.Dom.showRead.checked = !MozComics.Dom.showRead.checked;
				}
				else if(key == 'b') {
					var newValue = (parseInt(MozComics.Dom.bookmarkMenu.value) + 1) % MAX_BOOKMARK;
					MozComics.Dom.bookmarkMenu.value = newValue;
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

	function showPreferences() {
		window.openDialog('chrome://mozcomics/content/preferences.xul',
			'mozcomics-preferences', 'chrome,modal=yes'
		);

		MozComics.Comics.updateStatusBarPanel();
	}
}

MozComics.init();

