Faye.Channel = Faye.Class({
  initialize: function(name) {
    this.__id = this.name = name;
  },
  
  push: function(message) {
    this.publishEvent('message', message);
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
  
  isValid: function(name) {
    return Faye.Grammar.CHANNEL_NAME.test(name) ||
           Faye.Grammar.CHANNEL_PATTERN.test(name);
  },
  
  parse: function(name) {
    if (!this.isValid(name)) return null;
    return name.split('/').slice(1);
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
  
  Tree: Faye.Class({
    initialize: function(value) {
      this._value = value;
      this._children = {};
    },
    
    eachChild: function(block, context) {
      Faye.each(this._children, function(key, subtree) {
        block.call(context, key, subtree);
      });
    },
    
    each: function(prefix, block, context) {
      this.eachChild(function(path, subtree) {
        path = prefix.concat(path);
        subtree.each(path, block, context);
      });
      if (this._value !== undefined) block.call(context, prefix, this._value);
    },
    
    getKeys: function() {
      return this.map(function(key, value) { return '/' + key.join('/') });
    },
    
    map: function(block, context) {
      var result = [];
      this.each([], function(path, value) {
        result.push(block.call(context, path, value));
      });
      return result;
    },
    
    get: function(name) {
      var tree = this.traverse(name);
      return tree ? tree._value : null;
    },
    
    set: function(name, value) {
      var subtree = this.traverse(name, true);
      if (subtree) subtree._value = value;
    },
    
    traverse: function(path, createIfAbsent) {
      if (typeof path === 'string') path = Faye.Channel.parse(path);
      
      if (path === null) return null;
      if (path.length === 0) return this;
      
      var subtree = this._children[path[0]];
      if (!subtree && !createIfAbsent) return null;
      if (!subtree) subtree = this._children[path[0]] = new Faye.Channel.Tree();
      
      return subtree.traverse(path.slice(1), createIfAbsent);
    },
    
    findOrCreate: function(channel) {
      var existing = this.get(channel);
      if (existing) return existing;
      existing = new Faye.Channel(channel);
      this.set(channel, existing);
      return existing;
    },
    
    glob: function(path) {
      if (typeof path === 'string') path = Faye.Channel.parse(path);
      
      if (path === null) return [];
      if (path.length === 0) return (this._value === undefined) ? [] : [this._value];
      
      var list = [];
      
      if (Faye.enumEqual(path, ['*'])) {
        Faye.each(this._children, function(key, subtree) {
          if (subtree._value !== undefined) list.push(subtree._value);
        });
        return list;
      }
      
      if (Faye.enumEqual(path, ['**'])) {
        list = this.map(function(key, value) { return value });
        if (this._value !== undefined) list.pop();
        return list;
      }
      
      Faye.each(this._children, function(key, subtree) {
        if (key !== path[0] && key !== '*') return;
        var sublist = subtree.glob(path.slice(1));
        Faye.each(sublist, function(channel) { list.push(channel) });
      });
      
      if (this._children['**']) list.push(this._children['**']._value);
      return list;
    },
    
    subscribe: function(names, callback, scope) {
      if (!callback) return;
      Faye.each(names, function(name) {
        var channel = this.findOrCreate(name);
        channel.addSubscriber('message', callback, scope);
      }, this);
    },
    
    unsubscribe: function(names, callback, scope) {
      var deadChannels = [];
      
      Faye.each(names, function(name) {
        var channel = this.get(name);
        if (!channel) return;
        channel.removeSubscriber('message', callback, scope);
        if (channel.countSubscribers('message') === 0) deadChannels.push(name);
      }, this);
      
      return deadChannels;
    },
    
    distributeMessage: function(message) {
      var channels = this.glob(message.channel);
      Faye.each(channels, function(channel) { channel.publishEvent('message', message.data) });
    }
  })
});

