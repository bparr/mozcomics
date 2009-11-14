/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["ComicsResource"];

Components.utils.import("resource://mozcomics/utils.js");
Components.utils.import("resource://mozcomics/db.js");
Components.utils.import("resource://mozcomics/callback.js");

/*
 * Object to contain an indiviual comic, and expose different states.
 * row can be a row from a db, or a pre-existing comic (clones it)
 */
var Comic = function(row) {
	for(var j = 0, len = DB.comicColumns.length; j < len; j++) {
		var column = DB.comicColumns[j];
		this[column] = row[column];
	}

	if(this.extra) {
			try {
				var extra = JSON.parse(this.extra);
				this.extra = extra;
			}
			catch(e) {}
	}

	// Each instance of the MozComics object has its own set of comic states.
	// Assign each instance of the MozComics object an id (callbackId) in
	// order to know which set of states we are dealing with.
	this.states = {};
}

// define which bits represent which state properties
Comic.prototype.BITS = {
	showing: 0,
	enabled: 1
};

Comic.prototype.get = function(key, callbackId) {
	switch(key) {
		case "state":
			if(callbackId && this.states[callbackId]) {
				return this.states[callbackId];
			}
			return this.state;

		case "showing":
		case "enabled":
			return this._getStateProperty(this.BITS[key], callbackId);
		case "unread":
			return ComicsResource.unreadCounts[this.comic];
		default:
			return this[key];
	}
}

Comic.prototype.set = function(key, value, callbackId) {
	switch(key) {
		case "state":
			if(callbackId) {
				this.states[callbackId] = value
			}
			else {
				this[key] = value;
			}
			break;

		case "showing":
		case "enabled":
			this._setStateProperty(this.BITS[key], value, callbackId);
			break;
		case "unread":
			ComicsResource.unreadCounts[this.comic] = value;
			break;
		default:
			this[key] = value;
	}
}

Comic.prototype._getStateProperty = function(bit, callbackId) {
	var state = this.get("state", callbackId);
	if(!state) {
		throw ("State not defined in Comic._getStateProperty");
	}

	var mask = 1 << bit;
	return (state & mask) > 0;
}

Comic.prototype._setStateProperty = function(bit, set, callbackId) {
	var state = this.get("state", callbackId);
	if(!state) {
		throw ("State not defined in Comic._setStateProperty");
	}

	var mask = 1 << bit;
	if(set) {
		this.set("state", state | mask, callbackId);
	}
	else {
		this.set("state", state & (~mask), callbackId);
	}
}


/*
 * Handle caching comics from the database, and other comic functions.
 */
var ComicsResource = new function() {
	var self = this;

	this.all = {}; // all comics indexed by comic column
	this.guids = {}; // all comics indexed by guid column
	this.unreadCounts = {}; // strip unread counts indexed by comic column
	this.totalUnread = 0;

	this.populateUnreadCounts = populateUnreadCounts;
	this.updateComic = updateComic;
	this.deleteComic = deleteComic;
	this.saveStatesToDB = saveStatesToDB;
	this.findReadStrips = findReadStrips;
	this.markAllStripsRead = markAllStripsRead;

	this.callbackFunctions = {
		onAdd: function(id) {
			// add set of states for this id
			for(var comicId in self.all) {
				var comic = self.all[comicId];
				comic.states[id] = comic.state;
			}
		},
		onRemove: function(id) {
			// delete set of states for this id
			for(var comicId in self.all) {
				delete self.all[comicId].states[id];
			}
		},
		onCallType: function(type) {
			if(type == "stripRead" || type == "comicsChanged") {
				self.populateUnreadCounts();
			}
		}
	};
	Callback.addResource(this.callbackFunctions);


	// create statements
	var getUnreadCountsStatement = DB.dbConn.createStatement(
		"SELECT comic, COUNT(*) as unreadCount FROM strip WHERE read ISNULL GROUP BY comic;"
	);

	var deleteStripsByComicStatement = DB.dbConn.createStatement(
		"DELETE FROM strip WHERE comic=:comic;"
	);
	var deleteComicFromDBStatement = DB.dbConn.createStatement(
		"DELETE FROM comic WHERE comic=:comic;"
	);

	var saveStateToDBStatement = DB.dbConn.createStatement(
		"UPDATE comic SET state=:state WHERE comic=:comic"
	);

	var getUnreadStripsStatement = DB.dbConn.createStatement(
		"SELECT strip, url FROM strip WHERE comic=:comic AND read ISNULL;"
	);


	// cache comics from database
	var statement = DB.dbConn.createStatement(
		"SELECT " + DB.comicColumns.join(", ") + " FROM comic;"
	);

	while(statement.step()) {
		updateComic(statement.row);
	}

	this.populateUnreadCounts();


	/*
	 * Store the number of unread strips for each comic,
	 * and total unread strips
	 */
	function populateUnreadCounts() {
		this.unreadCounts = {};
		for(var comic in this.all) {
			this.unreadCounts[comic] = 0;
		}

		this.totalUnread = 0;
		var statement = getUnreadCountsStatement.clone(); 
		while(statement.step()) {
			this.unreadCounts[statement.row.comic] = statement.row.unreadCount;
			this.totalUnread += statement.row.unreadCount;
		}
	}


	/*
	 * Update a specific comic in cache
	 */
	function updateComic(row) {
		var comic = new Comic(row);

		var oldComic = self.all[comic.comic];
		var callbackIds = Callback.getIds();
		for(var i = 0, len = callbackIds.length; i < len; i++) {
			var id = callbackIds[i];
			// persist states from old comic
			if(oldComic && oldComic.states[id]) {
				comic.states[id] = oldComic.states[id];
			}
			else {
				comic.states[id] = comic.state;
			}
		}

		self.all[comic.comic] = comic;
		self.guids[comic.guid] = comic;
		return comic;
	}

	/*
	 * Delete a comic from cache and database
	 */
	function deleteComic(comic) {
		// delete from cache
		delete self.all[comic.comic];
		delete self.guids[comic.guid];

		// delete from database
		var deleteStripsByComic = deleteStripsByComicStatement.clone();
		deleteStripsByComic.params.comic = comic.comic;
		var deleteComicFromDB = deleteComicFromDBStatement.clone();
		deleteComicFromDB.params.comic = comic.comic;

		DB.dbConn.executeAsync([deleteStripsByComic, deleteComicFromDB], 2, {
			handleResult: function(response) {},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				if(reason == DB.REASON_FINISHED) {
					Callback.callType("comicsChanged");
				}
				else {
					Utils.alert(Utils.getString("deleteComic.sqlError"));
				}
			}
		});
	}

	/*
	 * Save the set of states for the instance of the MozComics object
	 * (identified by callbackId) to the database
	 */
	function saveStatesToDB(callbackId) {
		var statements = [];
		for(var comic in self.all) {
			var state = self.all[comic].get("state", callbackId);
			self.all[comic].set("state", state);
			var saveStateToDB = saveStateToDBStatement.clone();
			saveStateToDB.params.comic = comic;
			saveStateToDB.params.state = state;
			statements.push(saveStateToDB);
		}

		if(statements.length > 0) {
			DB.dbConn.executeAsync(statements, statements.length);
		}
	}

	/*
	 * Find the comic's strips whose urls are in the browser history, and
	 * prompt the user if they want to mark these strips as read
	 */
	function findReadStrips(selectedComic) {
		var getUnreadStrips = getUnreadStripsStatement.clone();
		getUnreadStrips.params.comic = selectedComic.comic;
		getUnreadStrips.executeAsync({
			selectedComic: selectedComic,
			columns: ["strip", "url"],
			rows: [],

			handleResult: function(response) {
				for(var row = response.getNextRow(); row; row = response.getNextRow()) {
					this.rows.push(row);
				}
			},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				if(reason == DB.REASON_FINISHED) {
					var historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"]
						.getService(Components.interfaces.nsIGlobalHistory2);
					var ioService = Components.classes["@mozilla.org/network/io-service;1"]
						.getService(Components.interfaces.nsIIOService);

					var readStrips = [];
					for(var i = 0, len = this.rows.length; i < len; i++) {
						var row = DB.cloneRow(this.rows[i], this.columns);
						var uri = ioService.newURI(row.url, null, null);
						if(historyService.isVisited(uri)) {
							readStrips.push(row);
						}
					}

					var noneFoundMessage = Utils.getString("findReadStrips.noneFound");
					_processReadStrips(this.selectedComic, readStrips, noneFoundMessage);
				}
				else {
					Utils.alert(Utils.getString("findReadStrips.sqlError"));
				}
			}
		});
	}

	/*
	 * Find a comic's strips that are marked unread in MozComics,
	 * and the user if they want to mark these strips as read
	 */
	function markAllStripsRead(selectedComic) {
		var getUnreadStrips = getUnreadStripsStatement.clone();
		getUnreadStrips.params.comic = selectedComic.comic;
		getUnreadStrips.executeAsync({
			selectedComic: selectedComic,
			columns: ["strip", "url"],
			rows: [],

			handleResult: function(response) {
				for(var row = response.getNextRow(); row; row = response.getNextRow()) {
					this.rows.push(row);
				}
			},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				if(reason == DB.REASON_FINISHED) {
					var readStrips = [];
					for(var i = 0, len = this.rows.length; i < len; i++) {
						var row = DB.cloneRow(this.rows[i], this.columns);
						readStrips.push(row);
					}

					var noneFoundMessage = Utils.getString("markAllStripsRead.noneFound");
					_processReadStrips(this.selectedComic, readStrips, noneFoundMessage);
				}
				else {
					Utils.alert(Utils.getString("markAllStripsRead.sqlError"));
				}
			}
		});
	}

	/*
	 * Prompt the user if they want to mark strips as read,
	 * and do so if user wants to.
	 */
	function _processReadStrips(selectedComic, readStrips, noneFoundMessage) {
		if(readStrips.length > 0) {
			var prompt = Components.classes["@mozilla.org/network/default-prompt;1"]
				.getService(Components.interfaces.nsIPrompt);

			var result = prompt.confirm("", Utils.getString("processReadStrips.youSure", readStrips.length));
			if(result) {
				DB.updateReadTimes(selectedComic.comic, readStrips);
			}
		}
		else {
			Utils.alert(noneFoundMessage);
		}
	}
}

