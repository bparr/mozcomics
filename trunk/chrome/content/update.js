/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Update = new function() {

	this.init = init;
	this.updateAll = updateAll;
	this.update = update;

	function init() {
		this.defaultSite = 'http://localhost/mozcomics/update.php?'; // TODO change

		this.comicColumns = MozComics.DB.comicColumns;
		var comicParams = MozComics.DB._createParamsArray(this.comicColumns);
		this.comicPersistColumns = ["comic", "state"];
		
		// does not contain "read" or "user_rating" because those are set by the user
		this.stripColumns = ["comic", "strip", "title", "url", "image", "extra", "server_rating", "updated"];
		var stripParams = MozComics.DB._createParamsArray(this.stripColumns);

		this.getComicByGuid = MozComics.DB.dbConn.createStatement(
			"SELECT " + MozComics.DB.comicColumns.join(", ") + " FROM comic WHERE guid=:guid;");
		this.updateComic = MozComics.DB.dbConn.createStatement(
			"REPLACE INTO comic(" + this.comicColumns.join(", ") + ") VALUES (" + comicParams.join(", ") + ");"
		);
		this.updateStrip = MozComics.DB.dbConn.createStatement(
			"REPLACE INTO strip(" + this.stripColumns.join(", ") + ") VALUES (" + stripParams.join(", ") + ");"
		);
		this.deleteStrip = MozComics.DB.dbConn.createStatement(
			"DELETE FROM strip WHERE comic=:comic and strip=:strip;");
	}

	function updateAll() {
		var comics = new Array();
		for(comicId in MozComics.Comics.all) {
			comics.push(MozComics.Comics.all[comicId]);
		}
		this.update(comics);
	}

	// comics is an array whose members at least have guid, name, and updated
	function update(comics) {

		// group by update site to decrease number of requests
		var updateSites = {};
		for(var i = 0, len = comics.length; i < len; i++) {
			var site = comics[i].update_site;
			site = (site) ? site : this.defaultSite;
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

			var req = new XMLHttpRequest();
			req.open('GET', url, true);
			req.onreadystatechange = function (aEvt) {
				var req = aEvt.originalTarget;
				if (req.readyState == 4) {
					if(req.status == 200) {
						_onDownloadComplete(req);
					}
					else {
						alert(MozComics.getString("update.serverError"));
					}
				}
			};
			req.send(null);
		}
	}

	function _onDownloadComplete(req) {
		var self = MozComics.Update;

		try {
			var response = JSON.parse(req.responseText);
		}
		catch(err) {
			alert(MozComics.getString("update.invalidJson"));
			return;
		}

		for(var i = 0, len = response.comics.length; i < len; i++) {
			var comic = response.comics[i];
			if(!comic.guid) {
				throw ("Update failed: guid not defined for a comic");
			}

			comic.guid = comic.guid.toLowerCase();
			comic.comic = null;
			comic.updated = response.time;
			if(comic.extra) {
				comic.extra = JSON.stringify(comic.extra);
			}

			// save some states in the old comic so that they persist to the new one
			if(MozComics.Comics.guids[comic.guid]) {
				var oldComic = MozComics.Comics.guids[comic.guid];
				for(var j = 0, len2 = self.comicPersistColumns.length; i < len; i++) {
					var col = self.comicPersistColumns[j];
					comic[col] = oldComic[col];
				}
			}

			for(var col = 0, colLen = self.comicColumns.length; col < colLen; col++) {
				if(comic[self.comicColumns[col]]) {
					self.updateComic.params[self.comicColumns[col]] = comic[self.comicColumns[col]];
				}
			}

			self.updateComic.execute();

			// add the comic to the comic cache
			self.getComicByGuid.params.guid = comic.guid;
			self.getComicByGuid.executeStep();
			var newComic = new MozComics.Comic(self.getComicByGuid.row);
			MozComics.Comics.updateComic(newComic);
			self.getComicByGuid.reset();

			// add the comic's strips to the strip databases
			for(var j = 0, len2 = comic.strips.length; j < len2; j++) {
				var strip = comic.strips[j];
				if(!strip.strip) {
					throw ("Update failed: Strip ID not defined for a strip");
				}

				switch(parseInt(strip.action)) {
					case 1: // delete
						self.deleteStrip.params.comic = newComic.comic;
						self.deleteStrip.params.strip = strip.strip;
						self.deleteStrip.execute();
						break;

					default: // add/update
						strip.comic = newComic.comic;
						strip.updated = response.time;
						if(strip.extra) {
							strip.extra = JSON.stringify(strip.extra);
						}
						for(var col = 0, colLen = self.stripColumns.length; col < colLen; col++) {
							if(strip[self.stripColumns[col]]) {
								self.updateStrip.params[self.stripColumns[col]] = strip[self.stripColumns[col]];
							}
						}
						self.updateStrip.execute();
						break;
				}
			}
		}

		MozComics.ComicPicker.refreshTree();
	}
}
