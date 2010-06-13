/*
Copyright (c) 2009-2010 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["StripsResource"];

Components.utils.import("resource://mozcomics/utils.js");
Components.utils.import("resource://mozcomics/db.js");
Components.utils.import("resource://mozcomics/prefs.js");
Components.utils.import("resource://mozcomics/comics.js");
Components.utils.import("resource://mozcomics/callback.js");

/*
 * Handle finding strips.
 */
var StripsResource = new function() {
	var self = this;

	var busy = false;

	this.findStrip = findStrip;
	this.updateReadTime = DB.updateReadTimes;

	this.INFINITY = 10000000000000; // will fail when used for time after 2286-11-20 17:46:40

	// indexes in STATEMENTS of types of strip statements
	this.S = {
		get: 0,
		first: 1,
		previous: 2,
		next: 3,
		last: 4,
		random: 5,
		back: 6,
		forward: 7,
		lastRead: 8
	}

	COLUMNS = ["comic", "strip", "title", "url", "image", "extra", "read"];
	STATEMENT_PREFIX = "SELECT " + COLUMNS.join(",") + " FROM strip WHERE (?) ";
	STATEMENTS = [
		STATEMENT_PREFIX + "AND strip = :strip;", // get a specific strip

		STATEMENT_PREFIX + "ORDER BY strip ASC, comic ASC LIMIT 1;", // get the first strip

		STATEMENT_PREFIX + "AND ((strip < :lastStrip) OR " // get the previous strip
			+ "(strip = :lastStrip AND comic < :lastComic)) ORDER BY strip DESC, comic DESC LIMIT :limit;",

		STATEMENT_PREFIX + "AND ((strip > :lastStrip) OR " // get the next strip
			+ "(strip = :lastStrip AND comic > :lastComic)) ORDER BY strip ASC, comic ASC LIMIT :limit;",

		STATEMENT_PREFIX + "ORDER BY strip DESC, comic DESC LIMIT 1;", // get the last strip

		STATEMENT_PREFIX + "ORDER BY RANDOM() LIMIT :limit;", // get a random strip

		STATEMENT_PREFIX + "AND read < :lastRead ORDER BY read DESC LIMIT :limit;", // get the back strip

		STATEMENT_PREFIX + "AND read > :lastRead ORDER BY read ASC LIMIT :limit;", // get the forward strip

		STATEMENT_PREFIX + "AND read IS NOT NULL ORDER BY read DESC LIMIT 1;" // get the last read strip
	];

	/*
	 * Find a strip based on information in data. force is a flag used to
	 * force a request, even if busy (i.e. already fulfilling another request)
	 */
	function findStrip(data, force) {
		// do nothing if already fulfilling a request, and force flag false
		if(busy && !force) {
			return;
		}
		busy = true;

		var enabledComics = data.enabledComics;

		var len = enabledComics.length;
		if(len == 0) {
			// don't bother searching if no comics are enabled
			busy = false;
			data.onComplete(false, data.statementId);
			return;
		}

		// generate query string, adding placeholders for binding
		var t = new Array();
		for(var i = 0; i < len; i++) {
			t.push("comic=?" + (i+1));
		}
		t = t.join(" OR ");

		if(!data.showRead) {
			t = "(" + t + ") AND read ISNULL";
		}

		if(data.bookmark > 0) {
			t = "(" + t + ") AND bookmark = :bookmark";
		}

		// generate statement
		var queryString = STATEMENTS[data.statementId].replace("?", t);
		var statement = DB.dbConn.createStatement(queryString);

		// bind comic parameters
		for(var i = 0; i < len; i++) {
			statement.bindInt32Parameter(i, enabledComics[i].comic);
		}

		// bind other parameters
		for(var param in data.params) {
			if(queryString.indexOf(":" + param) > -1) {
				statement.params[param] = data.params[param];
			}
		}

		// bind bookmark
		if(queryString.indexOf(":bookmark") > -1) {
			statement.params.bookmark = data.bookmark;
		}

		// bind limit
		if(queryString.indexOf(":limit") > -1) {
			statement.params.limit = Prefs.user.preloadAmount;
		}

		statement.executeAsync({
			data: data,
			rows: [],

			handleResult: function(response) {
				// store rows that were returned
				for(var row = response.getNextRow(); row; row = response.getNextRow()) {
					this.rows.push(row);
				}
			},

			handleError: function(error) {},
			handleCompletion: function(reason) {
				this.data.params.stripQueue = [];
				if(reason == DB.REASON_FINISHED) {
					// successfully found strip(s)
					if(this.rows.length > 0) {
						var firstRow = parseRowResult(this.rows[0]);
						for(var i = 1, len = this.rows.length; i < len; i++) {
							var row = parseRowResult(this.rows[i]);
							this.data.params.stripQueue.push(row);
						}

						this.data.onComplete(firstRow, this.data.statementId);
						busy = false;
					}
					// unsuccessful in finding a strip, but a fallback statement exists
					else if(this.data.onFailStatementId) {
						this.data.statementId = this.data.onFailStatementId;
						this.data.onFailStatementId = null;
						findStrip(this.data, true); // force request
					}
					// unsuccessful with no fallback statement
					else {
						this.data.onComplete(false, this.data.statementId);
						busy = false;
					}
				}
				else {
					Utils.alert(Utils.getString("findStrip.sqlError"));
					this.data.onComplete(false, this.data.statementId);
					busy = false;
				}
			}
		});
	}

	function parseRowResult(row) {
		var parsedRow = DB.cloneRow(row, COLUMNS);
		var comic = ComicsResource.all[parsedRow.comic];

		// parse JSON object from extra column
		var extra = {};
		try {
			extra = JSON.parse(parsedRow.extra);
		}
		catch(e) {}
		parsedRow.extra = extra;

		// parse urls of images from image column
		var images = parsedRow.image ? parsedRow.image.split('\n') : [];

		// handle hiddenImage extra propery
		if(extra.hiddenImage) {
			images.push(extra.hiddenImage);
		}

		// build urls from templates
		parsedRow.url = buildUrl(comic.url_template, parsedRow.url);
		parsedRow.images = images.map(function(image) { 
			return buildUrl(comic.image_template, image);
		});

		return parsedRow;
	}

	function buildUrl(template, str) {
		if(!template || str.match(/^(https?|ftp|file):\/\/.+$/)) {
			return str;
		}

		var parts = str.split("\t");
		var replacementCallback = function(aMatch, aKey) {
			return parts[aKey] ? parts[aKey] : "";
		}

		return template.replace(/%(\d+)%/g, replacementCallback);
	}
}

