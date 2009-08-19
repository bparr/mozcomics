/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Strips = new function() {
	var self = this;

	this.init = init;
	this.refresh = refresh;

	this.setToFirstStrip = setToFirstStrip;
	this.setToPreviousStrip = setToPreviousStrip;
	this.setToNextStrip = setToNextStrip;
	this.setToLastStrip = setToLastStrip;
	this.setToRandomStrip = setToRandomStrip;
	this.setToBackStrip = setToBackStrip;
	this.setToForwardStrip = setToForwardStrip;

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

		var lastViewed = MozComics.Prefs.get("lastViewed").split(",");
		if(MozComics.Prefs.get("loadLastViewedAtStart") && lastViewed.length == 2) {
			var statement = MozComics.DB.dbConn.createStatement(
				this.STATEMENT_PREFIX.replace("?", "comic=:comic AND strip=:strip"));
			statement.params.comic = lastViewed[0];
			statement.params.strip = lastViewed[1];

			if(statement.executeStep()) {
				_updatePane(statement.row);
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

		if(MozComics.Dom.stripFound.hidden) {
			this.setToLastStrip();
		}
	}

	function setToFirstStrip() {
		var firstStrip = _findStrip(self.s.first);
		_updatePane(firstStrip, self.s.first);

		if(MozComics.Prefs.get("defaultToMarkRead")) {
			MozComics.Dom.updateRead.checked = true;
		}
	}

	function setToPreviousStrip() {
		var previousStrip = null;
		if(self.lastComic && self.lastStrip) {
			previousStrip = _findStrip(self.s.previous);
		}

		if(!previousStrip && MozComics.Prefs.get("wrapAround")) {
			self.setToLastStrip();
		}
		else {
			_updatePane(previousStrip, self.s.previous);
		}

		if(MozComics.Prefs.get("defaultToMarkRead")) {
			MozComics.Dom.updateRead.checked = true;
		}
	}

	function setToNextStrip() {
		var nextStrip = null;
		if(self.lastComic && self.lastStrip) {
			nextStrip = _findStrip(self.s.next);
		}

		if(!nextStrip && MozComics.Prefs.get("wrapAround")) {
			self.setToFirstStrip();
		}
		else {
			_updatePane(nextStrip, self.s.next);
		}

		if(MozComics.Prefs.get("defaultToMarkRead")) {
			MozComics.Dom.updateRead.checked = true;
		}
	}

	function setToLastStrip() {
		var lastStrip = _findStrip(self.s.last);
		_updatePane(lastStrip, self.s.last);

		if(MozComics.Prefs.get("defaultToMarkRead")) {
			MozComics.Dom.updateRead.checked = true;
		}
	}

	function setToRandomStrip() {
		var randomStrip = null;
		if(this.randomQueue.length > 0) {
			randomStrip = this.randomQueue.shift();
			if(this.randomQueue.length == 0) {
				var strip = _findStrip(self.s.random);
				this.randomQueue.push(strip);
			}
		}
		else {
			randomStrip = _findStrip(self.s.random);
		}

		_updatePane(randomStrip, self.s.random);

		if(MozComics.Prefs.get("defaultToMarkRead")) {
			MozComics.Dom.updateRead.checked = true;
		}
	}


	function setToBackStrip() {
		var backStrip = _findStrip(self.s.back, true);
		_updatePane(backStrip, self.s.back);
		MozComics.Dom.updateRead.checked = false;
	}

	function setToForwardStrip() {
		var forwardStrip = _findStrip(self.s.forward, true);
		_updatePane(forwardStrip, self.s.forward);
		MozComics.Dom.updateRead.checked = false;
	}

	function _findStrip(statementId, showRead) {//TODO make asynchronous???
		self.randomQueue = [];

		var queryString = self.statements[statementId];
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
			statement.params.last_comic = self.lastComic;
		}

		if(finalQueryString.indexOf(":last_strip") > -1) {
			statement.params.last_strip = self.lastStrip;
		}

		if(finalQueryString.indexOf(":last_read") > -1) {
			statement.params.last_read = self.lastRead;
		}

		var returnValue = false;
		if(statement.executeStep()) {
			var returnValue = _cloneRow(statement.row);
			_preloadImage(returnValue.image);

			while(statement.executeStep()) {
				if(statementId == self.s.random) {
					self.randomQueue.push(_cloneRow(statement.row));
				}

				_preloadImage(statement.row.image);
			}
		}

		statement.reset();
		return returnValue;
	}

	function _updatePane(row, statementId) {
		_unloadLastStrip();
		_updateLastVariables(row, statementId);
		_updateDatePicker(row);

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
		for(var i = 0, len = self.COLUMNS.length; i < len; i++) {
			var column = self.COLUMNS[i];
			clone[column] = row[column];
		}
		return clone;
	}

	function _unloadLastStrip() {
		if(self.lastComic && self.lastStrip && MozComics.Dom.updateRead.checked) {
			MozComics.DB.updateStripReadTimeStatement.params.comic = self.lastComic;
			MozComics.DB.updateStripReadTimeStatement.params.strip = self.lastStrip;

			var d = new Date();
			MozComics.DB.updateStripReadTimeStatement.params.read = d.getTime();
			MozComics.DB.updateStripReadTimeStatement.execute();
		}
	}

	function _updateLastVariables(row, statementId) {
		if(row) {
			MozComics.Prefs.set("lastViewed", row.comic + "," + row.strip);

			self.lastComic = row.comic;
			self.lastStrip = row.strip;

			switch(statementId) {
				case self.s.back:
				case self.s.forward:
					self.lastRead = row.read;
					break;
				default: // some other navigation
					self.lastRead = self.INFINITE;
			}
		}
		else {
			MozComics.Prefs.set("lastViewed", "");

			switch(statementId) {
				case self.s.previous:
					self.lastComic = -1 * self.INFINITE;
					self.lastStrip = -1 * self.INFINITE;
					break;
				case self.s.next:
					self.lastComic = self.INFINITE;
					self.lastStrip = self.INFINITE;
					break;
				default: // some other navigation
					self.lastComic = null;
					self.lastStrip = null;
			}


			switch(statementId) {
				case self.s.back:
					self.lastRead = -1 * self.INFINITE;
					break;
				case self.s.forward:
				default: // some other navigation
					self.lastRead = self.INFINITE;
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

