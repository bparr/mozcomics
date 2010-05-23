/*
Copyright (c) 2009-2010 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Dom = new function() {
	this.init = init;
	this.unload = unload;
	this._getDomElement = _getDomElement;

	this._eventFunctions = {
		comicPicker: function(e) {
			MozComics.ComicPicker.onClick(e);
		},

		advancedDate: function(e) {
			MozComics.Strips.setByDatePicker();
		}
	};

	// initialize variables for stand-alone window mode
	var blankUrl = "about:blank";
	var tabAttribute = "MozComicsWindow";
	function setDocumentTitle() {
		document.title = "MozComics";
	}
	this._tabsProgressListener = {
		onLocationChange: function(browser, webProgress, request, uri) {
			if(uri.spec != blankUrl) {
				browser.stop();
			}
		},
		onStateChange: function(browser, webProgress, request, stateFlags, status) {
			var url = browser.currentURI.spec;

			if(url == blankUrl) {
				return;
			}

			if(stateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
				for(var i = 0, len = gBrowser.tabContainer.childNodes.length; i < len; i++) {
					var tab = gBrowser.tabContainer.childNodes[i];
					if(browser == gBrowser.getBrowserAtIndex(i)) {
						window.open(url);

						if(!tab.hasAttribute(tabAttribute)) {
							gBrowser.removeTab(tab);
						}
						else if(url != blankUrl) {
							browser.loadURI(blankUrl);
						}
						break;
					}
				}
			}
		},
		onProgressChange: function() {},
		onSecurityChange: function() {},
		onStatusChange: function() {},
		onRefreshAttempted: function() {}
	}

	// cache Dom elements
	function init() {
		this._getDomElement("content", "content");
		this._getDomElement("appcontent", "appcontent");
		this._getDomElement("statusBar", "status-bar");
		this._getDomElement("mainContextMenu", "contentAreaContextMenu");
		this._getDomElement("pane", "mozcomics-pane");
		this._getDomElement("paneSplitter", "mozcomics-splitter");
		this._getDomElement("statusBarPanel", "mozcomics-statusbarpanel");

		// cache navigation elements
		this._getDomElement("updateIcon", "mozcomics-tb-update");
		this._getDomElement("updateMessage", "mozcomics-update-message");
		this._getDomElement("updateFromFile", "mozcomics-tb-updateFromFile");
		this._getDomElement("loadingImage", "mozcomics-tb-loading-image");
		this._getDomElement("tbClose", "mozcomics-tb-close");

		// cache sidebar elements
		this._getDomElement("sidebar", "mozcomics-sidebar");
		this._getDomElement("sidebarSplitter", "mozcomics-sidebar-splitter");
		this._getDomElement("sidebarToolbarIcon", "mozcomics-tb-sidebar");

		// cache advanced elements
		this._getDomElement("advanced", "mozcomics-advanced");
		this._getDomElement("advancedToggle", "mozcomics-advanced-toggle");
		this._getDomElement("advancedDateMenu", "mozcomics-advanced-datemenu");
		this._getDomElement("advancedDate", "mozcomics-advanced-date");
		this._getDomElement("showRead", "mozcomics-advanced-showread");
		this._getDomElement("updateRead", "mozcomics-advanced-updateread");
		this._getDomElement("bookmarkMenu", "mozcomics-advanced-bookmark-menu");

		// cache comic picker elements
		this._getDomElement("enableAll", "mozcomics-comicpicker-enableAll");
		this._getDomElement("disableAll", "mozcomics-comicpicker-disableAll");
		this._getDomElement("comicPicker", "mozcomics-comicPicker");
		this._getDomElement("comicPickerContextMenu", "mozcomics-comicpicker-menu");

		// cache strip elements
		this._getDomElement("focusableStripPane", "mozcomics-strip-pane");
		this._getDomElement("stripFound", "mozcomics-strip-found");
		this._getDomElement("comic", "mozcomics-strip-comic");
		this._getDomElement("title", "mozcomics-strip-title");
		this._getDomElement("imageTooltip", "mozcomics-strip-image-tooltip");
		this._getDomElement("imageTooltipLabel", "mozcomics-strip-tooltip-label");
		this._getDomElement("stripNone", "mozcomics-strip-none");
		this._getDomElement("resetShowRead", "mozcomics-strip-resetShowRead");
		this._getDomElement("resetStripType", "mozcomics-strip-resetStripType");

		// initialize state of sidebar toolbar icon and splitter
		this.sidebarToolbarIcon.setAttribute("expand", this.sidebar.hidden);
		this.sidebarSplitter.hidden = this.sidebar.hidden;

		// initialize state of update icon
		this.updateIcon.setAttribute("failed", !MozComics.Update.lastUpdateSuccessful);

		// initialize state of advanced toggle
		this.advancedToggle.setAttribute("expand", this.advanced.hidden);

		// initialize disabled state of enableAll button
		this.enableAll.disabled = !MozComics.Prefs.user.multipleEnabledComics;

		// hide developer tools if not enabled
		this.updateFromFile.hidden = !MozComics.Prefs.user.enableDeveloperTools;

		// add event listeners
		this.comicPicker.addEventListener("click", this._eventFunctions.comicPicker, true);
		this.advancedDate.addEventListener("change", this._eventFunctions.advancedDate, false);

		// add scroll methods to scrollboxes
		this.stripPane = this.focusableStripPane.boxObject.QueryInterface(Components.interfaces.nsIScrollBoxObject);

		// set up browser to appear as a stand-alone window
		if(MozComics.isWindow) {
			gBrowser.tabContainer.childNodes[0].setAttribute(tabAttribute, true);
			setDocumentTitle();
			gBrowser.addTabsProgressListener(this._tabsProgressListener);
			this.content.addEventListener("TabClose", setDocumentTitle, false);
			this.appcontent.addEventListener("pageshow", setDocumentTitle, false);

			this.tbClose.hidden = true;
			this.paneSplitter.hidden = true;
			this.pane.hidden = false;
			this.pane.flex = '1';
			this.content.collapsed = true;
			this.statusBar.hidden = true;

			// collapse toolbars
			var toolbox = getNavToolbox();
			for(var i = 0, len = toolbox.childNodes.length; i < len; i++) {
				toolbox.childNodes[i].collapsed = true;
			}

			// make it so the user does not have to click the strip pane
			// every time a stand-alone window is created
			this.focusableStripPane.focus();
		}


		// determine initial value of hasBeenOpened by whether or not MozComics is showing
		MozComics.hasBeenOpened = !MozComics.Dom.pane.hidden;
	}

	function unload() {
		// remove event listeners
		this.comicPicker.removeEventListener("click", this._eventFunctions.comicPicker, true);
		this.advancedDate.removeEventListener("change", this._eventFunctions.advancedDate, false);

		if(MozComics.isWindow) {
			gBrowser.removeTabsProgressListener(this._tabsProgressListener);
			this.content.removeEventListener("TabClose", setDocumentTitle, false);
			this.appcontent.removeEventListener("pageshow", setDocumentTitle, false);
		}

		// force persist of values that would have been otherwise lost
		// see https://bugzilla.mozilla.org/show_bug.cgi?id=15232
		this.advanced.setAttribute('hidden', !!this.advanced.hidden);
		this.showRead.setAttribute('checked', !!this.showRead.checked);
		this.updateRead.setAttribute('checked', !!this.updateRead.checked);
	}

	function _getDomElement(varName, id) {
		this[varName] = document.getElementById(id);
		if(!this[varName]) {
			throw ("Could not find " + varName);
		}
	}
}

