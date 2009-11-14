/*
Copyright (c) 2009 Ben Parr
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
		},

		image: function(e) {
			MozComics.Dom.loadingImage.style.visibility = 'hidden';

			MozComics.Dom.stripFound.style.width = 'auto';
			var width = MozComics.Dom.image.clientWidth;
			MozComics.Dom.stripFound.style.width = width + 'px';
		}
	};

	// cache Dom elements
	function init() {
		this._getDomElement("pane", "mozcomics-pane");
		this._getDomElement("paneSplitter", "mozcomics-splitter", true);
		this._getDomElement("statusBarPanel", "mozcomics-statusbarpanel", true);

		// cache navigation elements
		this._getDomElement("lastSuccessfulUpdate", "mozcomics-update-last-successful");
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
		this._getDomElement("stripNone", "mozcomics-strip-none");
		this._getDomElement("comic", "mozcomics-strip-comic");
		this._getDomElement("title", "mozcomics-strip-title");
		this._getDomElement("image", "mozcomics-strip-image");
		this._getDomElement("imageTooltip", "mozcomics-strip-image-tooltip");
		this._getDomElement("imageTooltipLabel", "mozcomics-strip-tooltip-label");
		this._getDomElement("hiddenImage", "mozcomics-strip-hiddenImage");

		// determine if this instance is a stand-alone window, or a browser overlay
		MozComics.isWindow = !this.paneSplitter;

		// determine initial value of hasBeenOpened by whether or not MozComics is showing
		MozComics.hasBeenOpened = !MozComics.Dom.pane.hidden;

		// close toolbar button only relevant when this instance is a browser overlay
		this.tbClose.hidden = MozComics.isWindow;

		// initialize state of sidebar toolbar icon and splitter
		this.sidebarToolbarIcon.setAttribute("expand", this.sidebar.hidden);
		this.sidebarSplitter.hidden = this.sidebar.hidden;

		// initialize state of advanced toggle
		this.advancedToggle.setAttribute("expand", this.advanced.hidden);

		// initialize disabled state of enableAll button
		this.enableAll.disabled = !MozComics.Prefs.user.multipleEnabledComics;

		// add event listeners
		this.comicPicker.addEventListener("click", this._eventFunctions.comicPicker, true);
		this.advancedDate.addEventListener("change", this._eventFunctions.advancedDate, false);
		this.image.addEventListener("load", this._eventFunctions.image, false);

		// add scroll methods to scrollboxes
		this.stripPane = this.focusableStripPane.boxObject.QueryInterface(Components.interfaces.nsIScrollBoxObject);
	}

	function unload() {
		// remove event listeners
		this.comicPicker.removeEventListener("click", this._eventFunctions.comicPicker, true);
		this.advancedDate.removeEventListener("change", this._eventFunctions.advancedDate, false);
		this.image.removeEventListener("load", this._eventFunctions.image, false);

		// force persist of values that would have been otherwise lost
		// see https://bugzilla.mozilla.org/show_bug.cgi?id=15232
		this.advanced.setAttribute('hidden', !!this.advanced.hidden);
		this.showRead.setAttribute('checked', !!this.showRead.checked);
		this.updateRead.setAttribute('checked', !!this.updateRead.checked);
	}

	function _getDomElement(varName, id, skipThrow) {
		this[varName] = document.getElementById(id);
		if(!this[varName] && !skipThrow) {
			throw ("Could not find " + varName);
		}
	}
}

