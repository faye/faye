'use strict';

var array = require('./array');

module.exports = function(options, validKeys) {
  for (let key of Object.keys(options)) {
    if (array.indexOf(validKeys, key) < 0) {
      throw new Error('Unrecognized option: ' + key);
    }
  }
};
