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
        list.pop();
        return list;
      }
      
      Faye.each(this._children, function(key, subtree) {
        if (key !== path[0] && key !== '*') return;
        var sublist = subtree.glob(path.slice(1));
        Faye.each(sublist, function(channel) { list.push(channel) });
      });
      
      if (this._children['**']) list.push(this._children['**']._value);
      return list;
    }
    
    /**
      Tests
      
      glob = new Faye.Channel.Tree();
      list = '/foo/bar /foo/boo /foo /foobar /foo/bar/boo /foobar/boo /foo/* /foo/**'.split(' ');

      Faye.each(list, function(c, i) {
          glob.set(c, i + 1);
      });

      console.log(glob.glob('/foo/*').sort());        // 1,2,7,8
      console.log(glob.glob('/foo/bar').sort());      // 1,7,8
      console.log(glob.glob('/foo/**').sort());       // 1,2,5,7,8
      console.log(glob.glob('/foo/bar/boo').sort());  // 5,8
    **/
  })
};

