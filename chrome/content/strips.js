/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Strips = new function() {
	this.init = init;
	this.refresh = refresh;
	this.unload = unload;

	this.setToFirstStrip = setToFirstStrip;
	this.setToPreviousStrip = setToPreviousStrip;
	this.setToNextStrip = setToNextStrip;
	this.setToLastStrip = setToLastStrip;
	this.setToRandomStrip = setToRandomStrip;
	this.setToBackStrip = setToBackStrip;
	this.setToForwardStrip = setToForwardStrip;

	this._findStrip = _findStrip;
	this._updatePane = _updatePane;
	this._preloadImage = _preloadImage;
	this._cloneRow = _cloneRow;
	this._unloadLastStrip = _unloadLastStrip;
	this._updateLastVariables = _updateLastVariables;
	this._updateDatePicker = _updateDatePicker;

	this.lastComic = null;
	this.lastStrip = null;

	this.lastRead = null;

	this.randomQueue = [];

	this.s = {
		first: 0,
		previous: 1,
		next: 2,
		last: 3,
		random: 4,
		back: 5,
		forward: 6
	}

	this.COLUMNS = ["comic", "strip", "title", "image", "extra", "read"];
	this.STATEMENT_PREFIX = "SELECT " + this.COLUMNS.join(",") + " FROM strip WHERE (?) ";
	this.statements = [
		this.STATEMENT_PREFIX +	"ORDER BY strip ASC, comic ASC", // get the first strip

		this.STATEMENT_PREFIX + "AND ((strip < :last_strip) OR " // get the previous strip
			+ "(strip = :last_strip AND comic < :last_comic)) ORDER BY strip DESC, comic DESC",

		this.STATEMENT_PREFIX + "AND ((strip > :last_strip) OR " // get the next strip
			+ "(strip = :last_strip AND comic > :last_comic)) ORDER BY strip ASC, comic ASC",

		this.STATEMENT_PREFIX +	"ORDER BY strip DESC, comic DESC", // get the last strip

		this.STATEMENT_PREFIX + "ORDER BY RANDOM()", // get a random strip

		this.STATEMENT_PREFIX + "AND read < :last_read ORDER BY read DESC", // get the back strip

		this.STATEMENT_PREFIX + "AND read > :last_read ORDER BY read ASC", // get the forward strip
	];

	this.INFINITE = 10000000000000; // will fail when used for time after 2286-11-20 17:46:40

	function init() {
		var preloadAmount = MozComics.Prefs.get("preloadAmount");
		var limitAmount = MozComics.Prefs.get("preloadImages") ? preloadAmount : 1;
		for(var i = 0, len = this.statements.length; i < len; i++) {
			this.statements[i] += " LIMIT " + limitAmount + ";";
		}

		this.updateStripReadTime = MozComics.DB.dbConn.createStatement(
			"UPDATE strip SET read = :read WHERE comic = :comic AND strip = :strip;"
		);

		var lastViewed = MozComics.Prefs.get("lastViewed").split(",");
		if(MozComics.Prefs.get("loadLastViewedAtStart") && lastViewed.length == 2) {
			var statement = MozComics.DB.dbConn.createStatement(
				this.STATEMENT_PREFIX.replace("?", "comic=:comic AND strip=:strip"));
			statement.params.comic = lastViewed[0];
			statement.params.strip = lastViewed[1];

			if(statement.executeStep()) {
				this._updatePane(statement.row);
			}
			else {
				this.refresh();
			}
			statement.reset();
		}
		else {
			this.refresh();
		}
	}

	function refresh() { // TODO make this less crudy
		this.lastRead = this.INFINITE;
		this.randomQueue = [];

		if(MozComics.Dom.stripFound.hidden) {
			this.setToLastStrip();
		}
	}

	function unload() {
		if(this.lastComic && Math.abs(this.lastComic) < this.INFINITE &&
			this.lastStrip && Math.abs(this.lastStrip) < this.INFINITE) {

			MozComics.Prefs.set("lastViewed", this.lastComic + "," + this.lastStrip);
		}
		else {
			MozComics.Prefs.set("lastViewed", "");
		}
	}

	function setToFirstStrip() {
		var firstStrip = this._findStrip(this.s.first);
		this._updatePane(firstStrip, this.s.first);

		if(MozComics.Prefs.get("defaultToMarkRead")) {
			MozComics.Dom.updateRead.checked = true;
		}
	}

	function setToPreviousStrip() {
		var previousStrip = null;
		if(this.lastComic && this.lastStrip) {
			previousStrip = this._findStrip(this.s.previous);
		}

		if(!previousStrip && MozComics.Prefs.get("wrapAround")) {
			this.setToLastStrip();
		}
		else {
			this._updatePane(previousStrip, this.s.previous);
		}

		if(MozComics.Prefs.get("defaultToMarkRead")) {
			MozComics.Dom.updateRead.checked = true;
		}
	}

	function setToNextStrip() {
		var nextStrip = null;
		if(this.lastComic && this.lastStrip) {
			nextStrip = this._findStrip(this.s.next);
		}

		if(!nextStrip && MozComics.Prefs.get("wrapAround")) {
			this.setToFirstStrip();
		}
		else {
			this._updatePane(nextStrip, this.s.next);
		}

		if(MozComics.Prefs.get("defaultToMarkRead")) {
			MozComics.Dom.updateRead.checked = true;
		}
	}

	function setToLastStrip() {
		var lastStrip = this._findStrip(this.s.last);
		this._updatePane(lastStrip, this.s.last);

		if(MozComics.Prefs.get("defaultToMarkRead")) {
			MozComics.Dom.updateRead.checked = true;
		}
	}

	function setToRandomStrip() {
		var randomStrip = null;
		if(this.randomQueue.length > 0) {
			randomStrip = this.randomQueue.shift();
			if(this.randomQueue.length == 0) {
				var strip = this._findStrip(this.s.random);
				this.randomQueue.push(strip);
			}
		}
		else {
			randomStrip = this._findStrip(this.s.random);
		}

		this._updatePane(randomStrip, this.s.random);

		if(MozComics.Prefs.get("defaultToMarkRead")) {
			MozComics.Dom.updateRead.checked = true;
		}
	}


	function setToBackStrip() {
		var backStrip = this._findStrip(this.s.back, true);
		this._updatePane(backStrip, this.s.back);
		MozComics.Dom.updateRead.checked = false;
	}

	function setToForwardStrip() {
		var forwardStrip = this._findStrip(this.s.forward, true);
		this._updatePane(forwardStrip, this.s.forward);
		MozComics.Dom.updateRead.checked = false;
	}

	function _findStrip(statementId, showRead) {//TODO make asynchronous???
		this.randomQueue = [];

		var queryString = this.statements[statementId];
		var enabledComics = MozComics.Comics.enabled;
		var len = enabledComics.length;
		if(len == 0) {
			return false;
		}

		var t = new Array();
		for(var i = 0; i < len; i++) {
			t.push("comic=?" + (i+1));
		}
		t = t.join(" OR ");
		
		if(!MozComics.Dom.showRead.checked && !showRead) {
			t = "(" + t + ") AND read ISNULL";
		}

		var finalQueryString = queryString.replace("?", t);
		var statement = MozComics.DB.dbConn.createStatement(finalQueryString);

		for(var i = 0; i < len; i++) {
			statement.bindInt32Parameter(i, enabledComics[i].comic);
		}

		if(finalQueryString.indexOf(":last_comic") > -1) {
			statement.params.last_comic = this.lastComic;
		}

		if(finalQueryString.indexOf(":last_strip") > -1) {
			statement.params.last_strip = this.lastStrip;
		}

		if(finalQueryString.indexOf(":last_read") > -1) {
			statement.params.last_read = this.lastRead;
		}

		var returnValue = false;
		if(statement.executeStep()) {
			var returnValue = this._cloneRow(statement.row);
			this._preloadImage(returnValue.image);

			while(statement.executeStep()) {
				if(statementId == this.s.random) {
					this.randomQueue.push(this._cloneRow(statement.row));
				}

				this._preloadImage(statement.row.image);
			}
		}

		statement.reset();
		return returnValue;
	}

	function _updatePane(row, statementId) {
		this._unloadLastStrip();
		this._updateLastVariables(row, statementId);
		this._updateDatePicker(row);

		MozComics.Dom.stripFound.hidden = !row;
		MozComics.Dom.stripNone.hidden = !!row;
		if(row) {
			MozComics.Dom.comic.value = MozComics.Comics.all[row.comic].name;
			MozComics.Dom.comic.href = MozComics.Comics.all[row.comic].url;
			MozComics.Dom.title.value = row.title;
			MozComics.Dom.image.hidden = false;
			MozComics.Dom.image.src = row.image;

			var mouseover = null;
			if(row.extra != "")  {
				var extra = JSON.parse(row.extra);
				mouseover = extra.mouseover;
			}
			MozComics.Dom.imageTooltip.label = mouseover ? mouseover : "";
			MozComics.Dom.imageTooltip.hidden = !mouseover;
		}
			
		if(!MozComics.Dom.pane.hidden) { // TODO shouldn't be run on startup?
			MozComics.Dom.scrollbox.scrollTo(0,0);
		}
	}

	function _preloadImage(src) {
		var img = new Image();
		img.src = src;
	}

	function _cloneRow(row) {
		var clone = {};
		for(var i = 0, len = this.COLUMNS.length; i < len; i++) {
			var column = this.COLUMNS[i];
			clone[column] = row[column];
		}
		return clone;
	}

	function _unloadLastStrip() {
		if(this.lastComic && this.lastStrip && MozComics.Dom.updateRead.checked) {
			this.updateStripReadTime.params.comic = this.lastComic;
			this.updateStripReadTime.params.strip = this.lastStrip;

			var d = new Date();
			this.updateStripReadTime.params.read = d.getTime();
			this.updateStripReadTime.execute();
		}
	}

	function _updateLastVariables(row, statementId) {
		if(row) {
			this.lastComic = row.comic;
			this.lastStrip = row.strip;

			switch(statementId) {
				case this.s.back:
				case this.s.forward:
					this.lastRead = row.read;
					break;
				default: // some other navigation
					this.lastRead = this.INFINITE;
			}
		}
		else {
			switch(statementId) {
				case this.s.previous:
					this.lastComic = -1 * this.INFINITE;
					this.lastStrip = -1 * this.INFINITE;
					break;
				case this.s.next:
					this.lastComic = this.INFINITE;
					this.lastStrip = this.INFINITE;
					break;
				default: // some other navigation
					this.lastComic = null;
					this.lastStrip = null;
			}


			switch(statementId) {
				case this.s.back:
					this.lastRead = -1 * this.INFINITE;
					break;
				case this.s.forward:
				default: // some other navigation
					this.lastRead = this.INFINITE;
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

