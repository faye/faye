'use strict';

var array = require('./array');

module.exports = function(messages) {
  var connect = array.filter([].concat(messages), function(message) {
    return message.channel === '/meta/connect';
  });
  return connect[0] && connect[0].clientId;
};
