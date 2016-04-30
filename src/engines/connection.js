'use strict';

var Class      = require('../util/class'),
    extend     = require('../util/extend'),
    Deferrable = require('../mixins/deferrable'),
    Timeouts   = require('../mixins/timeouts');

var Connection = Class({
  initialize: function(engine, id, options) {
    this._engine  = engine;
    this._id      = id;
    this._options = options;
    this._inbox   = [];
  },

  deliver: function(message) {
    delete message.clientId;
    if (this.socket) return this.socket.send(message);
    this._inbox.push(message);
    this._beginDeliveryTimeout();
  },

  connect: function(options, callback, context) {
    options = options || {};
    var timeout = (options.timeout !== undefined) ? options.timeout / 1000 : this._engine.timeout;

    this.setDeferredStatus('unknown');
    this.callback(callback, context);

    this._beginDeliveryTimeout();
    this._beginConnectionTimeout(timeout);
  },

  flush: function() {
    this.removeTimeout('connection');
    this.removeTimeout('delivery');

    this.setDeferredStatus('succeeded', this._inbox);
    this._inbox = [];

    if (!this.socket) this._engine.closeConnection(this._id);
  },

  _beginDeliveryTimeout: function() {
    if (this._inbox.length === 0) return;
    this.addTimeout('delivery', this._engine.MAX_DELAY, this.flush, this);
  },

  _beginConnectionTimeout: function(timeout) {
    this.addTimeout('connection', timeout, this.flush, this);
  }
});

extend(Connection.prototype, Deferrable);
extend(Connection.prototype, Timeouts);

module.exports = Connection;
