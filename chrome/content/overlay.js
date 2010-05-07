/*
Copyright (c) 2009-2010 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var MozComics = new function() {

	this.init = init;

	this.isWindow = null;
	this.hasBeenOpened = false;

	this.onChromeLoad = onChromeLoad;
	this.onUnload = onUnload;
	this.handleLinkClick = handleLinkClick;
	this.showWebpage = showWebpage;
	this.openWindow = openWindow;
	this._openMozComicsWindow = _openMozComicsWindow;
	this.togglePane = togglePane;
	this.toggleSidebar = toggleSidebar;
	this.toggleAdvanced = toggleAdvanced;
	this.focusStripPane = focusStripPane;
	this.handleKeyDown = handleKeyDown;
	this.handleKeyUp = handleKeyUp;
	this.buildComicsContextMenu = buildComicsContextMenu;
	this.buildStripContextMenu = buildStripContextMenu;
	this.buildUpdateTooltip = buildUpdateTooltip;
	this.showPreferences = showPreferences;
	this._getCurrentScrollXPos = _getCurrentScrollXPos;

	this.lastScrollXPos = null;

	this.zoomAmount = .25;

	var MAX_BOOKMARK = 2;

	// used for Callback so the resource module can notify this instance of
	// MozComics of certain changes
	this.callbackId = null;
	this.callbackFunctions = {
		stripRead: function() {
			MozComics.Comics.updateStatusBarPanel();
			MozComics.ComicPicker.treeview.update();
		},

		comicsChanged: function() {
			MozComics.Comics.updateStatusBarPanel();
			MozComics.Comics.refreshCache(true);
		},

		prefsChanged: function() {
			MozComics.Dom.enableAll.disabled = !MozComics.Prefs.user.multipleEnabledComics;
			MozComics.Comics.updateStatusBarPanel();
		},

		updateComplete: function() {
			MozComics.Dom.updateIcon.setAttribute("failed", !MozComics.Update.lastUpdateSuccessful);
		}
	}

	function init() {
		// load code from resource module
		Components.utils.import("resource://mozcomics/utils.js"); this.Utils = Utils;
		Components.utils.import("resource://mozcomics/prefs.js"); this.Prefs = Prefs;
		Components.utils.import("resource://mozcomics/update.js"); this.Update = Update;
		Components.utils.import("resource://mozcomics/callback.js"); this.Callback = Callback;

		// load chrome javascript files
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
		MozComics.ComicPicker.init();
		MozComics.Comics.init();

		// add this instance of MozComics to Callback
		MozComics.callbackId = MozComics.Callback.add(MozComics.callbackFunctions);

		// if this is the first time MozComics is run (just installed)
		// then show the FIRST_RUN url
		if(MozComics.Prefs.user.firstRun) {
			MozComics.Prefs.set('firstRun', false);
			window.setTimeout(function() {
				MozComics.showWebpage(MozComics.Utils.URLS.FIRST_RUN);
			}, 100);
		}

		// make it so the user does not have to click the strip pane
		// every time a stand-alone window is created
		if(MozComics.isWindow) {
			MozComics.focusStripPane();
		}
	}

	function onUnload() {
		window.removeEventListener("unload", MozComics.onUnload, false);

		MozComics.Strips.unload();
		MozComics.Comics.unload();
		MozComics.Dom.unload();

		// remove this instance of MozComics from Callback
		MozComics.Callback.remove(MozComics.callbackId);
	}

	function handleLinkClick(e) {
		if(e.button == 0) {
			showWebpage(e.currentTarget.href, e.shiftKey);
			return false;
		}
		return true;
	}

	function showWebpage(url, forceNewWindow) {
		if(forceNewWindow || MozComics.isWindow) {
			window.open(url);
		}
		else {
			gBrowser.selectedTab = gBrowser.addTab(url);
		}
	}

	/*
	 * Open a new MozComics in a stand-alone window, and hide this one
	 * if it is a browser overlay.
	 */
	function openWindow() {
		this.togglePane();
		this._openMozComicsWindow();
	}

	function _openMozComicsWindow() {
		window.open('chrome://mozcomics/content/window.xul',
			'_blank', 'chrome,resizable=yes'
		);
	}

	/*
	 * If this is a browser overlay, toggle hidden state of MozComics.
	 */
	function togglePane() {
		// do nothing if this MozComics is a stand-alone window
		if(this.isWindow) {
			return;
		}

		var nowHidden = !MozComics.Dom.pane.hidden;
		if(!nowHidden && MozComics.Prefs.user.alwaysOpenInNewWindow) {
			// skip overlay view and directly open a new stand-alone window
			this._openMozComicsWindow();
		}
		else {
			MozComics.Dom.pane.hidden = nowHidden;
			MozComics.Dom.paneSplitter.hidden = nowHidden;
			(nowHidden) ? MozComics.Dom.focusableStripPane.blur() : MozComics.focusStripPane();

			// if this is the first time MozComics has been opened,
			// make first/original strip request so the strip pane doesn't
			// show up empty even if there is a strip that should be shown
			if(!this.hasBeenOpened) {
				this.hasBeenOpened = true;
				MozComics.Strips.refresh();
			}

			// save comic states to database on hide of MozComics
			if(nowHidden) {
				MozComics.Comics.saveStatesToDB();
			}
		}
	}

	/*
	 * Toggle hidden state of the sidebar, and update the Toggle Sidebar
	 * toolbar button whose icon depends on the hidden state of the sidebar.
	 */
	function toggleSidebar() {
		var nowHidden = !MozComics.Dom.sidebar.hidden;
		MozComics.Dom.sidebar.hidden = nowHidden;
		MozComics.Dom.sidebarToolbarIcon.setAttribute("expand", nowHidden);
		MozComics.Dom.sidebarSplitter.hidden = nowHidden;
	}

	/*
	 * Toggle hidden state of the advanced pane (located within the sidebar).
	 */
	function toggleAdvanced() {
		var nowHidden = !MozComics.Dom.advanced.hidden;
		MozComics.Dom.advanced.hidden = nowHidden;
		MozComics.Dom.advancedToggle.setAttribute("expand", nowHidden);
	}

	/*
	 * Give focus to strip pane so keyboard shortcuts, such as arrow keys, work.
	 */
	function focusStripPane() {
		MozComics.Dom.focusableStripPane.focus();
	}

	/*
	 * Handle key downs from the strip pane.
	 */
	function handleKeyDown(event) {
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
					MozComics.toggleSidebar();
				}
				else if(event.keyCode == event.DOM_VK_LEFT && MozComics.lastScrollXPos === null) {
					// Set lastScrollXPos so handleKeyDown can determine whether
					// to request the Previous strip. The strip pane will still
					// scroll horizantally left because not using preventDefault.
					MozComics.lastScrollXPos = MozComics._getCurrentScrollXPos();
				}
				else if(event.keyCode == event.DOM_VK_RIGHT && MozComics.lastScrollXPos === null) {
					// Set lastScrollXPos so handleKeyDown can determine whether
					// to request the Next strip. The strip pane will still
					// scroll horizantally right because not using preventDefault.
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
					// go to next possible value of bookmarkMenu
					var newValue = (parseInt(MozComics.Dom.bookmarkMenu.value) + 1) % MAX_BOOKMARK;
					MozComics.Dom.bookmarkMenu.value = newValue;
					MozComics.Strips.deleteCache();
				}
			}
		}
	}

	/*
	 * Handle function overloading of arrow keys.
	 * If the pressed key was either the left or right arrow key, and the
	 * strip pane did not scroll horizantally (i.e. was at the edge),
	 * then navaigate to the appropriate strip.
	 */
	function handleKeyUp(event) {
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

	/*
	 * Only display the comics context menu if the user clicked a row in the
	 * comic picker, and a comic is selected.
	 */
	function buildComicsContextMenu(e) {
		var menu = MozComics.Dom.comicPickerContextMenu;
		var rowClicked = MozComics.ComicPicker.rowClicked(e);
		var selectedComic = MozComics.ComicPicker.selectedComic;
		if(!(rowClicked && selectedComic)) {
			// don't show context menu
			e.preventDefault();
		}
	}

	function buildStripContextMenu(e) {
		if(!MozComics.isWindow) {
			var node = document.popupNode;
			var newNode;
			if(node.localName == "image") {
				newNode = gBrowser.contentDocument.createElement("img");
				newNode.src = node.src;
				if(MozComics.Dom.imageTooltip.label) {
					newNode.alt = MozComics.Dom.imageTooltip.label;
				}
			}
			else if(node.localName == "label") {
				newNode = gBrowser.contentDocument.createElement("a");
				if(node.href) {
					newNode.href = node.href;
				}
				newNode.textContent = node.value;
			}
			else {
				newNode = node;
			}

			document.popupNode = newNode;
			MozComics.Dom.mainContextMenu.openPopupAtScreen(e.screenX, e.screenY, true);
		}

		e.preventDefault();
		e.stopPropagation();
		return false;
	}

	/*
	 * Set update message in the update tooltip
	 */
	function buildUpdateTooltip() {
		if(MozComics.Update.lastUpdateSuccessful) {
			// show the relative date since the last successful update.
			var relativeDate = MozComics.Utils.relativeDate(MozComics.Prefs.user.lastSuccessfulUpdate);
			var lastSuccess = MozComics.Utils.getString("update.lastSuccess", relativeDate);
			MozComics.Dom.updateMessage.value = lastSuccess;
		}
		else {
			// show error message
			MozComics.Dom.updateMessage.value = MozComics.Update.failureMessage;
		}
	}

	/*
	 * Show the preferences dialog. Recache preferences once dialog is closed.
	 */
	function showPreferences() {
		window.openDialog('chrome://mozcomics/content/preferences.xul',
			'mozcomics-preferences', 'chrome,modal=yes'
		);

		MozComics.Prefs.recache();
	}

	/*
	 * Return the x scroll coordinate of the strip pane.
	 */
	function _getCurrentScrollXPos() {
		var x = {};
		MozComics.Dom.stripPane.getPosition(x, {});
		return x.value;
	}
}

MozComics.init();

