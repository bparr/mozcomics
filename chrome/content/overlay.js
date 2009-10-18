/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var MozComics = new function() {

	this.init = init;

	this.isWindow = null;

	this.onChromeLoad = onChromeLoad;
	this.onUnload = onUnload;
	this.showWebpage = showWebpage;
	this.openWindow = openWindow;
	this._openMozComicsWindow = _openMozComicsWindow;
	this.togglePane = togglePane;
	this.toggleComicPickerPane = toggleComicPickerPane;
	this.toggleAdvanced = toggleAdvanced;
	this.focusStripPane = focusStripPane;
	this.handleKeyDown = handleKeyDown;
	this.handleKeyUp = handleKeyUp;
	this.buildComicsContextMenu = buildComicsContextMenu;
	this.showPreferences = showPreferences;
	this._getCurrentScrollXPos = _getCurrentScrollXPos;

	this.lastScrollXPos = null;

	var MAX_BOOKMARK = 2;

	this.callbackId = null;
	this.callbackFunctions = {
		stripRead: function() {
			MozComics.Comics.updateStatusBarPanel();
			MozComics.ComicPicker.treeview.update();
		},

		comicsChanged: function() {
			MozComics.Comics.updateStatusBarPanel();
			MozComics.Comics.refreshCache();
		},

		prefsChanged: function() {
			MozComics.Dom.enableAll.disabled = !MozComics.Prefs.user.multipleEnabledComics;
			MozComics.Comics.updateStatusBarPanel();
		}
	}

	function init() {
		// load code from resource module
		Components.utils.import("resource://mozcomics/utils.js"); this.Utils = Utils;
		Components.utils.import("resource://mozcomics/prefs.js"); this.Prefs = Prefs;
		Components.utils.import("resource://mozcomics/update.js"); this.Update = Update;
		Components.utils.import("resource://mozcomics/callback.js"); this.Callback = Callback;

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

		MozComics.callbackId = MozComics.Callback.add(MozComics.callbackFunctions);
		MozComics.Prefs.recache();

		if(MozComics.Prefs.user.firstRun) {
			MozComics.showWebpage(MozComics.Utils.URLS.FIRST_RUN);
			MozComics.Prefs.set('firstRun', false);
		}

		if(MozComics.isWindow) {
			MozComics.focusStripPane();
		}
	}

	function onUnload() {
		window.removeEventListener("unload", MozComics.onUnload, false);

		MozComics.Strips.unload();
		MozComics.Comics.unload();

		MozComics.Callback.remove(MozComics.callbackId);
	}

	function showWebpage(url) {
		if(MozComics.isWindow) {
			window.open(MozComics.Utils.URLS.COMIC_LIST);
		}
		else {
			gBrowser.selectedTab = gBrowser.addTab(url, null);
		}
	}

	function openWindow() {
		this.togglePane();
		this._openMozComicsWindow();
	}

	function _openMozComicsWindow() {
		window.open('chrome://mozcomics/content/window.xul',
			'_blank', 'chrome,resizable=yes'
		);
	}

	function togglePane() {
		if(this.isWindow) {
			return;
		}

		var nowHidden = !MozComics.Dom.pane.hidden;
		if(!nowHidden && MozComics.Prefs.user.alwaysOpenInNewWindow) {
			this._openMozComicsWindow();
		}
		else {
			MozComics.Dom.pane.hidden = nowHidden;
			MozComics.Dom.paneSplitter.hidden = nowHidden;
			(nowHidden) ? MozComics.Dom.focusableStripPane.blur() : MozComics.focusStripPane();
		}
	}

	function toggleComicPickerPane() {
		var nowHidden = !MozComics.Dom.comicPickerPane.hidden;
		MozComics.Dom.comicPickerPane.hidden = nowHidden;
		MozComics.Dom.comicPickerToolbarIcon.setAttribute("expand", nowHidden);
		MozComics.Dom.comicPickerPaneSplitter.hidden = nowHidden;
	}

	function toggleAdvanced() {
		var nowHidden = !MozComics.Dom.advanced.hidden;
		MozComics.Dom.advanced.hidden = nowHidden;
		MozComics.Dom.advancedToggle.setAttribute("expand", nowHidden);
	}

	function focusStripPane() {
		MozComics.Dom.focusableStripPane.focus();
	}

	function handleKeyDown(event, from) {
		var key = String.fromCharCode(event.which).toLowerCase();
		if(!event.ctrlKey && !event.altKey && !event.metaKey) {
			if(event.shiftKey) {
				if(event.keyCode == event.DOM_VK_BACK_SPACE) {
					event.preventDefault();
					MozComics.Strips.setToForwardStrip();
				}
			}
			else {
				if(event.keyCode == event.DOM_VK_SPACE) {
					MozComics.toggleComicPickerPane();
				}
				else if(event.keyCode == event.DOM_VK_LEFT && MozComics.lastScrollXPos === null) {
					MozComics.lastScrollXPos = MozComics._getCurrentScrollXPos();
				}
				else if(event.keyCode == event.DOM_VK_RIGHT && MozComics.lastScrollXPos === null) {
					MozComics.lastScrollXPos = MozComics._getCurrentScrollXPos();					
				}
				else if(event.keyCode == event.DOM_VK_RETURN || event.keyCode == event.DOM_VK_ENTER) {
					MozComics.Strips.repeatLastRequest();
				}
				else if(key == 'p') {
					MozComics.Strips.setToPreviousStrip();
				}
				else if(key == 'n') {
					MozComics.Strips.setToNextStrip();
				}
				else if(event.keyCode == event.DOM_VK_BACK_SPACE) {
					event.preventDefault();
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
					MozComics.Strips.deleteCache();
				}
				else if(key == 't') {
					var newValue = (parseInt(MozComics.Dom.bookmarkMenu.value) + 1) % MAX_BOOKMARK;
					MozComics.Dom.bookmarkMenu.value = newValue;
					MozComics.Strips.deleteCache();
				}
			}
		}
	}

	function handleKeyUp(event, from) {
		var currentScrollXPos = MozComics._getCurrentScrollXPos();
		var lastScrollXPos = MozComics.lastScrollXPos;
		MozComics.lastScrollXPos = null;
		if(event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
			return;
		}

		if(lastScrollXPos === null || currentScrollXPos != lastScrollXPos) {
			return;
		}

		if(!MozComics.Prefs.user.useArrowsToSwitchStrip) {
			return;
		}

		if(event.keyCode == event.DOM_VK_LEFT) {
			MozComics.Strips.setToPreviousStrip();
		}
		else if(event.keyCode == event.DOM_VK_RIGHT) {
			MozComics.Strips.setToNextStrip();
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

		MozComics.Prefs.recache();
	}

	function _getCurrentScrollXPos() {
		var x = {};
		MozComics.Dom.stripPane.getPosition(x, {});
		return x.value;
	}
}

MozComics.init();

