/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Strips = new function() {
	var self = this;

	Components.utils.import("resource://mozcomics/strips.js");
	var S = StripsResource.S;
	var INFINITY = StripsResource.INFINITY;

	this._firstRefresh = true;
	this.refresh = refresh;

	this.lastStripRequest = null;

	this.deleteCache = deleteCache;
	this.setToDefaultStrip = setToDefaultStrip;
	this.setToFirstStrip = function() { this._setStrip(S.first); };
	this.setToPreviousStrip = function() { this._setStrip(S.previous); };
	this.setToNextStrip = function() { this._setStrip(S.next); };
	this.setToLastStrip = function() { this._setStrip(S.last); };
	this.setToRandomStrip = function() { this._setStrip(S.random); };
	this.setToBackStrip = function() { this._setStrip(S.back); };
	this.setToForwardStrip = function() { this._setStrip(S.forward); };
	this.setToLastReadStrip = function() { this._setStrip(S.lastRead); };
	this.setByDatePicker = setByDatePicker;
	this.repeatLastRequest = repeatLastRequest;
	this._setStrip = _setStrip;

	this._updatePane = _updatePane;
	this._preloadImage = _preloadImage;
	this._updateParamVariables = _updateParamVariables;

	this.datePickerDates = null;
	this._updateDatePickerDates = _updateDatePickerDates;
	this.updateDatePicker = updateDatePicker;

	// parameters used when finding a strip
	this.params = {
		lastComic: null,
		lastStrip: null,
		lastUrl: null,
		lastRead: INFINITY,
		stripQueue: []
	}

	/*
	 * Change strip to default if no strip showing, or the one that is
	 * showing is from a comic that is no longer enabled
	 */
	function refresh() {
		self.params.lastRead = INFINITY;
		self.deleteCache();

		// don't search for a strip until MozComics has been opened
		if(!MozComics.hasBeenOpened) {
			return;
		}

		if(MozComics.Dom.stripFound.hidden ||
			self.params.lastComic == null ||
			!MozComics.Comics.getComic(self.params.lastComic) ||
			!MozComics.Comics.getComicProp(self.params.lastComic, "enabled")) {

			// show same strip when going from browser overlay to stand alone window
			if(self._firstRefresh && MozComics.isWindow && !MozComics.Prefs.user.alwaysOpenInNewWindow) {
				self.setToLastReadStrip();
			}
			else {
				self.setToDefaultStrip();
			}
		}

		self._firstRefresh = false;
	}

	/*
	 * Clear the strip cache
	 */
	function deleteCache() {
		this.params.stripQueue = [];
	}

	/*
	 * Request the default strip, which is set by user preference
	 */
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

	/*
	 * Request a strip based on the date picker. Called when user changes the
	 * value in the date picker.
	 */
	function setByDatePicker() {
		var d = MozComics.Dom.advancedDate.dateValue;
		var time = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - 1;

		this.deleteCache();

		var dateType = MozComics.Dom.advancedDateMenu.value;
		switch(dateType) {
			case "pubDate":
				// set to first strip published on or after date
				this.params.lastComic = INFINITY;
				this.params.lastStrip = Math.floor(time / 1000);
				this.setToNextStrip();
				break;
			case "readDate":
				// set to first strip read on or after date
				this.params.lastRead = time;
				this.setToForwardStrip();
				break;
		}
	}

	/*
	 * Repeat same type of request as the last one
	 */
	function repeatLastRequest() {
		if(this.lastStripRequest != null) {
			this._setStrip(this.lastStripRequest);
		}
	}

	/*
	 * Make strip request
	 */
	function _setStrip(statementId) {
		MozComics.Dom.loadingImage.style.visibility = 'visible';

		// delete cache if different strip request than the last one
		if(statementId != this.lastStripRequest) {
			this.deleteCache();
			this.lastStripRequest = statementId;
		}

		// lastComic and lastStrip need to be defined for previous and next search
		if(this.params.lastComic == null || this.params.lastStrip == null) {
			if(statementId == S.previous || statementId == S.next) {
				this._updatePane(false, statementId);
				return;
			}
		}

		// generate data for StripsResource.findStrip
		var data =  {
			statementId: statementId,
			onFailStatementId: null,
			params: this.params,
			onComplete: this._updatePane,
			enabledComics: MozComics.Comics.enabled,
			showRead: MozComics.Dom.showRead.checked,
			bookmark: MozComics.Dom.bookmarkMenu.value
		};

		// force showing read strips for requests for a type of read strip
		// (otherwise, the request would return no strips)
		if(statementId == S.back || statementId == S.forward || statementId == S.lastRead) {
			data.showRead = true;
		}

		// set on fail request used if first request returns no strips
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

		// use cached strip if one exists
		if(data.params.stripQueue.length > 0) {
			this._updatePane(data.params.stripQueue.shift(), statementId);

			// refill cache if cache is now empty
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

	/*
	 * Display requested strip (callback for StripsResource.findStrip)
	 */
	function _updatePane(row, statementId) {
		// preload next strip image in cache
		if(self.params.stripQueue.length > 0) {
			self._preloadImage(self.params.stripQueue[0].image);
		}

		// image onload event not triggered if url did not change, so
		// hide loadingImage icon here instead
		if(row && self.params.lastUrl == row.url) {
			MozComics.Dom.loadingImage.style.visibility = 'hidden';
		}

		self._updateParamVariables(row, statementId);
		self._updateDatePickerDates(row);

		MozComics.Dom.stripFound.hidden = !row;
		MozComics.Dom.stripNone.hidden = !!row;
		if(row) {
			if(MozComics.Dom.updateRead.checked && statementId != S.back && statementId != S.forward) {
				// update and store requested strip's read time
				self.params.lastRead = StripsResource.updateReadTime(row.comic, [row]);
			}

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
		}
		else {
			MozComics.Dom.loadingImage.style.visibility = 'hidden';
		}

		// scroll to the top of the strip pane
		if(!MozComics.Dom.pane.hidden) {
			MozComics.Dom.stripPane.scrollTo(0,0);
		}
	}

	/*
	 * Preload an image for quicker viewing later
	 */
	function _preloadImage(src) {
		if(MozComics.Prefs.user.preloadImages) {
			var image = new Image();
			image.src = src;
		}
	}

	/*
	 * Update parameters that are passed when finding a strip
	 */
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


	/*
	 * Store values for all type of dates for this row, so
	 * the user can switch between them
	 */
	function _updateDatePickerDates(row) {
		var d = new Date();
		var currentTime = d.getTime();

		if(row) {
			this.datePickerDates = {
				"pubDate": MozComics.Utils.sqlToDate(row.strip).getTime(),
				"readDate": (row.read != null) ? row.read : currentTime
			};
		}
		else {
			this.datePickerDates = {
				"pubDate": currentTime,
				"readDate": currentTime
			};
		}

		this.updateDatePicker();
	}

	/*
	 * Update the display of the date picker using stored dates
	 */
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

