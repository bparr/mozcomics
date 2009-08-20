/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

MozComics.Update = new function() {
	var self = this;

	this.defaultSite = 'http://localhost/mozcomics/update.php?'; // TODO change

	this.COMIC_PERSIST_COLUMNS = ["state"];

	this.updateAll = updateAll;
	this.update = update;

	function updateAll() {
		var comics = new Array();
		for(comicId in MozComics.Comics.all) {
			comics.push(MozComics.Comics.all[comicId]);
		}
		this.update(comics);
	}

	// ids is an array of comic ids to be updated
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
		try {
			var response = JSON.parse(req.responseText);
		}
		catch(err) {
			alert(MozComics.getString("update.invalidJson"));
			return;
		}

		var comicColumns = MozComics.DB.comicColumns;
		var stripColumns = MozComics.DB.updateStripColumns;
		for(var i = 0, len = response.comics.length; i < len; i++) {
			var comic = response.comics[i];
			if(!comic.guid) {
				throw ("Update failed: guid not defined for a comic");
			}

			comic.guid = comic.guid.toLowerCase();
			comic.comic = _getComicIdFromGuid(comic.guid);
			comic.updated = response.time;
			if(comic.extra) {
				comic.extra = JSON.stringify(comic.extra);
			}

			if(MozComics.Comics.guids[comic.guid]) {
				var oldComic = MozComics.Comics.guids[comic.guid];
				for(var j = 0, len2 = self.COMIC_PERSIST_COLUMNS.length; i < len; i++) {
					var col = self.COMIC_PERSIST_COLUMNS[j];
					comic[col] = oldComic[col];
				}
			}

			for(var col = 0, colLen = comicColumns.length; col < colLen; col++) {
				if(comic[comicColumns[col]]) {
					MozComics.DB.updateComicStatement.params[comicColumns[col]] = comic[comicColumns[col]];
				}
			}

			MozComics.DB.updateComicStatement.execute();

			// add the comic to the comic cache
			MozComics.DB.getComicFromGuidStatement.params.guid = comic.guid;
			MozComics.DB.getComicFromGuidStatement.executeStep();
			var newComic = new MozComics.Comic(MozComics.DB.getComicFromGuidStatement.row);
			MozComics.Comics.updateComic(newComic);
			MozComics.DB.getComicFromGuidStatement.reset();

			// add the comic's strips to the strip databases
			for(var j = 0, len2 = comic.strips.length; j < len2; j++) {
				var strip = comic.strips[j];
				if(!strip.strip) {
					throw ("Update failed: Strip ID not defined for a strip");
				}

				switch(parseInt(strip.action)) {
					case 1: // delete
						MozComics.DB.deleteStripStatement.params.comic = newComic.comic;
						MozComics.DB.deleteStripStatement.params.strip = strip.strip;
						MozComics.DB.deleteStripStatement.execute();
						break;

					default: // add/update
						strip.comic = newComic.comic;
						strip.updated = response.time;
						if(strip.extra) {
							strip.extra = JSON.stringify(strip.extra);
						}
						for(var col = 0, colLen = stripColumns.length; col < colLen; col++) {
							if(strip[stripColumns[col]]) {
								MozComics.DB.updateStripStatement.params[stripColumns[col]] = strip[stripColumns[col]];
							}
						}
						MozComics.DB.updateStripStatement.execute();
						break;
				}
			}
		}

		MozComics.ComicPicker.refreshTree();
	}


	function _getComicIdFromGuid(guid) {
		MozComics.DB.getComicIdFromGuidStatement.params.guid = guid;
		var comic = null;
		if(MozComics.DB.getComicIdFromGuidStatement.executeStep()) {
			comic = MozComics.DB.getComicIdFromGuidStatement.row.comic;
		}
		MozComics.DB.getComicIdFromGuidStatement.reset();
		return comic;
	}
}
