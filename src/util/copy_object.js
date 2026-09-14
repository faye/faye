'use strict';

var copyObject = function(object) {
  var clone, i;
  if (!object) return object;

  if (object instanceof Array) {
    clone = [];
    i = object.length;
    while (i--) clone[i] = copyObject(object[i]);
    return clone;
  } else if (typeof object === 'object') {
    clone = (object === null) ? null : {};
    for (let [key, value] of Object.entries(object)) {
      clone[key] = copyObject(value);
    }
    return clone;
  } else {
    return object;
  }
};

module.exports = copyObject;
