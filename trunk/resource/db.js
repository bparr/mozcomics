/*
Copyright (c) 2009-2010 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["DB"];

Components.utils.import("resource://mozcomics/utils.js");
Components.utils.import("resource://mozcomics/callback.js");
Components.utils.import("resource://mozcomics/prefs.js");


const SCHEMA_VERSION = 1;

var storageService = Components.classes["@mozilla.org/storage/service;1"]
	.getService(Components.interfaces.mozIStorageService);
var historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"]
	.getService(Components.interfaces.nsIGlobalHistory2);
var ioService = Components.classes["@mozilla.org/network/io-service;1"]
	.getService(Components.interfaces.nsIIOService);

/*
 * Establish database connection, and database schema. Also provide a few
 * database related objects/functions.
 */
var DB = new function() {
	var self = this;
	this.REASON_FINISHED = Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED;
	this.cloneRow = cloneRow;
	this.updateReadTimes = updateReadTimes;

	// initialize database
	this.dbConn = _getDatabaseConnection();
	var currentVersion = this.dbConn.schemaVersion;
	if(currentVersion < SCHEMA_VERSION) {
		this.dbConn.beginTransaction();
		try {
			if(currentVersion == 0 && 
				!(this.dbConn.tableExists("comic") && this.dbConn.tableExists("strip"))) {
				_initializeSchema();
			}
			else {
				_updateSchema(currentVersion);
			}

			this.dbConn.schemaVersion = SCHEMA_VERSION;
			this.dbConn.commitTransaction();
		}
		catch (e) {
			this.dbConn.rollbackTransaction();
			throw(e);
		}
	}


	// list of columns in the comic table
	this.comicColumns = ["comic", "type", "name", "url", "description", "extra",
			"url_template", "image_template", "rating", "popularity", "guid",
			"state", "updated", "update_site"];
	this.comicParams = _createParamsArray(this.comicColumns);

	// list of columns in the strips table
	this.stripColumns = ["comic", "strip", "title", "url", "image", "bookmark",
		"extra", "read", "user_rating", "server_rating", "updated"];
	this.stripParams = _createParamsArray(this.stripColumns);

	var updateStripReadTimeStatement = this.dbConn.createStatement(
		"UPDATE strip SET read = :read WHERE comic = :comic AND strip = :strip;"
	);


	/*
	 * Return an object with properties listed in the columns array.
	 * Note: row is from a statement run asynchronously
	 */
	function cloneRow(row, columns) {
		var clone = {};
		for(var i = 0, len = columns.length; i < len; i++) {
			try {
				var column = columns[i];
				clone[column] = row.getResultByName(column);
			}
			catch(e) {}
		}
		return clone;
	}

	/*
	 * Update the read times of the strips.
	 * Return the read time.
 	 */
	function updateReadTimes(comic, strips, d) {
		// use current time is none was passed
		d = (d) ? d : new Date();
		var read = d.getTime();

		var updateStatements = [];
		for(var i = 0, len = strips.length; i < len; i++) {
			var strip = strips[i];
			var updateStripReadTime = updateStripReadTimeStatement.clone();
			updateStripReadTime.params.comic = comic;
			updateStripReadTime.params.strip = strip.strip;

			// add i to read in order to make read times different
			updateStripReadTime.params.read = read + i;

			updateStatements.push(updateStripReadTime);

			if(Prefs.user.addReadToBrowserHistory) {
				// add url of strip to browser history
				var uri = ioService.newURI(strip.url, null, null);
				historyService.addURI(uri, false, true, null);
			}
		}

		self.dbConn.executeAsync(updateStatements, updateStatements.length, {
			handleResult: function(response) {},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				Callback.callType("stripRead");
				if(reason != self.REASON_FINISHED) {
					Utils.alert(Utils.getString("updateReadTime.sqlError"));
				}
			}
		});

		return read;
	}

	/*
	 * Create database connection, creating/managing backups as needed
	 */
	function _getDatabaseConnection() {
		var mozcomicsDirectory = Utils.mozcomicsDirectory;
		var databaseName = Utils.DATABASE_NAME;
		function getBackupFilename(i) {
			return databaseName + (i ? '.' + i : '') + ".bak";
		}

		// get backup amount from preference
		var MAX_BACKUPS = 16;
		var oldBackupAmount = Prefs.user.backupAmount;
		var backupAmount = Math.max(0, Math.min(oldBackupAmount, MAX_BACKUPS));
		if(backupAmount != oldBackupAmount) {
			Prefs.set("backupAmount", backupAmount);
		}

		// create mozcomics directory if it doesn't exist
		if(Utils.createDirectory(mozcomicsDirectory)) {
			// handle case where user is upgrading from version prior to 1.0b3
			var oldDatabaseFile = Utils.getNSIFile(Utils.profileDirectory, databaseName);
			if(oldDatabaseFile.exists()) {
				oldDatabaseFile.moveTo(mozcomicsDirectory, databaseName);
			}
		}

		// remove old backups
		// (multiple backups will be removed if user previously decreased backupAmount)
		for(var i = Math.max(0, backupAmount - 1); true; i++) {
			var oldBackupFile = Utils.getNSIFile(mozcomicsDirectory, getBackupFilename(i));
			if(!oldBackupFile.exists()) {
				break;
			}

			oldBackupFile.remove(null);
		}

		// shift backups up a number
		for(var i = backupAmount - 2; i >= 0; i--) {
			var sourceFilename = getBackupFilename(i);
			var sourceFile = Utils.getNSIFile(mozcomicsDirectory, sourceFilename);

			if(sourceFile.exists()) {
				var targetFilename = getBackupFilename(i + 1);
				sourceFile.moveTo(mozcomicsDirectory, targetFilename);
			}
		}

		// create backup of main database file
		var databaseFile = Utils.getNSIFile(mozcomicsDirectory, databaseName);
		if(backupAmount > 0 && databaseFile.exists()) {
			try {
				storageService.backupDatabaseFile(databaseFile, getBackupFilename(0));
			}
			catch(e) {}
		}

		return storageService.openDatabase(databaseFile);
	}

	/*
	 * Initialize schema for fresh installs of MozComics
	 */
	function _initializeSchema() {
		// create tables
		_execute("CREATE TABLE IF NOT EXISTS comic (" +
			"comic INTEGER PRIMARY KEY AUTOINCREMENT," +   // local id of comic
			"type INTEGER NOT NULL DEFAULT 0," +           // webcomic vs. manga (default = webcomic)
			"name TEXT NOT NULL," +                        // name of the comic
			"url TEXT NOT NULL DEFAULT ''," +              // comic homepage url
			"description TEXT NOT NULL DEFAULT ''," +      // description of the comic
			"extra TEXT NOT NULL DEFAULT ''," +            // extra info in JSON formatted string
			"url_template TEXT," +                         // template for strip urls
			"image_template TEXT," +                       // template for strip image urls
			"rating INTEGER NOT NULL DEFAULT -1," +        // based on server results
			"popularity INTEGER NOT NULL DEFAULT -1," +    // based on server results
			"guid TEXT NOT NULL UNIQUE," +                 // id for server transactions
			"state INTEGER NOT NULL DEFAULT 1," +          // state of comic in extension (showing, not enabled)
			"updated INTEGER," +                           // last sync with server (null indicates never updated)
			"update_site TEXT);"                           // site to check for updates (null defaults to MozComics site)
		);

		_execute("CREATE TABLE IF NOT EXISTS strip (" +
			"comic INTEGER NOT NULL," +                    // local id of comic strip is from
			"strip INTEGER NOT NULL," +                    // date strip was created (also used for id)
			"title TEXT NOT NULL DEFAULT ''," +            // title of the strip
			"url TEXT NOT NULL DEFAULT ''," +              // url of the strip
			"image TEXT NOT NULL DEFAULT ''," +            // url of image
			"bookmark INTEGER NOT NULL DEFAULT 0," +       // used to mark chapter starts in mangas
			"extra TEXT NOT NULL DEFAULT ''," +            // extra info in JSON formatted string
			"read INTEGER," +                              // time of last read (null indicates unread)
			"user_rating INTEGER NOT NULL DEFAULT -1," +   // rating set by user
			"server_rating INTEGER NOT NULL DEFAULT -1," + // rating based on server results
			"updated INTEGER," +                           // last sync with server (null indicates never updated)
			"PRIMARY KEY (comic, strip)," +
			"FOREIGN KEY (comic) REFERENCES comic(comic));"
		);

		// create indexes
		_execute("CREATE INDEX IF NOT EXISTS strip_comic_index ON strip (strip, comic);");
		_execute("CREATE INDEX IF NOT EXISTS comic_read_index ON strip (comic, read);");
	}

	/*
	 * Update schema from fromVersion to current version
	 * for when MozComics has been updated
	 */
	function _updateSchema(fromVersion) {
		for(var i = fromVersion; i < SCHEMA_VERSION; i++) {
			if(i == 0) {
				_execute("ALTER TABLE comic ADD COLUMN url_template");
				_execute("ALTER TABLE comic ADD COLUMN image_template");
				continue;
			}
		}
	}

	/*
	 * Execute a simple SQL query
	 */
	function _execute(query) {
		self.dbConn.executeSimpleSQL(query);
	}

	/*
	 * Create an array of param placeholder strings from columnsArray
	 */
	function _createParamsArray(columnArray) {
		var paramsArray = new Array();
		for(var i = 0, len = columnArray.length; i < len; i++) {
			paramsArray.push(":" + columnArray[i]);
		}
		return paramsArray;
	}
}

