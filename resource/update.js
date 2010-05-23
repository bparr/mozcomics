/*
Copyright (c) 2009-2010 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["Update"];

Components.utils.import("resource://mozcomics/utils.js");
Components.utils.import("resource://mozcomics/db.js");
Components.utils.import("resource://mozcomics/comics.js");
Components.utils.import("resource://mozcomics/prefs.js");
Components.utils.import("resource://mozcomics/callback.js");

/*
 * Update local database. Also used to add a comic to the database.
 */
var Update = new function() {
	var self = this;

	this.upgradeRequired = false;
	this.lastUpdateSuccessful = true;
	this.failureMessage = '';

	this.setAutoUpdateTimer = setAutoUpdateTimer;
	this.addComic = addComic;
	this.updateFromFile = updateFromFile;
	this.updateAll = updateAll;

	// types of ways to update
	var UPDATE_TYPES = {
		addComic: 1,
		updateFromFile: 2,
		toolbarUpdateAll: 3,
		automaticUpdateAll: 4
	};

	// possible update actions for strips
	var ACTIONS = {
		add: 0,
		delete: 1,
		update: 2
	};

	// types of get queries
	var GET_TYPES = {
		comic: 1,
		persistedStrip: 2
	}

	// persisted columns for strip when action == ACTIONS.update
	var STRIP_PERSISTED_COLUMNS = ["strip", "read", "user_rating"];

	var getComicByGuidStatement = DB.dbConn.createStatement(
		"SELECT " + GET_TYPES.comic + " AS getType, " + DB.comicColumns.join(", ")
		+ " FROM comic WHERE guid=:guid;"
	);
	var getStripPersistedStatement = DB.dbConn.createStatement(
		"SELECT " + GET_TYPES.persistedStrip + " AS getType, " + STRIP_PERSISTED_COLUMNS.join(", ")
		+ " FROM strip WHERE comic=:comic AND strip=:strip;"
	);
	var updateComicStatement = DB.dbConn.createStatement(
		"REPLACE INTO comic(" + DB.comicColumns.join(", ") + ") VALUES (" + DB.comicParams.join(", ") + ");"
	);
	var updateStripStatement = DB.dbConn.createStatement(
		"REPLACE INTO strip(" + DB.stripColumns.join(", ") + ") VALUES (" + DB.stripParams.join(", ") + ");"
	);
	var deleteStripStatement = DB.dbConn.createStatement(
		"DELETE FROM strip WHERE comic=:comic and strip=:strip;"
	);
	var updateComicUpdatedTimeStatement = DB.dbConn.createStatement(
		"UPDATE comic SET updated=:updated WHERE comic = :comic;"
	);


	// variables to keep track of update progress
	this.updateInProgress = false;
	this.numRequests = 0;
	this.numRequestsCompleted = 0;
	this.numUpdatedComics = 0;
	this.numUpdatedComicsCompleted = 0;
	this.currentUpdateSuccessful = true;
	this.currentFailureMessage = '';
	this.initProgressVariables = function() {
		if(this.updateInProgress) {
			return false;
		}
		this.updateInProgress = true;
		this.numRequests = 0;
		this.numRequestsCompleted = 0;
		this.numUpdatedComics = 0;
		this.numUpdatedComicsCompleted = 0;
		this.currentUpdateSuccessful = true;
		this.currentFailureMessage = '';
		return true;
	};


	// initialize automatic updating
	this.MIN_INTERVAL = 10;
	this.timer = Components.classes["@mozilla.org/timer;1"]
		.createInstance(Components.interfaces.nsITimer);
	this.timerCallback = {
		notify: function(timer) {
			self.updateAll(UPDATE_TYPES.automaticUpdateAll);
		}
	};

	if(Prefs.user.updateOnStart) {
		this.updateAll(UPDATE_TYPES.automaticUpdateAll);
	}
	this.setAutoUpdateTimer();


	/*
	 * Set the update timer for automatic updating
	 */
	function setAutoUpdateTimer() {
		this.timer.cancel();

		if(Prefs.user.autoUpdate && !this.upgradeRequired) {
			// stored as number of minutes
			var updateInterval = Prefs.user.updateInterval;

			if(updateInterval < this.MIN_INTERVAL) {
				updateInterval = Prefs.default.updateInterval;
				Prefs.set("updateInterval", updateInterval);
			}

			this.timer.initWithCallback(this.timerCallback, updateInterval * 60000, 
				Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
		}
	}

	/*
	 * Install a new comic
	 */
	function addComic(comic) {
		comic.updated = 0;
		_requestUpdates([comic], UPDATE_TYPES.addComic);
	}

	/*
	 * Select JSON file, and use it to update
	 */
	function updateFromFile() {
		var updateType = UPDATE_TYPES.updateFromFile;

		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
		var win = wm.getMostRecentWindow(null);

		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
		fp.init(win, null, nsIFilePicker.modeOpen);
		fp.appendFilter(Utils.getString("update.jsonFilter"), "*.json");
		fp.appendFilters(nsIFilePicker.filterAll);

		var rv = fp.show();
		if(rv != nsIFilePicker.returnOK) {
			return;
		}

		if(!self.initProgressVariables()) {
			Utils.alert(Utils.getString("update.inProgress"));
			return;
		}

		var jsonString = Utils.readTextFile(fp.file);
		try {
			var comic = JSON.parse(jsonString);
		}
		catch(err) {
			_onFailedUpdate(updateType, Utils.getString("update.invalidJson"));
			return;
		}

		self.numUpdatedComics = 1;
		_updateComic(comic, updateType);
	}

	/*
	 * Update all installed comics
	 */
	function updateAll(updateType) {
		updateType = (updateType) ? updateType : UPDATE_TYPES.toolbarUpdateAll;

		var comics = new Array();
		for(comicId in ComicsResource.all) {
			comics.push(ComicsResource.all[comicId]);
		}
		_requestUpdates(comics, updateType);
	}

	/*
	 * Make server requests in order to update specific comics
	 *
	 * comics is an array whose members at least have guid, name, and updated
	 */
	function _requestUpdates(comics, updateType) {
		if(!self.initProgressVariables()) {
			Utils.alert(Utils.getString("update.inProgress"));
			return;
		}

		if(self.upgradeRequired) {
			_onFailedUpdate(updateType, Utils.getString("update.upgradeRequired"));
			return;
		}

		// group by update site to decrease number of requests
		var updateSites = {};
		for(var i = 0, len = comics.length; i < len; i++) {
			var site = comics[i].update_site;
			site = (site) ? site : Utils.URLS.UPDATE;
			if(!updateSites[site]) {
				self.numRequests++;
				updateSites[site] = {};
				updateSites[site].guids = new Array();
				updateSites[site].updated = new Array();
			}
			updateSites[site].guids.push(comics[i].guid);
			updateSites[site].updated.push(comics[i].updated);
		}

		// generate and send requests
		for(updateSite in updateSites) {
			var url = updateSite + "version=" + Utils.UPDATE_VERSION +
				"&guids=" + updateSites[updateSite].guids.join(',') +
				"&updated=" + updateSites[updateSite].updated.join(',');

			var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
				.createInstance(Components.interfaces.nsIXMLHttpRequest);
			req.open('GET', url, true);
			req.onreadystatechange = function (aEvt) {
				var req = aEvt.originalTarget;
				if (req.readyState == 4) {
					self.numRequestsCompleted++;
					if(req.status == 200) {
						_onDownloadComplete(req, updateType);
					}
					else {
						_onFailedUpdate(updateType, Utils.getString("update.serverError"));
					}
				}
			};
			req.send(null);
		}

		if(self.numRequestsCompleted == 0) {
			_onSuccessfulUpdate(updateType);
		}
	}

	/*
	 * Process JSON returned by the server
	 */
	function _onDownloadComplete(req, updateType) {
		try {
			var response = JSON.parse(req.responseText);
		}
		catch(err) {
			_onFailedUpdate(updateType, Utils.getString("update.invalidJson"));
			return;
		}

		// handle update errors
		if(response.errors) {
			var updateErrors = response.errors;
			if(updateErrors.upgradeRequired) {
				self.upgradeRequired = true;
				_onFailedUpdate(updateType, Utils.getString("update.upgradeRequired"));
				return;
			}
		}

		var comicsLen = response.comics.length;

		// ensure only one comic is added if adding a new comic
		if(updateType == UPDATE_TYPES.addComic && comicsLen > 1) {
			_onFailedUpdate(updateType, Utils.getString("update.suspectedFoulPlay"));
			return;
		}

		self.numUpdatedComics += comicsLen;
		for(var i = 0; i < comicsLen; i++) {
			_updateComic(response.comics[i], updateType);
		}

		if(comicsLen == 0) {
			_onSuccessfulUpdate(updateType);
		}
	}

	/*
	 * Update an individual comic
	 */
	function _updateComic(comic, updateType) {
		if(!comic.guid) {
			self.numUpdatedComicsCompleted++;
			_onFailedUpdate(updateType, Utils.getString("update.missingGuid"));
			return;
		}
		if(!comic.updated) {
			self.numUpdatedComicsCompleted++;
			_onFailedUpdate(updateType, Utils.getString("update.missingUpdated"));
			return;
		}

		// certain columns are not settable from the JSON
		comic.comic = null;
		comic.state = null;

		// update the updated column once all strips have been inserted
		// in order to maintain consistency if strip insert queries fail
		var updated = comic.updated;
		comic.updated = 0;

		// save some states in the old comic so that they persist to the new one
		var oldComic = ComicsResource.guids[comic.guid];
		if(oldComic) {
			comic.comic = oldComic.comic;
			comic.state = oldComic.state;
			comic.updated = oldComic.updated;
		}
		else if(updateType == UPDATE_TYPES.toolbarUpdateAll ||
			updateType == UPDATE_TYPES.automaticUpdateAll) {
			// no comics should be added if only updating installed comics
			self.numUpdatedComicsCompleted++;
			_onFailedUpdate(updateType, Utils.getString("update.suspectedFoulPlay"));
			return;
		}


		var statements = [];

		// generate statements to get persisted columns when action == ACTIONS.update
		var strips = comic.strips;
		for(var i = 0, len = strips.length; i < len; i++) {
			if(!strips[i].strip) {
				self.numUpdatedComicsCompleted++;
				_onFailedUpdate(updateType, Utils.getString("update.missingStripId"));
				return;
			}
			if(oldComic && strips[i].action == ACTIONS.update) {
				var getStripPersisted = getStripPersistedStatement.clone();
				getStripPersisted.params.comic = oldComic.comic;
				getStripPersisted.params.strip = strips[i].strip;
				statements.push(getStripPersisted);
			}
		}

		// generate statement to update comic
		var updateComic = updateComicStatement.clone();
		for(var col = 0, colLen = DB.comicColumns.length; col < colLen; col++) {
			var columnName = DB.comicColumns[col];
			if(comic[columnName]) {
				updateComic.params[columnName] = comic[columnName];
			}
		}
		statements.push(updateComic);

		// generate statement to get updated comic
		var getComicByGuid = getComicByGuidStatement.clone();
		getComicByGuid.params.guid = comic.guid;
		statements.push(getComicByGuid);

		DB.dbConn.executeAsync(statements, statements.length, {
			strips: strips,
			updated: updated,
			updateType: updateType,
			newComic: null,
			persistedStrips: {},

			handleResult: function(response) {
				for(var row = response.getNextRow(); row; row = response.getNextRow()) {
					var getType = row.getResultByName("getType");
					if(getType == GET_TYPES.comic) {
						this.newComic = DB.cloneRow(row, DB.comicColumns);
						this.newComic.updated = this.updated;
					}
					else if(getType == GET_TYPES.persistedStrip) {
						var persisted = DB.cloneRow(row, STRIP_PERSISTED_COLUMNS);
						this.persistedStrips[persisted.strip] = persisted;
					}
				}
			},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				if(reason == DB.REASON_FINISHED) {
					_updateStrips(this.newComic, this.strips, this.persistedStrips,
						this.updated, this.updateType);
				}
				else {
					self.numUpdatedComicsCompleted++;
					_onFailedUpdate(this.updateType, Utils.getString("update.sqlError"));
				}
			}
		});
	}

	/*
	 * Update the strips of a comic
	 */
	function _updateStrips(comic, strips, persistedStrips, updated, updateType) {
		var statements = [];
		for(var i = 0, len = strips.length; i < len; i++) {
			var strip = strips[i];

			// certain columns are not settable from the JSON
			strip.comic = comic.comic;
			strip.read = null;
			strip.user_rating = null;
			strip.updated = updated;

			// persist strip columns if action == ACTIONS.update
			if(persistedStrips.hasOwnProperty(strip.strip)) {
				var persisted = persistedStrips[strip.strip];
				for(var col = 0, colLen = STRIP_PERSISTED_COLUMNS.length; col < colLen; col++) {
					var columnName = STRIP_PERSISTED_COLUMNS[col];
					strip[columnName] = persisted[columnName];
				}
			}

			switch(parseInt(strip.action)) {
				case ACTIONS.delete:
					var deleteStrip = deleteStripStatement.clone();
					deleteStrip.params.comic = strip.comic;
					deleteStrip.params.strip = strip.strip;
					statements.push(deleteStrip);
					break;

				case ACTIONS.add:
				case ACTIONS.update:
					var updateStrip = updateStripStatement.clone();
					for(var col = 0, colLen = DB.stripColumns.length; col < colLen; col++) {
						var columnName = DB.stripColumns[col];
						if(strip[columnName]) {
							updateStrip.params[columnName] = strip[columnName];
						}
					}
					statements.push(updateStrip);
					break;
			}
		}

		// finally update comic updated time
		var updateComicUpdatedTime = updateComicUpdatedTimeStatement.clone();
		updateComicUpdatedTime.params.comic = comic.comic;
		updateComicUpdatedTime.params.updated = updated;
		statements.push(updateComicUpdatedTime);

		DB.dbConn.executeAsync(statements, statements.length, {
			comic: comic,
			updateType: updateType,

			handleResult: function(response) {},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				self.numUpdatedComicsCompleted++;
				if(reason == DB.REASON_FINISHED) {
					ComicsResource.updateComic(this.comic);
					_onSuccessfulUpdate(this.updateType);
				}
				else {
					_onFailedUpdate(this.updateType, Utils.getString("update.sqlError"));
				}
			}
		});
	}

	/*
	 * Handle case where a comic was successfully updated
	 */
	function _onSuccessfulUpdate(updateType) {
		if(self.numRequestsCompleted == self.numRequests ||
			self.numUpdatedComicsCompleted == self.numUpdatedComics) {

			_onUpdateComplete(updateType);
		}
	}

	/*
	 * Handle case where a comic failed to update
	 */
	function _onFailedUpdate(updateType, failureMessage) {
		self.currentUpdateSuccessful = false;
		self.currentFailureMessage = Utils.getString("update.failureMessage", failureMessage);

		if(self.numRequestsCompleted == self.numRequests ||
			self.numUpdatedComicsCompleted == self.numUpdatedComics) {

			_onUpdateComplete(updateType);
		}
	}

	function _onUpdateComplete(updateType) {
		var success = self.currentUpdateSuccessful;
		self.lastUpdateSuccessful = success;
		self.failureMessage = self.currentFailureMessage;

		if(success) {
			if(updateType == UPDATE_TYPES.toolbarUpdateAll ||
				updateType == UPDATE_TYPES.automaticUpdateAll) {

				var d = new Date();
				Prefs.set("lastSuccessfulUpdate", d.getTime() / 1000);
			}
		}
		else {
			if(updateType != UPDATE_TYPES.automaticUpdateAll) {
				Utils.alert(self.failureMessage);
			}
		}


		Callback.callType("comicsChanged");
		if(updateType == UPDATE_TYPES.toolbarUpdateAll ||
			updateType == UPDATE_TYPES.automaticUpdateAll) {

			self.setAutoUpdateTimer();
		}

		Callback.callType("updateComplete");
		self.updateInProgress = false;
	}
}

