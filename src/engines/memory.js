'use strict';

var copyObject = require('../util/copy_object'),
    Namespace  = require('../util/namespace'),
    Set        = require('../util/set'),
    Timeouts   = require('../mixins/timeouts');

var Memory = function(server, options) {
  this._server    = server;
  this._options   = options || {};
  this.reset();
};

Memory.create = function(server, options) {
  return new Memory(server, options);
};

Memory.prototype = {
  disconnect: function() {
    this.reset();
    this.removeAllTimeouts();
  },

  reset: function() {
    this._namespace = new Namespace();
    this._clients   = new Map();
    this._channels  = new Map();
    this._messages  = new Map();
  },

  createClient: function(callback, context) {
    var clientId = this._namespace.generate();
    this._server.debug('Created new client ?', clientId);
    this.ping(clientId);
    this._server.trigger('handshake', clientId);
    callback.call(context, clientId);
  },

  destroyClient: function(clientId, callback, context) {
    if (!this._namespace.exists(clientId)) return;
    var clients = this._clients;

    if (this._clients.has(clientId)) {
      for (let channel of this._clients.get(clientId)) {
        this.unsubscribe(clientId, channel);
      }
    }

    this.removeTimeout(clientId);
    this._namespace.release(clientId);
    this._messages.delete(clientId);
    this._server.debug('Destroyed client ?', clientId);
    this._server.trigger('disconnect', clientId);
    this._server.trigger('close', clientId);
    if (callback) callback.call(context);
  },

  clientExists: function(clientId, callback, context) {
    callback.call(context, this._namespace.exists(clientId));
  },

  ping: function(clientId) {
    var timeout = this._server.timeout;
    if (typeof timeout !== 'number') return;

    this._server.debug('Ping ?, ?', clientId, timeout);
    this.removeTimeout(clientId);
    this.addTimeout(clientId, 2 * timeout, function() {
      this.destroyClient(clientId);
    }, this);
  },

  subscribe: function(clientId, channel, callback, context) {
    var clients = this._clients, channels = this._channels;

    if (!clients.has(clientId)) clients.set(clientId, new Set());
    var trigger = clients.get(clientId).add(channel);

    if (!channels.has(channel)) channels.set(channel, new Set());
    channels.get(channel).add(clientId);

    this._server.debug('Subscribed client ? to channel ?', clientId, channel);
    if (trigger) this._server.trigger('subscribe', clientId, channel);
    if (callback) callback.call(context, true);
  },

  unsubscribe: function(clientId, channel, callback, context) {
    var clients  = this._clients,
        channels = this._channels,
        trigger  = false;

    if (clients.has(clientId)) {
      trigger = clients.get(clientId).remove(channel);
      if (clients.get(clientId).isEmpty()) clients.delete(clientId);
    }

    if (channels.has(channel)) {
      channels.get(channel).remove(clientId);
      if (channels.get(channel).isEmpty()) channels.delete(channel);
    }

    this._server.debug('Unsubscribed client ? from channel ?', clientId, channel);
    if (trigger) this._server.trigger('unsubscribe', clientId, channel);
    if (callback) callback.call(context, true);
  },

  publish: function(message, channels) {
    this._server.debug('Publishing message ?', message);

    var messages = this._messages,
        clients  = new Set(),
        subs;

    for (let channel of channels) {
      subs = this._channels.get(channel);
      if (!subs) continue;

      for (let sub of subs) {
        clients.add(sub);
      }
    }

    for (let clientId of clients) {
      this._server.debug('Queueing for client ?: ?', clientId, message);
      if (!messages.has(clientId)) messages.set(clientId, []);
      messages.get(clientId).push(copyObject(message));
      this.emptyQueue(clientId);
    }

    this._server.trigger('publish', message.clientId, message.channel, message.data);
  },

  emptyQueue: function(clientId) {
    if (!this._server.hasConnection(clientId)) return;
    this._server.deliver(clientId, this._messages.get(clientId));
    this._messages.delete(clientId);
  }
};

Object.assign(Memory.prototype, Timeouts);

module.exports = Memory;
