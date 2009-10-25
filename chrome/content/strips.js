/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Strips = new function() {
	var self = this;

	Components.utils.import("resource://mozcomics/strips.js");
	var S = StripsResource.S;
	var INFINITY = StripsResource.INFINITY;

	this.init = init;
	this._firstRefresh = true;
	this.refresh = refresh;
	this.firstRefresh = true;
	this.unload = unload;

	this.lastStripRequest = null;

	this.deleteCache = deleteCache;
	this.setToDefaultStrip = setToDefaultStrip;
	this.repeatLastRequest = repeatLastRequest;
	this._setStrip = _setStrip;
	this.setToFirstStrip = function() { this._setStrip(S.first); };
	this.setToPreviousStrip = function() { this._setStrip(S.previous); };
	this.setToNextStrip = function() { this._setStrip(S.next); };
	this.setToLastStrip = function() { this._setStrip(S.last); };
	this.setToRandomStrip = function() { this._setStrip(S.random); };
	this.setToBackStrip = function() { this._setStrip(S.back); };
	this.setToForwardStrip = function() { this._setStrip(S.forward); };
	this.setToLastReadStrip = function() { this._setStrip(S.lastRead); };
	this.setByDatePicker = setByDatePicker;

	this._preloadImage = _preloadImage;
	this._updatePane = _updatePane;
	this._unloadCurrentStrip = _unloadCurrentStrip;
	this._updateParamVariables = _updateParamVariables;

	this.datePickerDates = null;
	this._updateDatePickerDates = _updateDatePickerDates;
	this.updateDatePicker = updateDatePicker;

	this.params = {
		lastComic: null,
		lastStrip: null,
		lastUrl: null,
		lastRead: INFINITY,
		stripQueue: []
	}

	function init() {
	}

	function refresh() {
		self.params.lastRead = INFINITY;
		self.params.stripQueue = [];

		// change strip to default if no strip showing, or the one that is
		// showing is from a comic that is no longer enabled
		if(MozComics.Dom.stripFound.hidden ||
			self.params.lastComic == null ||
			!MozComics.Comics.getComic(self.params.lastComic) ||
			!MozComics.Comics.getComicProp(self.params.lastComic, "enabled")) {

			if(self._firstRefresh && MozComics.isWindow && !MozComics.Prefs.user.alwaysOpenInNewWindow) {
				self.setToLastReadStrip();
			}
			else {
				self.setToDefaultStrip();
			}
		}

		self._firstRefresh = false;
	}

	function unload() {
		this._unloadCurrentStrip();
	}

	function deleteCache() {
		this.params.stripQueue = [];
	}

	function setToDefaultStrip() {
		switch(MozComics.Prefs.user.defaultStrip) {
			case 0:
				this.setToLastReadStrip();
				break;

			case 1:
				this.setToFirstStrip();
				break;

			case 2:
				this.setToLastStrip();
				break;

			case 3:
				this.setToRandomStrip();
				break;

			default:
				this.setToLastReadStrip();
				break;
		}
	}

	function repeatLastRequest() {
		if(this.lastStripRequest != null) {
			this._setStrip(this.lastStripRequest);
		}
	}

	function _setStrip(statementId) {
		MozComics.Dom.loadingImage.style.visibility = 'visible';

		var currentReadTime = this._unloadCurrentStrip();
		if(statementId == S.back && currentReadTime && currentReadTime < this.params.lastRead) {
			this.params.lastRead = currentReadTime;
		}

		if(statementId != this.lastStripRequest) {
			this.deleteCache();
			this.lastStripRequest = statementId;
		}

		// lastComic and lastStrip need to be numbers for previous and next search
		if(this.params.lastComic == null || this.params.lastStrip == null) {
			if(statementId == S.previous || statementId == S.next) {
				this._updatePane(false, statementId);
				return;
			}
		}

		// generate data from StripsResource.findStrip
		var data =  {
			statementId: statementId,
			onFailStatementId: null,
			params: this.params,
			onComplete: this._updatePane,
			enabledComics: MozComics.Comics.enabled,
			showRead: MozComics.Dom.showRead.checked,
			bookmark: MozComics.Dom.bookmarkMenu.value
		};

		if(statementId == S.back || statementId == S.forward || statementId == S.lastRead) {
			data.showRead = true;
		}

		if(statementId == S.lastRead) {
			data.onFailStatementId = S.first;
		}
		else if(MozComics.Prefs.user.wrapAround) {
			if(statementId == S.previous) {
				data.onFailStatementId = S.last;
			}
			else if(statementId == S.next) {
				data.onFailStatementId = S.first;
			}
		}

		if(data.params.stripQueue.length > 0) {
			this._updatePane(data.params.stripQueue.shift(), statementId);
			if(data.params.stripQueue.length == 0) {
				data.onComplete = function(row, statementId) {
					if(row) {
						self._preloadImage(row.image);
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

	function setByDatePicker() {
		var d = MozComics.Dom.advancedDate.dateValue;
		var time = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - 1;

		this.params.stripQueue = [];

		var dateType = MozComics.Dom.advancedDateMenu.value;
		switch(dateType) {
			case "pubDate":
				this.params.lastComic = INFINITY;
				this.params.lastStrip = Math.floor(time / 1000);
				this.setToNextStrip();
				break;
			case "readDate":
				this.params.lastRead = time;
				this.setToForwardStrip();
				break;
		}
	}

	function _preloadImage(src) {
		if(MozComics.Prefs.user.preloadImages) {
			var image = new Image();
			image.src = src;
		}
	}

	function _updatePane(row, statementId) {
		if(self.params.stripQueue.length > 0) {
			self._preloadImage(self.params.stripQueue[0].image);
		}

		if(row && self.params.lastUrl == row.url) {
			MozComics.Dom.loadingImage.style.visibility = 'hidden';
		}

		self._updateParamVariables(row, statementId);
		self._updateDatePickerDates(row);

		MozComics.Dom.stripFound.hidden = !row;
		MozComics.Dom.stripNone.hidden = !!row;
		if(row) {
			var comic = MozComics.Comics.getComic(row.comic);
			MozComics.Dom.comic.textContent = comic.name;
			MozComics.Dom.comic.href = comic.url;
			var title = (row.title) ? row.title : MozComics.Utils.getString("strip.noTitle");
			MozComics.Dom.title.textContent = title;
			MozComics.Dom.title.href = row.url;
			MozComics.Dom.image.src = row.image;
			MozComics.Dom.image.hidden = false;
			if(!row.image) {
				MozComics.Dom.loadingImage.style.visibility = 'hidden';
			}

			var extra = {};
			try {
				extra = JSON.parse(row.extra);
			}
			catch(e) {}

			// handle mouseover extra property
			MozComics.Dom.imageTooltip.hidden = !extra.mouseover;
			MozComics.Dom.imageTooltip.label = "";
			MozComics.Dom.imageTooltipLabel.textContent = "";
			MozComics.Dom.imageTooltipLabel.hidden = true;
			if(extra.mouseover) {
				var mouseover = MozComics.Utils.unescapeHtml(extra.mouseover);
				MozComics.Dom.imageTooltip.label = mouseover;
				if(MozComics.Prefs.user.showMouseoverBelowImage) {
					MozComics.Dom.imageTooltipLabel.textContent = mouseover;
					MozComics.Dom.imageTooltipLabel.hidden = false;
				}
			}

			// handle hiddenImage extra propery
			MozComics.Dom.hiddenImage.hidden = !extra.hiddenImage;
			MozComics.Dom.hiddenImage.src = "";
			if(extra.hiddenImage) {
				MozComics.Dom.hiddenImage.src = extra.hiddenImage;
			}


			if(MozComics.Prefs.user.defaultToMarkRead) {
				MozComics.Dom.updateRead.checked = true;
			}

			if(statementId == S.back || statementId == S.forward) {
				MozComics.Dom.updateRead.checked = false;
			}
		}
		else {
			MozComics.Dom.loadingImage.style.visibility = 'hidden';
		}

		if(!MozComics.Dom.pane.hidden) {
			MozComics.Dom.stripPane.scrollTo(0,0);
		}
	}

	// update show read if the updateRead checkbox was checked
	function _unloadCurrentStrip() {
		if(this.params.lastComic != null && this.params.lastStrip != null &&
			this.params.lastUrl != null && MozComics.Dom.updateRead.checked) {

			var strip = {
				strip: this.params.lastStrip,
				url: this.params.lastUrl
			};

			return StripsResource.updateReadTime(this.params.lastComic, [strip]);
		}
		return false;
	}

	function _updateParamVariables(row, statementId) {
		if(row) {
			this.params.lastComic = row.comic;
			this.params.lastStrip = row.strip;
			this.params.lastUrl = row.url;

			switch(statementId) {
				case S.back:
				case S.forward:
					this.params.lastRead = row.read;
					break;
				default: // some other navigation
					this.params.lastRead = INFINITY;
			}
		}
		else {
			this.lastUrl = null;

			switch(statementId) {
				case S.previous:
					this.params.lastComic = -1 * INFINITY;
					this.params.lastStrip = -1 * INFINITY;
					break;
				case S.next:
					this.params.lastComic = INFINITY;
					this.params.lastStrip = INFINITY;
					break;
				default: // some other navigation
					this.params.lastComic = null;
					this.params.lastStrip = null;
			}


			switch(statementId) {
				case S.back:
					this.params.lastRead = -1 * INFINITY;
					break;
				case S.forward:
				default: // some other navigation
					this.params.lastRead = INFINITY;
			}
		}
	}

	function _updateDatePickerDates(row) {
		if(row) {
			this.datePickerDates = {
				"pubDate": MozComics.Utils.sqlToDate(row.strip).getTime(),
				"readDate": row.read
			};
		}
		else {
			var d = new Date();
			this.datePickerDates = {
				"pubDate": d.getTime(),
				"readDate": d.getTime()
			};
		}

		this.updateDatePicker();
	}

	function updateDatePicker() {
		var datepicker = MozComics.Dom.advancedDate;
		var dateType = MozComics.Dom.advancedDateMenu.value;
		var d = new Date();

		switch(dateType) {
			case "pubDate":
			case "readDate":
				d.setTime(this.datePickerDates[dateType]);
		}

		datepicker.dateValue = d;
	}
}

