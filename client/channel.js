Faye.Channel = {
  HANDSHAKE:    '<%= Faye::Channel::HANDSHAKE %>',
  CONNECT:      '<%= Faye::Channel::CONNECT %>',
  SUBSCRIBE:    '<%= Faye::Channel::SUBSCRIBE %>',
  UNSUBSCRIBE:  '<%= Faye::Channel::UNSUBSCRIBE %>',
  DISCONNECT:   '<%= Faye::Channel::DISCONNECT %>',
  ECHO:         '<%= Faye::Channel::ECHO %>',
  
  META:         '<%= Faye::Channel::META %>',
  
  valid: function(name) {
    return Faye.Grammar.CHANNEL_NAME.test(name) ||
           Faye.Grammar.CHANNEL_PATTERN.test(name);
  },
  
  parse: function(name) {
    if (!this.valid(name)) return null;
    return name.split('/').slice(1);
  },
  
  meta: function(name) {
    var segments = this.parse(name);
    return segments ? (segments[0] === this.META) : null;
  },
  
  Tree: Faye.Class({
    initialize: function(value) {
      this.value = value;
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
    
    map: function(block, context) {
      var result = [];
      this.each([], function(path, value) {
        results.push(block.call(context, path, value));
      });
      return results;
    },
    
    get: function(name) {
      var tree = this.traverse(name);
      return tree ? tree.value : null;
    },
    
    set: function(name, value) {
      var subtree = this.traverse(name, true);
      if (subtree) subtree.value = value;
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
    
    glob: function(path) {
      var tree = this.traverse(path);
      return tree && tree.value ? [tree.value] : [];
    }
  })
};

