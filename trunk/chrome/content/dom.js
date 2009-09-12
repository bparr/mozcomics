/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Dom = new function() {
	this.init = init;
	this._getDomElement = _getDomElement;

	// cache Dom elements
	function init() {
		this._getDomElement("pane", "mozcomics-pane");
		this._getDomElement("paneSplitter", "mozcomics-splitter");
		this._getDomElement("statusbarImage", "mozcomics-statusbar-image");

		// cache comicPicker elements
		this._getDomElement("comicPickerPane", "mozcomics-comicpicker-pane");
		this._getDomElement("comicPickerToolbarIcon", "mozcomics-tb-comicpicker");
		this._getDomElement("comicPickerTree", "mozcomics-comicPicker");
		this._getDomElement("comicPickerContextMenu", "mozcomics-comicpicker-menu");
		this._getDomElement("comicPickerDateMenu", "mozcomics-comicpicker-datemenu");
		this._getDomElement("comicPickerDate", "mozcomics-comicpicker-date");
		this._getDomElement("showRead", "mozcomics-comicpicker-showread");

		// cache strip elements
		this._getDomElement("stripPane", "mozcomics-strip-pane");
		this._getDomElement("stripFound", "mozcomics-strip-found");
		this._getDomElement("stripNone", "mozcomics-strip-none");
		this._getDomElement("updateRead", "mozcomics-strip-updateread");
		this._getDomElement("comic", "mozcomics-strip-comic");
		this._getDomElement("title", "mozcomics-strip-title");
		this._getDomElement("image", "mozcomics-strip-image");
		this._getDomElement("imageTooltip", "mozcomics-strip-image-tooltip");

		// add event listeners
		this.comicPickerTree.addEventListener("click", function(e) { MozComics.ComicPicker.onClick(e); }, true);
		this.comicPickerToolbarIcon.setAttribute("expand", this.comicPickerPane.hidden);

		// add scroll methods to scrollboxes
		this.stripPane = this.stripPane.boxObject.QueryInterface(Components.interfaces.nsIScrollBoxObject);
	}

	function _getDomElement(varName, id) {
		this[varName] = document.getElementById(id);
		if(!this[varName]) {
			throw ("Could not find " + varName);
		}
	}
}

