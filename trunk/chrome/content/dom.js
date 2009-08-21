/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/


// TODO make less crudy
MozComics.Dom = new function() {
	this.init = init;
	this._getDomElement = _getDomElement;

	this.appcontent = null;
	this.tabbrowser = null;
	this.statusbarImage = null,
	this.pane = null,
	this.paneSplitter = null;

	this.comicPickerPane = null;
	this.comicPicker = null;
	this.comicPickerToolbarIcon = null;
	this.showRead = null;
	this.comicPickerDateMenu = null;
	this.comicPickerDate = null;

	this.stripPane = null;
	this.stripFound = null;
	this.stripNone = null;
	this.updateRead = null;
	this.comic = null;
	this.title = null;
	this.image = null;
	this.imageTooltip = null;


	this.scrollbox = null;

	function init() {
		// cache Dom elements
		this._getDomElement("appcontent", "appcontent");
		this._getDomElement("tabbrowser", "content");
		this._getDomElement("statusbarImage", "mozcomics-statusbar-image");
		this._getDomElement("pane", "mozcomics-pane");
		this._getDomElement("paneSplitter", "mozcomics-splitter");

		this._getDomElement("comicPickerPane", "mozcomics-comicpicker-pane");
		this._getDomElement("comicPicker", "mozcomics-comicPicker");
		this._getDomElement("comicPickerToolbarIcon", "mozcomics-tb-comicpicker");
		this._getDomElement("comicPicerMenu", "mozcomics-comicpicker-menu");
		this._getDomElement("showRead", "mozcomics-comicpicker-showread");
		this._getDomElement("comicPickerDateMenu", "mozcomics-comicpicker-datemenu");
		this._getDomElement("comicPickerDate", "mozcomics-comicpicker-date");

		this._getDomElement("stripPane", "mozcomics-strip-pane");
		this._getDomElement("stripFound", "mozcomics-strip-found");
		this._getDomElement("stripNone", "mozcomics-strip-none");

		this._getDomElement("updateRead", "mozcomics-strip-updateread");
		this._getDomElement("comic", "mozcomics-strip-comic");
		this._getDomElement("title", "mozcomics-strip-title");
		this._getDomElement("image", "mozcomics-strip-image");
		this._getDomElement("imageTooltip", "mozcomics-strip-image-tooltip");

		// add event listeners
		this.tabbrowser.addEventListener("TabSelect", function(e) {MozComics.onPageChange(e);}, false);
		this.appcontent.addEventListener("pageshow", function(e) {MozComics.onPageChange(e); }, true);
		this.appcontent.addEventListener("pagehide", function(e) {MozComics.onPageChange(e); }, true);
		this.comicPicker.addEventListener("click", function(e) { MozComics.ComicPicker.onClick(e); }, true);

		this.comicPickerToolbarIcon.setAttribute("expand", this.comicPickerPane.hidden);

		// add scroll methods to scrollboxes
		this.scrollbox = this.stripPane.boxObject.QueryInterface(Components.interfaces.nsIScrollBoxObject);
	}

	function _getDomElement(varName, id) {
		this[varName] = document.getElementById(id);
		if(!this[varName]) {
			throw ("Could not find " + varName);
		}
	}
}
