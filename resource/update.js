/*
Copyright (c) 2009 Ben Parr
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
	var updateComicUpdatedTimeStatement = DB.dbConn.createStatement(
		"UPDATE comic set updated=:updated WHERE comic = :comic;"
	);


	if(Prefs.user.updateOnStart) {
		this.updateAll();
	}
	this.setAutoUpdateTimer();


	/*
	 * Set the update timer for automatic updating
	 */
	function setAutoUpdateTimer() {
		this.timer.cancel();

		if(Prefs.user.autoUpdate) {
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
	 * Update all installed comics
	 */
	function updateAll() {
		var comics = new Array();
		for(comicId in ComicsResource.all) {
			comics.push(ComicsResource.all[comicId]);
		}
		update(comics, false);
	}

	/*
	 * Update specific comics
	 *
	 * comics is an array whose members at least have guid, name, and updated
	 * addingNewComic is a boolean flag for case when adding a new comic
	 */
	function update(comics, addingNewComic) {
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
			req.onreadystatechange = function (aEvt) {
				var req = aEvt.originalTarget;
				if (req.readyState == 4) {
					if(req.status == 200) {
						_onDownloadComplete(req, addingNewComic);
					}
					else {
						Utils.alert(Utils.getString("update.serverError"));
					}
				}
			};
			req.send(null);
		}
	}

	/*
	 * Process JSON returned by the server
	 */
	function _onDownloadComplete(req, addingNewComic) {
		try {
			var response = JSON.parse(req.responseText);
		}
		catch(err) {
			Utils.alert(Utils.getString("update.invalidJson"));
			return;
		}

		var comicsLen = response.comics.length;

		// ensure only one comic is added if adding a new comic
		if(addingNewComic && comicsLen > 1) {
			throw ("Update failed: suspected foul play with update site");
		}

		for(var i = 0; i < comicsLen; i++) {
			var comic = response.comics[i];
			if(!comic.guid) {
				throw ("Update failed: guid not defined for a comic");
			}
			if(!comic.updated) {
				throw ("Update failed: updated not defined for a comic");
			}

			comic.guid = comic.guid.toLowerCase();

			// certain columns are not settable from the JSON
			comic.comic = null;
			comic.state = null;

			// update the updated once all strips have been inserted in order
			// to maintain consistency if strip insert queries fail
			var updated = comic.updated;
			comic.updated = 0;

			// save some states in the old comic so that they persist to the new one
			var oldComic = ComicsResource.guids[comic.guid];
			if(oldComic) {
				comic.comic = oldComic.comic;
				comic.state = oldComic.state;
				comic.updated = oldComic.updated;
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

				handleResult: function(response) {
					var newComic = DB.cloneRow(response.getNextRow(), DB.comicColumns);
					newComic.updated = this.updated;
					_updateStrips(newComic, this.strips, this.updated, this.addingNewComic);
				},
				handleError: function(error) {},
				handleCompletion: function(reason) {}
			});
		}
	}

	/*
	 * Update the strips of a comic
	 */
	function _updateStrips(newComic, strips, updated, addingNewComic) {
		var statements = [];
		for(var i = 0, len = strips.length; i < len; i++) {
			var strip = strips[i];
			if(!strip.strip) {
				throw ("Update failed: Strip ID not defined for a strip");
			}

			switch(parseInt(strip.action)) {
				case 1: // delete
					var deleteStrip = deleteStripStatement.clone();
					deleteStrip.params.comic = newComic.comic;
					deleteStrip.params.strip = strip.strip;
					statements.push(deleteStrip);
					break;

				default: // add/update
					// certain columns are not settable from the JSON
					strip.comic = newComic.comic;
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
					statements.push(updateStrip);
					break;
			}
		}

		// finally update comic updated time
		var updateComicUpdatedTime = updateComicUpdatedTimeStatement.clone();
		updateComicUpdatedTime.params.comic = newComic.comic;
		updateComicUpdatedTime.params.updated = updated;
		statements.push(updateComicUpdatedTime);

		DB.dbConn.executeAsync(statements, statements.length, {
			newComic: newComic,
			addingNewComic: addingNewComic,

			handleResult: function(response) {},
			handleError: function(error) {},
			handleCompletion: function(reason) {
				if(reason == DB.REASON_FINISHED) {
					ComicsResource.updateComic(this.newComic);
				}
				else {
					Utils.alert(Utils.getString("update.sqlError"));
				}

				_onStripsComplete(this.addingNewComic);
			}
		});
	}

	/*
	 * Handle what happens when all comics have finished updating
	 */
	function _onStripsComplete(addingNewComic) {
		var d = new Date();
		Prefs.set("lastSuccessfulUpdate", d.getTime() / 1000);
		Callback.callType("comicsChanged");

		if(!addingNewComic) {
			self.setAutoUpdateTimer();
		}
	}
}

