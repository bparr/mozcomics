/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["Update"];

Components.utils.import("resource://mozcomics/utils.js");
Components.utils.import("resource://mozcomics/db.js");
Components.utils.import("resource://mozcomics/comics.js");

var Update = new function() {
	this.updateAll = updateAll;
	this.update = update;


	var defaultSite = Utils.URLS.UPDATE;

	// does not contain "read" or "user_rating" because those are set by the user
	var stripColumns = ["comic", "strip", "title", "url", "image", "extra", "server_rating", "updated"];
	var stripParams = DB.createParamsArray(stripColumns);

	var getComicByGuidStatement = DB.dbConn.createStatement(
		"SELECT " + DB.comicColumns.join(", ") + " FROM comic WHERE guid=:guid;");
	var updateComicStatement = DB.dbConn.createStatement(
		"REPLACE INTO comic(" + DB.comicColumns.join(", ") + ") VALUES (" + DB.comicParams.join(", ") + ");"
	);
	var updateStripStatement = DB.dbConn.createStatement(
		"REPLACE INTO strip(" + stripColumns.join(", ") + ") VALUES (" + stripParams.join(", ") + ");"
	);
	var deleteStripStatement = DB.dbConn.createStatement(
		"DELETE FROM strip WHERE comic=:comic and strip=:strip;");


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

		// group by update site to decrease number of requests
		var updateSites = {};
		for(var i = 0, len = comics.length; i < len; i++) {
			var site = comics[i].update_site;
			site = (site) ? site : defaultSite;
			if(!updateSites[site]) {
				updateSites[site] = {};
				updateSites[site].guids = new Array();
				updateSites[site].updated = new Array();
			}
			updateSites[site].guids.push(comics[i].guid);
			updateSites[site].updated.push(comics[i].updated);
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

	function _onDownloadComplete(req, addingNewComic) {
		try {
			var response = JSON.parse(req.responseText);
		}
		catch(err) {
			Utils.alert(Utils.getString("update.invalidJson"));
			return;
		}

		if(addingNewComic && response.comics.length > 1) {
			throw ("Update failed: suspected foul play with update site");
		}

		for(var i = 0, len = response.comics.length; i < len; i++) {
			var comic = response.comics[i];
			if(!comic.guid) {
				throw ("Update failed: guid not defined for a comic");
			}

			comic.guid = comic.guid.toLowerCase();
			comic.comic = null;
			comic.state = null;
			comic.updated = response.time;
			if(comic.extra) {
				comic.extra = JSON.stringify(comic.extra);
			}

			// save some states in the old comic so that they persist to the new one
			var oldComic = ComicsResource.guids[comic.guid];
			if(oldComic) {
				comic.comic = oldComic.comic;
				comic.state = oldComic.state;
			}
			else if(!addingNewComic) {
				throw ("Update failed: suspected foul play with update site");
			}

			var updateComic = updateComicStatement.clone();
			for(var col = 0, colLen = DB.comicColumns.length; col < colLen; col++) {
				var columnName = DB.comicColumns[col];
				if(comic[columnName]) {
					updateComic.params[columnName] = comic[columnName];
				}
			}

			// add the comic to the comic cache
			var getComicByGuid = getComicByGuidStatement.clone();
			getComicByGuid.params.guid = comic.guid;

			DB.dbConn.executeAsync([updateComic, getComicByGuid], 2, {
				row: null,
				comic: null,
				strips: comic.strips,

				handleResult: function(response) {
					this.row = response.getNextRow();
					this.comic = this.row.getResultByName("comic");
					ComicsResource.updateComic(DB.cloneRow(this.row, DB.comicColumns));
					var stripStatements = [];

					// add the comic's strips to the strip databases
					for(var j = 0, len2 = this.strips.length; j < len2; j++) {
						var strip = this.strips[j];
						if(!strip.strip) {
							throw ("Update failed: Strip ID not defined for a strip");
						}

						switch(parseInt(strip.action)) {
							case 1: // delete
								var deleteStrip = deleteStripStatement.clone();
								deleteStrip.params.comic = this.comic;
								deleteStrip.params.strip = strip.strip;
								stripStatements.push(deleteStrip);
								break;

							default: // add/update
								strip.comic = this.comic;
								strip.updated = response.time;
								if(strip.extra) {
									strip.extra = JSON.stringify(strip.extra);
								}

								var updateStrip = updateStripStatement.clone();
								for(var col = 0, colLen = stripColumns.length; col < colLen; col++) {
									if(strip[stripColumns[col]]) {
										updateStrip.params[stripColumns[col]] = strip[stripColumns[col]];
									}
								}
								stripStatements.push(updateStrip);
								break;
						}
					}

					DB.dbConn.executeAsync(stripStatements, stripStatements.length, {
						handleResult: function(resultSet) {},
						handleError: function(error) {},
						handleCompletion: function(reason) {
							if(reason == DB.REASON_FINISHED) {
								if(addingNewComic) {
									ComicsResource.callCallbacks();
								}
							}
							else {
								Utils.alert(Utils.getString("update.sqlError"));
							}
						}
					});
				},
				handleError: function(error) {},
				handleCompletion: function(reason) {}
			});
		}
	}
}

