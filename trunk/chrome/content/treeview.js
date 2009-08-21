/*
Copyright (c) 2009 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/


var MozComics_TreeView = function(xulTree, table, xulVarPrefix) {
	this.xulTree = xulTree;
	this.table = table;
	this.rowCount = this.table.length;
	this.xulVarPrefix = xulVarPrefix;

	this.update();
}

MozComics_TreeView.prototype.getCellText = function(row, col) {
	return this.table[row][col.id.replace(this.xulVarPrefix, "")];
};
MozComics_TreeView.prototype.getCellValue = function(row, col) { return this.getCellText(row, col); };
MozComics_TreeView.prototype.setTree = function(treebox){ this.treebox = treebox; };
MozComics_TreeView.prototype.isContainer = function(row){ return false; };
MozComics_TreeView.prototype.isEditable = function(row, col) { return false; };
MozComics_TreeView.prototype.isSeparator = function(row){ return false; }
MozComics_TreeView.prototype.isSorted = function(){ return false; };
MozComics_TreeView.prototype.getLevel = function(row){ return 0; };
MozComics_TreeView.prototype.getImageSrc = function(row,col){ return null; };
MozComics_TreeView.prototype.getParentIndex = function(row) { return -1; };
MozComics_TreeView.prototype.getRowProperties = function(row,props) {};
MozComics_TreeView.prototype.getCellProperties = function(row,col,props) {};

MozComics_TreeView.prototype.getColumnProperties = function(colid,col,props){};
MozComics_TreeView.prototype.cycleHeader = function(col, elem) {};


// update tree with a specific sort
MozComics_TreeView.prototype.update = function(sortColumn) {
	var sortColumnId;
	var sortOrder = (this.xulTree.getAttribute("sortDirection") == "ascending") ? 1 : -1;

	//if the column is passed and it's already sorted by that column, reverse sort
	if(sortColumn) {
		sortColumnId = sortColumn.id;
		if (this.xulTree.getAttribute("sortResource") == sortColumnId) {
			sortOrder *= -1;
		}
	}
	else {
		sortColumnId = this.xulTree.getAttribute("sortResource");
	}

	var sortObjId = sortColumnId.replace(this.xulVarPrefix, "");
	function columnSortFunction(a, b) {
		if(a[sortObjId] > b[sortObjId]) return sortOrder;
		if(a[sortObjId] < b[sortObjId]) return -1 * sortOrder;

		// tiebreaker
		if(a.name > b.name) return 1;
		if(a.name < b.name) return -1;

		return 0;
	}

	this.table.sort(columnSortFunction);
	//setting these will make the sort option persist
	this.xulTree.setAttribute("sortDirection", sortOrder == 1 ? "ascending" : "descending");
	this.xulTree.setAttribute("sortResource", sortColumnId);
	this.xulTree.view = this;

	//set the appropriate attributes to show to indicator
	var cols = this.xulTree.getElementsByTagName("treecol");
	for (var i = 0; i < cols.length; i++) {
		cols[i].removeAttribute("sortDirection");
	}
	document.getElementById(sortColumnId).setAttribute("sortDirection", sortOrder == 1 ? "ascending" : "descending");
}

