/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Strips = new function() {
	var self = this;

	Components.utils.import("resource://mozcomics/strips.js");
	var S = StripsResource.S;
	var INFINITE = StripsResource.INFINITE;

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
		lastComic: null,
		lastStrip: null,
		lastRead: null,
		stripQueue: []
	}

	this.lastShowRead = null;
	this.lastBookmarkType = null;

	this.lastStripRequest = null;

	function init() {
		this.lastShowRead = MozComics.Dom.showRead.checked;
		this.lastBookmarkType = MozComics.Dom.bookmarkMenu.value;
	}

	function refresh() {
		if(self.firstRefresh) {
			self.firstRefresh = false;

			// attempt to load last viewed strip stored in preference
			var lastViewed = MozComics.Prefs.get("lastViewed").split(",");
			if(MozComics.Prefs.get("loadLastViewedAtStart") && lastViewed.length == 2) {
				var data = _generateDefaultData(S.get);
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

		self.params.lastRead = INFINITE;
		self.params.stripQueue = [];

		// change strip to default if no strip showing, or the one that is
		// showing is from a comic that is no longer enabled
		if(MozComics.Dom.stripFound.hidden ||
			!self.params.lastComic ||
			!MozComics.Comics.getComic(self.params.lastComic) ||
			!MozComics.Comics.getComicProp(self.params.lastComic, "enabled")) {

			self.setToDefaultStrip();
		}
	}

	function unload() {
		// save currently viewed strip to preference
		if(this.params.lastComic && 
			this.params.lastStrip && 
			Math.abs(this.params.lastComic) < INFINITE &&
			Math.abs(this.params.lastStrip) < INFINITE) {

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

			case 2:
				this.setToRandomStrip();
				break;

			default:
				this.setToLastStrip();
				break;
		}
	}

	function setToFirstStrip() {
		var data = _generateDefaultData(S.first);
		_findStrip(data);
	}

	function setToPreviousStrip() {
		if(this.params.lastComic && this.params.lastStrip) {
			var data = _generateDefaultData(S.previous);

			if(MozComics.Prefs.get("wrapAround")) {
				data.onFailStatementId = S.last;
			}

			_findStrip(data);
		}
		else {
			this._updatePane(false, S.previous);
		}
	}

	function setToNextStrip() {
		if(this.params.lastComic && this.params.lastStrip) {
			var data = _generateDefaultData(S.next);

			if(MozComics.Prefs.get("wrapAround")) {
				data.onFailStatementId = S.first;
			}

			_findStrip(data);
		}
		else {
			this._updatePane(false, S.previous);
		}
	}

	function setToLastStrip() {
		var data = _generateDefaultData(S.last);
		_findStrip(data);
	}


	function setToRandomStrip() {
		var data = _generateDefaultData(S.random);
		_findStrip(data);
	}


	function setToBackStrip() {
		var data = _generateDefaultData(S.back);
		data.showRead = true;
		_findStrip(data);
	}

	function setToForwardStrip() {
		var data = _generateDefaultData(S.forward);
		data.showRead = true;
		_findStrip(data);
	}

	function _findStrip(data) {
		self._unloadLastStrip();

		var statementId = data.statementId;
		if(statementId == S.first ||
			statementId == S.last ||
			statementId != self.lastStripRequest ||
			MozComics.Dom.showRead.checked != self.lastShowRead ||
			MozComics.Dom.bookmarkMenu.value != self.lastBookmarkType) {

			data.params.stripQueue = [];
			self.lastStripRequest = statementId;
			self.lastShowRead = MozComics.Dom.showRead.checked;
			self.lastBookmarkType = MozComics.Dom.bookmarkMenu.value;
		}


		if(data.params.stripQueue.length > 0) {
			self._updatePane(data.params.stripQueue.shift(), statementId);
			if(data.params.stripQueue.length == 0) {
				data.onComplete = function(row, statementId) {
					if(row) {
						data.params.stripQueue.unshift(row);
					}
				};
				StripsResource.findStrip(data);
			}
		}
		else {
			StripsResource.findStrip(data);
		}
	}

	function _generateDefaultData(statementId) {
		statementId = (statementId != undefined) ? statementId : null;
		return {
			statementId: statementId,
			onFailStatementId: null,
			params: self.params,
			preloadImage: self._preloadImage,
			onComplete: self._updatePane,
			enabledComics: MozComics.Comics.enabled,
			showRead: MozComics.Dom.showRead.checked,
			bookmark: MozComics.Dom.bookmarkMenu.value
		};
	}

	function _preloadImage(src) {
		var img = new Image();
		img.src = src;
	}

	function _updatePane(row, statementId) {
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
			MozComics.Dom.image.src = row.image;
			MozComics.Dom.image.hidden = false;

			var extra = {};
			try {
				extra = JSON.parse(row.extra);
			}
			catch(e) {}

			// handle mouseover extra property
			MozComics.Dom.imageTooltip.hidden = !extra.imageTooltip;
			MozComics.Dom.imageTooltip.label = "";
			if(extra.mouseover) {
				var mouseover = MozComics.Utils.unescapeHtml(extra.mouseover);
				MozComics.Dom.imageTooltip.label = mouseover;
			}

			// handle hiddenImage extra propery
			MozComics.Dom.hiddenImage.hidden = !extra.hiddenImage;
			MozComics.Dom.hiddenImage.src = "";
			if(extra.hiddenImage) {
				MozComics.Dom.hiddenImage.src = extra.hiddenImage;
			}


			if(MozComics.Prefs.get("showMouseoverBelowImage")) {
				MozComics.Dom.imageTooltipLabel.value = mouseover ? mouseover : "";
				MozComics.Dom.imageTooltipLabel.hidden = !mouseover;
			}
			else {
				MozComics.Dom.imageTooltipLabel.value = "";
				MozComics.Dom.imageTooltipLabel.hidden = true;
			}

			if(MozComics.Prefs.get("defaultToMarkRead")) {
				MozComics.Dom.updateRead.checked = true;
			}

			if(statementId == S.back || statementId == S.forward) {
				MozComics.Dom.updateRead.checked = false;
			}
		}

		if(!MozComics.Dom.pane.hidden) {
			MozComics.Dom.stripPane.scrollTo(0,0);
		}
	}

	// update show read if the updateRead checkbox was checked
	function _unloadLastStrip() {
		if(this.params.lastComic && this.params.lastStrip && MozComics.Dom.updateRead.checked) {
			var d = new Date();
			StripsResource.updateReadTime(
				this.params.lastComic, this.params.lastStrip, d.getTime()
			);
		}
	}

	function _updateParamVariables(row, statementId) {
		if(row) {
			this.params.lastComic = row.comic;
			this.params.lastStrip = row.strip;

			switch(statementId) {
				case S.back:
				case S.forward:
					this.params.lastRead = row.read;
					break;
				default: // some other navigation
					this.params.lastRead = INFINITE;
			}
		}
		else {
			switch(statementId) {
				case S.previous:
					this.params.lastComic = -1 * INFINITE;
					this.params.lastStrip = -1 * INFINITE;
					break;
				case S.next:
					this.params.lastComic = INFINITE;
					this.params.lastStrip = INFINITE;
					break;
				default: // some other navigation
					this.params.lastComic = null;
					this.params.lastStrip = null;
			}


			switch(statementId) {
				case S.back:
					this.params.lastRead = -1 * INFINITE;
					break;
				case S.forward:
				default: // some other navigation
					this.params.lastRead = INFINITE;
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

