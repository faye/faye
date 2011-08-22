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
  HANDSHAKE:    '<%= Faye::Channel::HANDSHAKE %>',
  CONNECT:      '<%= Faye::Channel::CONNECT %>',
  SUBSCRIBE:    '<%= Faye::Channel::SUBSCRIBE %>',
  UNSUBSCRIBE:  '<%= Faye::Channel::UNSUBSCRIBE %>',
  DISCONNECT:   '<%= Faye::Channel::DISCONNECT %>',
  
  META:         '<%= Faye::Channel::META %>',
  SERVICE:      '<%= Faye::Channel::SERVICE %>',
  
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
      Faye.each(this._channels, function(k,v) { keys.push(k) });
      return keys;
    },
    
    remove: function(name) {
      delete this._channels[name];
    },
    
    hasSubscription: function(name) {
      return this._channels.hasOwnProperty(name);
    },
    
    subscribe: function(names, callback, scope) {
      if (!callback) return;
      Faye.each(names, function(name) {
        var channel = this._channels[name] = this._channels[name] || new Faye.Channel(name);
        channel.bind('message', callback, scope);
      }, this);
    },
    
    unsubscribe: function(name, callback, scope) {
      var channel = this._channels[name];
      if (!channel) return false;
      channel.unbind('message', callback, scope);
      
      if (channel.isUnused()) {
        this.remove(name);
        return true;
      } else {
        return false;
      }
    },
    
    distributeMessage: function(message) {
      var channels = Faye.Channel.expand(message.channel);
      Faye.each(channels, function(name) {
        var channel = this._channels[name];
        if (channel) channel.trigger('message', message.data);
      }, this);
    }
  })
});

