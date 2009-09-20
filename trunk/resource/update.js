/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["Update"];

Components.utils.import("resource://mozcomics/utils.js");
Components.utils.import("resource://mozcomics/db.js");
Components.utils.import("resource://mozcomics/comics.js");
Components.utils.import("resource://mozcomics/prefs.js");

/*
 * Update local database. Also used to add a comic to the database.
 */
var Update = new function() {
	var self = this;

	this.MIN_INTERVAL = 10;
	this.timer = Components.classes["@mozilla.org/timer;1"]
		.createInstance(Components.interfaces.nsITimer);
	this.timerCallback = {
		notify: function(timer) {
			self.updateAll();
		}
	};

	this.setAutoUpdateTimer = setAutoUpdateTimer;
	this.updateAll = updateAll;
	this.update = update;

	var defaultSite = Utils.URLS.UPDATE; // used when update_site column is null

	var getComicByGuidStatement = DB.dbConn.createStatement(
		"SELECT " + DB.comicColumns.join(", ") + " FROM comic WHERE guid=:guid;");
	var updateComicStatement = DB.dbConn.createStatement(
		"REPLACE INTO comic(" + DB.comicColumns.join(", ") + ") VALUES (" + DB.comicParams.join(", ") + ");"
	);
	var updateStripStatement = DB.dbConn.createStatement(
		"REPLACE INTO strip(" + DB.stripColumns.join(", ") + ") VALUES (" + DB.stripParams.join(", ") + ");"
	);
	var deleteStripStatement = DB.dbConn.createStatement(
		"DELETE FROM strip WHERE comic=:comic and strip=:strip;");


	if(Prefs.get("updateOnStart")) {
		this.updateAll();
	}
	this.setAutoUpdateTimer();


	function setAutoUpdateTimer() {
		this.timer.cancel();

		if(Prefs.get("autoUpdate")) {
			// stored as number of minutes
			var updateInterval = Prefs.get("updateInterval");

			if(updateInterval < this.MIN_INTERVAL) {
				updateInterval = Prefs.getDefault("updateInterval");
				Prefs.set("updateInterval", updateInterval);
			}

			this.timer.initWithCallback(this.timerCallback, updateInterval * 60000, 
				Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
		
		}
	}


	// update all installed comics
	function updateAll() {
		var comics = new Array();
		for(comicId in ComicsResource.all) {
			comics.push(ComicsResource.all[comicId]);
		}
		update(comics, false);
	}

	// comics is an array whose members at least have guid, name, and updated
	// addingNewComic is a boolean flag for case when adding a new comic
	function update(comics, addingNewComic) {
		var completedTracker = {
			numComplete: 0,
			total: comics.length
		};

		// group by update site to decrease number of requests
		var updateSites = {};
		for(var i = 0, len = comics.length; i < len; i++) {
			var site = comics[i].update_site;
			site = (site) ? site : defaultSite;
			if(!updateSites[site]) {
				updateSites[site] = {};
				updateSites[site].guids = new Array();
				updateSites[site].updated = new Array();
				updateSites[site].count = 0;
			}
			updateSites[site].guids.push(comics[i].guid);
			updateSites[site].updated.push(comics[i].updated);
			updateSites[site].count++;
		}

		// generate and send requests
		for(updateSite in updateSites) {
			var url = updateSite + "guids=" + updateSites[updateSite].guids.join(',');
			url += "&updated=" + updateSites[updateSite].updated.join(',');

			var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
				.createInstance(Components.interfaces.nsIXMLHttpRequest);
			req.open('GET', url, true);
			req.comicRequestCount = updateSites[updateSite].count;
			req.onreadystatechange = function (aEvt) {
				var req = aEvt.originalTarget;
				if (req.readyState == 4) {
					if(req.status == 200) {
						_onDownloadComplete(req, addingNewComic, completedTracker, req.comicRequestCount);
					}
					else {
						Utils.alert(Utils.getString("update.serverError"));
					}
				}
			};
			req.send(null);
		}
	}

	// process JSON returned by the server
	function _onDownloadComplete(req, addingNewComic, completedTracker, comicRequestCount) {
		try {
			var response = JSON.parse(req.responseText);
		}
		catch(err) {
			Utils.alert(Utils.getString("update.invalidJson"));
			return;
		}

		var comicsLen = response.comics.length;
		completedTracker.numComplete += (comicRequestCount - comicsLen);
		if(comicsLen == 0) {
			_onStripsComplete(addingNewComic, completedTracker);
		}

		// ensure only one comic is added if adding a new comic
		if(addingNewComic && comicsLen > 1) {
			throw ("Update failed: suspected foul play with update site");
		}

		var updated = response.time;

		for(var i = 0; i < comicsLen; i++) {
			var comic = response.comics[i];
			if(!comic.guid) {
				throw ("Update failed: guid not defined for a comic");
			}

			comic.guid = comic.guid.toLowerCase();

			// certain columns are not settable from the JSON
			comic.comic = null;
			comic.state = null;
			comic.updated = updated;

			// save some states in the old comic so that they persist to the new one
			var oldComic = ComicsResource.guids[comic.guid];
			if(oldComic) {
				comic.comic = oldComic.comic;
				comic.state = oldComic.state;
			}
			else if(!addingNewComic) {
				// no comics should be added if only updating installed comics
				throw ("Update failed: suspected foul play with update site");
			}

			// generate and execute statements to update comic
			var updateComic = updateComicStatement.clone();
			for(var col = 0, colLen = DB.comicColumns.length; col < colLen; col++) {
				var columnName = DB.comicColumns[col];
				if(comic[columnName]) {
					updateComic.params[columnName] = comic[columnName];
				}
			}

			var getComicByGuid = getComicByGuidStatement.clone();
			getComicByGuid.params.guid = comic.guid;

			DB.dbConn.executeAsync([updateComic, getComicByGuid], 2, {
				strips: comic.strips,
				updated: updated,
				addingNewComic: addingNewComic,
				completedTracker: completedTracker,

				handleResult: function(response) {
					var row = response.getNextRow();
					var newComicId = row.getResultByName("comic");
					ComicsResource.updateComic(DB.cloneRow(row, DB.comicColumns));
					_updateStrips(newComicId, this.strips, this.updated, 
						this.addingNewComic, this.completedTracker);
				},
				handleError: function(error) {},
				handleCompletion: function(reason) {}
			});
		}
	}

	function _updateStrips(comic, strips, updated, addingNewComic, completedTracker) {
		var stripStatements = [];
		for(var i = 0, len = strips.length; i < len; i++) {
			var strip = strips[i];
			if(!strip.strip) {
				throw ("Update failed: Strip ID not defined for a strip");
			}

			switch(parseInt(strip.action)) {
				case 1: // delete
					var deleteStrip = deleteStripStatement.clone();
					deleteStrip.params.comic = comic;
					deleteStrip.params.strip = strip.strip;
					stripStatements.push(deleteStrip);
					break;

				default: // add/update
					// certain columns are not settable from the JSON
					strip.comic = comic;
					strip.read = null;
					strip.user_rating = null;
					strip.updated = updated;

					var updateStrip = updateStripStatement.clone();
					for(var col = 0, colLen = DB.stripColumns.length; col < colLen; col++) {
						var columnName = DB.stripColumns[col];
						if(strip[columnName]) {
							updateStrip.params[columnName] = strip[columnName];
						}
					}
					stripStatements.push(updateStrip);
					break;
			}
		}

		if(stripStatements.length == 0) {
			completedTracker.numComplete++;
			_onStripsComplete(addingNewComic, completedTracker);
			return;
		}

		DB.dbConn.executeAsync(stripStatements, stripStatements.length, {
			addingNewComic: addingNewComic,
			completedTracker: completedTracker,

			handleResult: function(response) {},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				this.completedTracker.numComplete++;
				_onStripsComplete(this.addingNewComic, this.completedTracker);

				if(reason != DB.REASON_FINISHED) {
					Utils.alert(Utils.getString("update.sqlError"));
				}
			}
		});
	}

	function _onStripsComplete(addingNewComic, completedTracker) {
		if(completedTracker.numComplete == completedTracker.total) {
			ComicsResource.callCallbacks(true);

			if(!addingNewComic) {
				self.setAutoUpdateTimer();
			}
		}
	}
}

