/*
Copyright (c) 2009-2010 Ben Parr
Licensed under the MIT License: http://www.opensource.org/licenses/mit-license.php
*/

var EXPORTED_SYMBOLS = ["Callback"];

/*
 * Handle callback functions, so that chome code and resource module code
 * can be notified of changes.
 */
var Callback = new function() {
	this.addResource = addResource;
	this.add = add;
	this.remove = remove;
	this.getIds = getIds;
	this.callType = callType;

	// callback objects from resource code
	// used to notify resource code when Callback functions are called
	var resourceCallbacks = [];

	// callback objects for chrome code
	// these callbacks are identified by an id returned when added
	var callbacks = {};

	var nextCallbackId = 1;

	/*
	 * Add a callback object from a resource module
	 */
	function addResource(callback) {
		resourceCallbacks.push(callback);
	}

	/*
	 * Add a callback object from chrome code
	 */
	function add(callback) {
		var id = nextCallbackId++;
		callbacks[id] = callback;

		for(var i = 0, len = resourceCallbacks.length; i < len; i++) {
			resourceCallbacks[i].onAdd(id);
		}

		return id;
	}

	/*
	 * Remove a callback object from chrome code based on the id returned
	 * when the callback object was added
	 */
	function remove(id) {
		for(var i = 0, len = resourceCallbacks.length; i < len; i++) {
			resourceCallbacks[i].onRemove(id);
		}

		delete callbacks[id];
	}

	/*
	 * Get an array of the ids for callback objects for chrome code
	 */
	function getIds() {
		var ids = [];
		for(var id in callbacks) {
			ids.push(id);
		}
		return ids;
	}

	/*
	 * Call a certain callback function for all chrome callback objects
	 */
	function callType(type) {
		for(var i = 0, len = resourceCallbacks.length; i < len; i++) {
			resourceCallbacks[i].onCallType(type);
		}

		for(var id in callbacks) {
			callbacks[id][type]();
		}
	}
}

