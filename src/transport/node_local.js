'use strict';

var asap       = require('asap'),
    Class      = require('../util/class'),
    URI        = require('../util/uri'),
    copyObject = require('../util/copy_object'),
    extend     = require('../util/extend'),
    Server     = require('../protocol/server'),
    Transport  = require('./transport');

var NodeLocal = extend(Class(Transport, {
  batching: false,

  request: function(messages) {
    messages = copyObject(messages);
    var self = this;

    asap(function() {
      self.endpoint.process(messages, null, function(replies) {
        self._receive(copyObject(replies));
      });
    });
  }
}), {
  isUsable: function(client, endpoint, callback, context) {
    callback.call(context, endpoint instanceof Server);
  }
});

module.exports = NodeLocal;
