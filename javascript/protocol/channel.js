Faye.Channel = Faye.Class({
  initialize: function(name) {
    this.id = this.name = name;
  },

  push: function(message) {
    this.trigger('message', message);
  },

  isUnused: function() {
    return this.countListeners('message') === 0;
  }
});

Faye.extend(Faye.Channel.prototype, Faye.Publisher);

Faye.extend(Faye.Channel, {
  HANDSHAKE:    '/meta/handshake',
  CONNECT:      '/meta/connect',
  SUBSCRIBE:    '/meta/subscribe',
  UNSUBSCRIBE:  '/meta/unsubscribe',
  DISCONNECT:   '/meta/disconnect',

  META:         'meta',
  SERVICE:      'service',

  expand: function(name) {
    var segments = this.parse(name),
        channels = ['/**', name];

    var copy = segments.slice();
    copy[copy.length - 1] = '*';
    channels.push(this.unparse(copy));

    for (var i = 1, n = segments.length; i < n; i++) {
      copy = segments.slice(0, i);
      copy.push('**');
      channels.push(this.unparse(copy));
    }

    return channels;
  },

  isValid: function(name) {
    return Faye.Grammar.CHANNEL_NAME.test(name) ||
           Faye.Grammar.CHANNEL_PATTERN.test(name);
  },

  parse: function(name) {
    if (!this.isValid(name)) return null;
    return name.split('/').slice(1);
  },

  unparse: function(segments) {
    return '/' + segments.join('/');
  },

  isMeta: function(name) {
    var segments = this.parse(name);
    return segments ? (segments[0] === this.META) : null;
  },

  isService: function(name) {
    var segments = this.parse(name);
    return segments ? (segments[0] === this.SERVICE) : null;
  },

  isSubscribable: function(name) {
    if (!this.isValid(name)) return null;
    return !this.isMeta(name) && !this.isService(name);
  },

  Set: Faye.Class({
    initialize: function() {
      this._channels = {};
    },

    getKeys: function() {
      var keys = [];
      for (var key in this._channels) keys.push(key);
      return keys;
    },

    remove: function(name) {
      delete this._channels[name];
    },

    hasSubscription: function(name) {
      return this._channels.hasOwnProperty(name);
    },

    subscribe: function(names, callback, context) {
      var name;
      for (var i = 0, n = names.length; i < n; i++) {
        name = names[i];
        var channel = this._channels[name] = this._channels[name] || new Faye.Channel(name);
        if (callback) channel.bind('message', callback, context);
      }
    },

    unsubscribe: function(name, callback, context) {
      var channel = this._channels[name];
      if (!channel) return false;
      channel.unbind('message', callback, context);

      if (channel.isUnused()) {
        this.remove(name);
        return true;
      } else {
        return false;
      }
    },

    distributeMessage: function(message) {
      var channels = Faye.Channel.expand(message.channel);

      for (var i = 0, n = channels.length; i < n; i++) {
        var channel = this._channels[channels[i]];
        if (channel) channel.trigger('message', message.data, message.channel);
      }
    }
  })
});
