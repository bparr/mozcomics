/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["StripsResource"];

Components.utils.import("resource://mozcomics/utils.js");
Components.utils.import("resource://mozcomics/db.js");

/*
 * Handle finding strips.
 */
var StripsResource = new function() {
	var self = this;

	this.findStrip = findStrip;
	this.updateReadTime = updateReadTime;

	this.INFINITE = 10000000000000; // will fail when used for time after 2286-11-20 17:46:40

	// indexes in STATEMENTS of types of strip statements
	this.S = {
		get: 0,
		first: 1,
		previous: 2,
		next: 3,
		last: 4,
		random: 5,
		back: 6,
		forward: 7
	}

	COLUMNS = ["comic", "strip", "title", "url", "image", "extra", "read"];
	STATEMENT_PREFIX = "SELECT " + COLUMNS.join(",") + " FROM strip WHERE (?) ";
	STATEMENTS = [
		STATEMENT_PREFIX + "AND strip = :strip;", // get a specific strip
		STATEMENT_PREFIX + "ORDER BY strip ASC, comic ASC LIMIT :limit;", // get the first strip

		STATEMENT_PREFIX + "AND ((strip < :lastStrip) OR " // get the previous strip
			+ "(strip = :lastStrip AND comic < :lastComic)) ORDER BY strip DESC, comic DESC LIMIT :limit;",

		STATEMENT_PREFIX + "AND ((strip > :lastStrip) OR " // get the next strip
			+ "(strip = :lastStrip AND comic > :lastComic)) ORDER BY strip ASC, comic ASC LIMIT :limit;",

		STATEMENT_PREFIX + "ORDER BY strip DESC, comic DESC LIMIT :limit;", // get the last strip

		STATEMENT_PREFIX + "ORDER BY RANDOM() LIMIT :limit;", // get a random strip

		STATEMENT_PREFIX + "AND read < :lastRead ORDER BY read DESC LIMIT :limit;", // get the back strip

		STATEMENT_PREFIX + "AND read > :lastRead ORDER BY read ASC LIMIT :limit;", // get the forward strip
	];


	var updateStripReadTimeStatement = DB.dbConn.createStatement(
		"UPDATE strip SET read = :read WHERE comic = :comic AND strip = :strip;"
	);


	function findStrip(data) {
		data.params.randomQueue = [];
		var enabledComics = data.enabledComics;

		var len = enabledComics.length;
		if(len == 0) {
			// don't bother searching if no comics are enabled
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
			t += " AND bookmark = :bookmark";
		}

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

		statement.executeAsync({
			data: data,
			rows: [],

			handleResult: function(response) {
				for(var row = response.getNextRow(); row; row = response.getNextRow()) {
					this.rows.push(row);
				}
			},

			handleError: function(error) {},
			handleCompletion: function(reason) {
				if(reason == DB.REASON_FINISHED) {
					// successfully found strip(s)
					if(this.rows.length > 0) {
						var firstRow = DB.cloneRow(this.rows[0], COLUMNS);
						this.data.preloadImage(firstRow.image);

						for(var i = 1, len = this.rows.length; i < len; i++) {
							var row = this.rows[i];
							if(this.data.statementId == self.S.random) {
								this.data.params.randomQueue.push(DB.cloneRow(row, COLUMNS));
							}
							this.data.preloadImage(row.getResultByName("image"));
						}

						this.data.onComplete(firstRow, this.data.statementId);
					}
					// unsuccessful in finding a strip, but a fallback statement exists
					else if(this.data.onFailStatementId) {
						this.data.statementId = this.data.onFailStatementId;
						this.data.onFailStatementId = null;
						findStrip(this.data);
					}
					// unsuccessful with no fallback statement
					else {
						this.data.onComplete(false, this.data.statementId);
					}
				}
				else {
					Utils.alert(Utils.getString("findStrip.sqlError"));
				}
			}
		});
	}

	function updateReadTime(comic, strip, read) {
		var updateStripReadTime = updateStripReadTimeStatement.clone();
		updateStripReadTime.params.comic = comic;
		updateStripReadTime.params.strip = strip;
		updateStripReadTime.params.read = read;
		updateStripReadTime.executeAsync();
	}
}

