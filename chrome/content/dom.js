/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/


// TODO make less crudy
MozComics.Dom = new function() {
	var self = this;

	this.init = init;

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
		_getDomElement("appcontent", "appcontent");
		_getDomElement("tabbrowser", "content");
		_getDomElement("statusbarImage", "mozcomics-statusbar-image");
		_getDomElement("pane", "mozcomics-pane");
		_getDomElement("paneSplitter", "mozcomics-splitter");

		_getDomElement("comicPickerPane", "mozcomics-comicpicker-pane");
		_getDomElement("comicPicker", "mozcomics-comicPicker");
		_getDomElement("comicPickerToolbarIcon", "mozcomics-tb-comicpicker");
		_getDomElement("comicPicerMenu", "mozcomics-comicpicker-menu");
		_getDomElement("showRead", "mozcomics-comicpicker-showread");
		_getDomElement("comicPickerDateMenu", "mozcomics-comicpicker-datemenu");
		_getDomElement("comicPickerDate", "mozcomics-comicpicker-date");

		_getDomElement("stripPane", "mozcomics-strip-pane");
		_getDomElement("stripFound", "mozcomics-strip-found");
		_getDomElement("stripNone", "mozcomics-strip-none");

		_getDomElement("updateRead", "mozcomics-strip-updateread");
		_getDomElement("comic", "mozcomics-strip-comic");
		_getDomElement("title", "mozcomics-strip-title");
		_getDomElement("image", "mozcomics-strip-image");
		_getDomElement("imageTooltip", "mozcomics-strip-image-tooltip");

		// add event listeners
		self.tabbrowser.addEventListener("TabSelect", function(e) {MozComics.onPageChange(e);}, false);
		self.appcontent.addEventListener("pageshow", function(e) {MozComics.onPageChange(e); }, true);
		self.appcontent.addEventListener("pagehide", function(e) {MozComics.onPageChange(e); }, true);
		self.comicPicker.addEventListener("click", function(e) { MozComics.ComicPicker.onClick(e); }, true);

		this.comicPickerToolbarIcon.setAttribute("expand", this.comicPickerPane.hidden);

		// add scroll methods to scrollboxes
		this.scrollbox = this.stripPane.boxObject.QueryInterface(Components.interfaces.nsIScrollBoxObject);
	}

	function _getDomElement(varName, id) {
		self[varName] = document.getElementById(id);
		if(!self[varName]) {
			throw ("Could not find " + varName);
		}
	}
}
