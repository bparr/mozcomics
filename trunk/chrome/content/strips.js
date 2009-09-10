/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Strips = new function() {
	var self = this;

	Components.utils.import("resource://mozcomics/strips.js");

	this.init = init;
	this.refresh = refresh;
	this.firstRefresh = true;
	this.unload = unload;

	this.setToDefaultStrip = setToDefaultStrip;
	this.setToFirstStrip = setToFirstStrip;
	this.setToPreviousStrip = setToPreviousStrip;
	this.setToNextStrip = setToNextStrip;
	this.setToLastStrip = setToLastStrip;
	this.setToRandomStrip = setToRandomStrip;
	this.setToBackStrip = setToBackStrip;
	this.setToForwardStrip = setToForwardStrip;

	this._generateDefaultData = _generateDefaultData;
	this._preloadImage = _preloadImage;
	this._updatePane = _updatePane;
	this._unloadLastStrip = _unloadLastStrip;
	this._updateParamVariables = _updateParamVariables;
	this._updateDatePicker = _updateDatePicker;

	this.params = {
		limit: null,
		lastComic: null,
		lastStrip: null,
		lastRead: null,
		randomQueue: []
	}

	function init() {
		var preloadAmount = MozComics.Prefs.get("preloadAmount");
		this.params.limit = MozComics.Prefs.get("preloadImages") ? preloadAmount : 1;
	}

	function refresh() {
		if(self.firstRefresh) {
			self.firstRefresh = false;

			var lastViewed = MozComics.Prefs.get("lastViewed").split(",");
			if(MozComics.Prefs.get("loadLastViewedAtStart") && lastViewed.length == 2) {
				var data = _generateDefaultData();
				data.statementId = StripsResource.S.get;
				data.enabledComics = [{comic: lastViewed[0]}];
				data.params.strip = lastViewed[1];
				data.showRead = true;
				data.onComplete = function(row, statementId) {
					if(row) {
						self._updatePane(row);
					}
					else {
						self.refresh();
					}
				};

				StripsResource.findStrip(data);
				return;
			}
		}

		self.params.lastRead = StripsResource.INFINITE;
		self.params.randomQueue = [];

		if(MozComics.Dom.stripFound.hidden ||
			!self.params.lastComic ||
			!MozComics.Comics.getComic(self.params.lastComic) ||
			!MozComics.Comics.getComicProp(self.params.lastComic, "enabled")) {

			self.setToDefaultStrip();
		}
	}

	function unload() {
		if(this.params.lastComic && 
			this.params.lastStrip && 
			Math.abs(this.params.lastComic) < StripsResource.INFINITE &&
			Math.abs(this.params.lastStrip) < StripsResource.INFINITE) {

			MozComics.Prefs.set("lastViewed", 
				this.params.lastComic + "," + this.params.lastStrip
			);
		}
		else {
			MozComics.Prefs.set("lastViewed", "");
		}
	}

	function setToDefaultStrip() {
		switch(MozComics.Prefs.get("defaultStrip")) {
			case 0:
				this.setToFirstStrip();
				break;

			case 1:
				this.setToLastStrip();
				break;

			default:
				this.setToLastStrip();
				break;
		}
	}

	function setToFirstStrip() {
		var data = _generateDefaultData();
		data.statementId = StripsResource.S.first;
		StripsResource.findStrip(data);
	}

	function setToPreviousStrip() {
		if(this.params.lastComic && this.params.lastStrip) {
			var data = _generateDefaultData();
			data.statementId = StripsResource.S.previous;

			if(MozComics.Prefs.get("wrapAround")) {
				data.onFailStatementId = StripsResource.S.last;
			}

			StripsResource.findStrip(data);
		}
		else {
			this._updatePane(false, StripsResource.S.previous);
		}
	}

	function setToNextStrip() {
		if(this.params.lastComic && this.params.lastStrip) {
			var data = _generateDefaultData();
			data.statementId = StripsResource.S.next;

			if(MozComics.Prefs.get("wrapAround")) {
				data.onFailStatementId = StripsResource.S.first;
			}

			StripsResource.findStrip(data);
		}
		else {
			this._updatePane(false, StripsResource.S.previous);
		}
	}

	function setToLastStrip() {
		var data = _generateDefaultData();
		data.statementId = StripsResource.S.last;
		StripsResource.findStrip(data);
	}


	function setToRandomStrip() {
		var data = _generateDefaultData();
		data.statementId = StripsResource.S.random;

		if(data.params.randomQueue.length > 0) {
			this._updatePane(data.params.randomQueue.shift());
			if(data.params.randomQueue.length == 0) {
				data.onComplete = function(row, statementId) {
					data.params.randomQueue.unshift(row);
				};
				StripsResource.findStrip(data);
			}
		}
		else {
			StripsResource.findStrip(data);
		}
	}


	function setToBackStrip() {
		var data = _generateDefaultData();
		data.statementId = StripsResource.S.back;
		data.showRead = true;

		data.onComplete = function(row, statementId) {
			self._updatePane(row, statementId);
			MozComics.Dom.updateRead.checked = false;
		};

		StripsResource.findStrip(data);
	}

	function setToForwardStrip() {
		var data = _generateDefaultData();
		data.statementId = StripsResource.S.forward;
		data.showRead = true;

		data.onComplete = function(row, statementId) {
			self._updatePane(row, statementId);
			MozComics.Dom.updateRead.checked = false;
		};

		StripsResource.findStrip(data);
	}

	function _generateDefaultData() {
		return {
			statementId: null,
			onFailStatementId: null,
			params: self.params,
			preloadImage: self._preloadImage,
			onComplete: self._updatePane,
			enabledComics: MozComics.Comics.enabled,
			showRead: MozComics.Dom.showRead.checked
		};
	}

	function _preloadImage(src) {
		var img = new Image();
		img.src = src;
	}

	function _updatePane(row, statementId) {
		self._unloadLastStrip();
		self._updateParamVariables(row, statementId);
		self._updateDatePicker(row);

		MozComics.Dom.stripFound.hidden = !row;
		MozComics.Dom.stripNone.hidden = !!row;
		if(row) {
			var comic = MozComics.Comics.getComic(row.comic);
			MozComics.Dom.comic.value = comic.name;
			MozComics.Dom.comic.href = comic.url;
			MozComics.Dom.title.value = row.title;
			MozComics.Dom.title.href = row.url;
			MozComics.Dom.image.hidden = false;
			MozComics.Dom.image.src = row.image;

			var mouseover = null;
			try {
				var extra = JSON.parse(row.extra);
				mouseover = MozComics.Utils.unescapeHtml(extra.mouseover);
			}
			catch(e) {}

			MozComics.Dom.imageTooltip.label = mouseover ? mouseover : "";
			MozComics.Dom.imageTooltip.hidden = !mouseover;

			if(MozComics.Prefs.get("defaultToMarkRead")) {
				MozComics.Dom.updateRead.checked = true;
			}
		}
			
		if(!MozComics.Dom.pane.hidden) {
			MozComics.Dom.scrollbox.scrollTo(0,0);
		}
	}

	function _unloadLastStrip() {
		if(this.params.lastComic && this.params.lastStrip && MozComics.Dom.updateRead.checked) {
			var d = new Date();
			StripsResource.updateReadTime(
				this.params.lastComic, this.params.lastStrip, d.getTime()
			);
		}
	}

	function _updateParamVariables(row, statementId) {
		var S = StripsResource.S;
		if(row) {
			this.params.lastComic = row.comic;
			this.params.lastStrip = row.strip;

			switch(statementId) {
				case S.back:
				case S.forward:
					this.params.lastRead = row.read;
					break;
				default: // some other navigation
					this.params.lastRead = StripsResource.INFINITE;
			}
		}
		else {
			switch(statementId) {
				case S.previous:
					this.params.lastComic = -1 * StripsResource.INFINITE;
					this.params.lastStrip = -1 * StripsResource.INFINITE;
					break;
				case S.next:
					this.params.lastComic = StripsResource.INFINITE;
					this.params.lastStrip = StripsResource.INFINITE;
					break;
				default: // some other navigation
					this.params.lastComic = null;
					this.params.lastStrip = null;
			}


			switch(statementId) {
				case S.back:
					this.params.lastRead = -1 * StripsResource.INFINITE;
					break;
				case S.forward:
				default: // some other navigation
					this.params.lastRead = StripsResource.INFINITE;
			}
		}
	}

	function _updateDatePicker(row) {
		var dateType = MozComics.Dom.comicPickerDateMenu.value;
		var datepicker = MozComics.Dom.comicPickerDate;
		var d = new Date();

		if(row) {
			switch(dateType) {
				case "pubDate":
					d.setTime(row.strip * 1000);
					break;
				case "readDate":
					d.setTime((row.read) ? row.read : 0);
					break;
			}
		}

		datepicker.dateValue = d;
	}
}

