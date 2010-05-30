if (!this.Faye) Faye = {};

Faye.extend = function(dest, source, overwrite) {
  if (!source) return dest;
  for (var key in source) {
    if (!source.hasOwnProperty(key)) continue;
    if (dest.hasOwnProperty(key) && overwrite === false) continue;
    if (dest[key] !== source[key])
      dest[key] = source[key];
  }
  return dest;
};

Faye.extend(Faye, {
  VERSION:          '0.3.2',
  
  BAYEUX_VERSION:   '1.0',
  ID_LENGTH:        128,
  JSONP_CALLBACK:   'jsonpcallback',
  CONNECTION_TYPES: ["long-polling", "callback-polling"],
  
  ENV:              this,
  
  random: function(bitlength) {
    bitlength = bitlength || this.ID_LENGTH;
    if (bitlength > 32) {
      var parts  = Math.ceil(bitlength / 32),
          string = '';
      while (parts--) string += this.random(32);
      return string;
    }
    var field = Math.pow(2, bitlength);
    return Math.floor(Math.random() * field).toString(16);
  },
  
  Grammar: {

    LOWALPHA:     /^[a-z]$/,

    UPALPHA:     /^[A-Z]$/,

    ALPHA:     /^([a-z]|[A-Z])$/,

    DIGIT:     /^[0-9]$/,

    ALPHANUM:     /^(([a-z]|[A-Z])|[0-9])$/,

    MARK:     /^(\-|\_|\!|\~|\(|\)|\$|\@)$/,

    STRING:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*$/,

    TOKEN:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+$/,

    INTEGER:     /^([0-9])+$/,

    CHANNEL_SEGMENT:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+$/,

    CHANNEL_SEGMENTS:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+(\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+)*$/,

    CHANNEL_NAME:     /^\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+(\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+)*$/,

    WILD_CARD:     /^\*{1,2}$/,

    CHANNEL_PATTERN:     /^(\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+)*\/\*{1,2}$/,

    VERSION_ELEMENT:     /^(([a-z]|[A-Z])|[0-9])(((([a-z]|[A-Z])|[0-9])|\-|\_))*$/,

    VERSION:     /^([0-9])+(\.(([a-z]|[A-Z])|[0-9])(((([a-z]|[A-Z])|[0-9])|\-|\_))*)*$/,

    CLIENT_ID:     /^((([a-z]|[A-Z])|[0-9]))+$/,

    ID:     /^((([a-z]|[A-Z])|[0-9]))+$/,

    ERROR_MESSAGE:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*$/,

    ERROR_ARGS:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*(,(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*)*$/,

    ERROR_CODE:     /^[0-9][0-9][0-9]$/,

    ERROR:     /^([0-9][0-9][0-9]:(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*(,(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*)*:(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*|[0-9][0-9][0-9]::(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*)$/

  },
  
  commonElement: function(lista, listb) {
    for (var i = 0, n = lista.length; i < n; i++) {
      if (this.indexOf(listb, lista[i]) !== -1)
        return lista[i];
    }
    return null;
  },
  
  indexOf: function(list, needle) {
    for (var i = 0, n = list.length; i < n; i++) {
      if (list[i] === needle) return i;
    }
    return -1;
  },
  
  each: function(object, callback, scope) {
    if (object instanceof Array) {
      for (var i = 0, n = object.length; i < n; i++) {
        if (object[i] !== undefined)
          callback.call(scope || null, object[i], i);
      }
    } else {
      for (var key in object) {
        if (object.hasOwnProperty(key))
          callback.call(scope || null, key, object[key]);
      }
    }
  },
  
  filter: function(array, callback, scope) {
    var result = [];
    this.each(array, function() {
      if (callback.apply(scope, arguments))
        result.push(arguments[0]);
    });
    return result;
  },
  
  size: function(object) {
    var size = 0;
    this.each(object, function() { size += 1 });
    return size;
  },
  
  enumEqual: function(actual, expected) {
    if (expected instanceof Array) {
      if (!(actual instanceof Array)) return false;
      var i = actual.length;
      if (i !== expected.length) return false;
      while (i--) {
        if (actual[i] !== expected[i]) return false;
      }
      return true;
    } else {
      if (!(actual instanceof Object)) return false;
      if (this.size(expected) !== this.size(actual)) return false;
      var result = true;
      this.each(actual, function(key, value) {
        result = result && (expected[key] === value);
      });
      return result;
    }
  },
  
  // http://assanka.net/content/tech/2009/09/02/json2-js-vs-prototype/
  toJSON: function(object) {
    if (this.stringify)
      return this.stringify(object, function(key, value) {
        return (this[key] instanceof Array)
            ? this[key]
            : value;
      });
    
    return JSON.stringify(object);
  },
  
  timestamp: function() {
    var date   = new Date(),
        year   = date.getFullYear(),
        month  = date.getMonth() + 1,
        day    = date.getDate(),
        hour   = date.getHours(),
        minute = date.getMinutes(),
        second = date.getSeconds();
    
    var pad = function(n) {
      return n < 10 ? '0' + n : String(n);
    };
    
    return pad(year) + '-' + pad(month) + '-' + pad(day) + ' ' +
           pad(hour) + ':' + pad(minute) + ':' + pad(second);
  }
});


Faye.Class = function(parent, methods) {
  if (typeof parent !== 'function') {
    methods = parent;
    parent  = Object;
  }
  
  var klass = function() {
    if (!this.initialize) return this;
    return this.initialize.apply(this, arguments) || this;
  };
  
  var bridge = function() {};
  bridge.prototype = parent.prototype;
  
  klass.prototype = new bridge();
  Faye.extend(klass.prototype, methods);
  
  return klass;
};


Faye.Deferrable = {
  callback: function(callback, scope) {
    if (this._deferredStatus === 'succeeded')
      return callback.apply(scope, this._deferredArgs);
    
    this._waiters = this._waiters || [];
    this._waiters.push([callback, scope]);
  },
  
  setDeferredStatus: function() {
    var args = Array.prototype.slice.call(arguments),
        status = args.shift();
    
    this._deferredStatus = status;
    this._deferredArgs = args;
    
    if (status !== 'succeeded') return;
    if (!this._waiters) return;
    
    Faye.each(this._waiters, function(callback) {
      callback[0].apply(callback[1], this._deferredArgs);
    }, this);
    
    this._waiters = [];
  }
};


Faye.Observable = {
  on: function(eventType, block, scope) {
    this._observers = this._observers || {};
    var list = this._observers[eventType] = this._observers[eventType] || [];
    list.push([block, scope]);
  },
  
  stopObserving: function(eventType, block, scope) {
    if (!this._observers || !this._observers[eventType]) return;
    
    if (!block) {
      delete this._observers[eventType];
      return;
    }
    var list = this._observers[eventType],
        i    = list.length;
    
    while (i--) {
      if (block && list[i][0] !== block) continue;
      if (scope && list[i][1] !== scope) continue;
      list.splice(i,1);
    }
  },
  
  trigger: function() {
    var args = Array.prototype.slice.call(arguments),
        eventType = args.shift();
    
    if (!this._observers || !this._observers[eventType]) return;
    
    Faye.each(this._observers[eventType], function(listener) {
      listener[0].apply(listener[1], args.slice());
    });
  }
};


Faye.Logging = {
  LOG_LEVELS: {
    error:  3,
    warn:   2,
    info:   1,
    debug:  0
  },
  
  logLevel: 'error',
  
  log: function(messageArgs, level) {
    if (!Faye.logger) return;
    
    var levels = Faye.Logging.LOG_LEVELS;
    if (levels[Faye.Logging.logLevel] > levels[level]) return;
    
    var messageArgs = Array.prototype.slice.apply(messageArgs),
        banner = ' [' + level.toUpperCase() + '] [Faye',
        klass  = null,
        
        message = messageArgs.shift().replace(/\?/g, function() {
          return Faye.toJSON(messageArgs.shift());
        });
    
    for (var key in Faye) {
      if (klass) continue;
      if (typeof Faye[key] !== 'function') continue;
      if (this instanceof Faye[key]) klass = key;
    }
    if (klass) banner += '.' + klass;
    banner += '] ';
    
    Faye.logger(Faye.timestamp() + banner + message);
  }
};

Faye.each(Faye.Logging.LOG_LEVELS, function(level, value) {
  Faye.Logging[level] = function() {
    this.log(arguments, level);
  };
});


Faye.Timeouts = {
  addTimeout: function(name, delay, callback, scope) {
    this._timeouts = this._timeouts || {};
    if (this._timeouts.hasOwnProperty(name)) return;
    var self = this;
    this._timeouts[name] = setTimeout(function() {
      delete self._timeouts[name];
      callback.call(scope);
    }, 1000 * delay);
  },
  
  removeTimeout: function(name) {
    this._timeouts = this._timeouts || {};
    var timeout = this._timeouts[name];
    if (!timeout) return;
    clearTimeout(timeout);
    delete this._timeouts[name];
  }
};


Faye.Channel = Faye.Class({
  initialize: function(name) {
    this.__id = this.name = name;
  },
  
  push: function(message) {
    this.trigger('message', message);
  }
});

Faye.extend(Faye.Channel.prototype, Faye.Observable);

Faye.extend(Faye.Channel, {
  HANDSHAKE:    '/meta/handshake',
  CONNECT:      '/meta/connect',
  SUBSCRIBE:    '/meta/subscribe',
  UNSUBSCRIBE:  '/meta/unsubscribe',
  DISCONNECT:   '/meta/disconnect',
  
  META:         'meta',
  SERVICE:      'service',
  
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
    }
  })
});


Faye.Namespace = Faye.Class({
  initialize: function() {
    this._used = {};
  },
  
  generate: function() {
    var name = Faye.random();
    while (this._used.hasOwnProperty(name))
      name = Faye.random();
    return this._used[name] = name;
  }
});


Faye.Transport = Faye.extend(Faye.Class({
  initialize: function(client, endpoint) {
    this.debug('Created new transport for ?', endpoint);
    this._client   = client;
    this._endpoint = endpoint;
  },
  
  send: function(message, callback, scope) {
    if (!(message instanceof Array) && !message.id)
      message.id = this._client._namespace.generate();
    
    this.debug('Client ? sending message to ?: ?',
               this._client._clientId, this._endpoint, message);
    
    this.request(message, function(responses) {
      this.debug('Client ? received from ?: ?',
                 this._client._clientId, this._endpoint, responses);
      
      if (!callback) return;
      
      var messages = [], deliverable = true;
      Faye.each([].concat(responses), function(response) {
    
        if (response.id === message.id) {
          if (callback.call(scope, response) === false)
            deliverable = false;
        }
        
        if (response.advice)
          this._client.handleAdvice(response.advice);
        
        if (response.data && response.channel)
          messages.push(response);
        
      }, this);
      
      if (deliverable) this._client.deliverMessages(messages);
    }, this);
  }
}), {
  get: function(client, connectionTypes) {
    var endpoint = client._endpoint;
    if (connectionTypes === undefined) connectionTypes = this.supportedConnectionTypes();
    
    var candidateClass = null;
    Faye.each(this._transports, function(connType, klass) {
      if (Faye.indexOf(connectionTypes, connType) < 0) return;
      if (candidateClass) return;
      if (klass.isUsable(endpoint)) candidateClass = klass;
    });
    
    if (!candidateClass) throw 'Could not find a usable connection type for ' + endpoint;
    
    return new candidateClass(client, endpoint);
  },
  
  register: function(type, klass) {
    this._transports[type] = klass;
    klass.prototype.connectionType = type;
  },
  
  _transports: {},
  
  supportedConnectionTypes: function() {
    var list = [], key;
    Faye.each(this._transports, function(key, type) { list.push(key) });
    return list;
  }
});

Faye.extend(Faye.Transport.prototype, Faye.Logging);


Faye.Client = Faye.Class({
  UNCONNECTED:          1,
  CONNECTING:           2,
  CONNECTED:            3,
  DISCONNECTED:         4,
  
  HANDSHAKE:            'handshake',
  RETRY:                'retry',
  NONE:                 'none',
  
  CONNECTION_TIMEOUT:   60.0,
  
  DEFAULT_ENDPOINT:     '/bayeux',
  MAX_DELAY:            0.1,
  INTERVAL:             1000.0,
  
  initialize: function(endpoint, options) {
    this.info('New client created for ?', endpoint);
    
    this._endpoint  = endpoint || this.DEFAULT_ENDPOINT;
    this._options   = options || {};
    this._timeout   = this._options.timeout || this.CONNECTION_TIMEOUT;
    
    this._transport = Faye.Transport.get(this);
    this._state     = this.UNCONNECTED;
    this._namespace = new Faye.Namespace();
    this._outbox    = [];
    this._channels  = new Faye.Channel.Tree();
    
    this._advice = {reconnect: this.RETRY, interval: this.INTERVAL};
    
    if (Faye.Event) Faye.Event.on(Faye.ENV, 'beforeunload',
                                  this.disconnect, this);
  },
  
  // Request
  // MUST include:  * channel
  //                * version
  //                * supportedConnectionTypes
  // MAY include:   * minimumVersion
  //                * ext
  //                * id
  // 
  // Success Response                             Failed Response
  // MUST include:  * channel                     MUST include:  * channel
  //                * version                                    * successful
  //                * supportedConnectionTypes                   * error
  //                * clientId                    MAY include:   * supportedConnectionTypes
  //                * successful                                 * advice
  // MAY include:   * minimumVersion                             * version
  //                * advice                                     * minimumVersion
  //                * ext                                        * ext
  //                * id                                         * id
  //                * authSuccessful
  handshake: function(callback, scope) {
    if (this._advice.reconnect === this.NONE) return;
    if (this._state !== this.UNCONNECTED) return;
    
    this._state = this.CONNECTING;
    var self = this;
    
    this.info('Initiating handshake with ?', this._endpoint);
    
    this._transport.send({
      channel:      Faye.Channel.HANDSHAKE,
      version:      Faye.BAYEUX_VERSION,
      supportedConnectionTypes: Faye.Transport.supportedConnectionTypes()
      
    }, function(response) {
      
      if (response.successful) {
        this._state     = this.CONNECTED;
        this._clientId  = response.clientId;
        this._transport = Faye.Transport.get(this, response.supportedConnectionTypes);
        
        this.info('Handshake successful: ?', this._clientId);
        if (callback) callback.call(scope);
        
      } else {
        this.info('Handshake unsuccessful');
        setTimeout(function() { self.handshake(callback, scope) }, this._advice.interval);
        this._state = this.UNCONNECTED;
      }
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * connectionType                     * clientId
  // MAY include:   * ext                 MAY include:   * error
  //                * id                                 * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  connect: function(callback, scope) {
    if (this._advice.reconnect === this.NONE) return;
    if (this._state === this.DISCONNECTED) return;
    
    if (this._advice.reconnect === this.HANDSHAKE || this._state === this.UNCONNECTED) {
      this._beginReconnectTimeout();
      return this.handshake(function() { this.connect(callback, scope) }, this);
    }
    
    if (this._state === this.CONNECTING)
      return this.callback(callback, scope);
    
    if (this._state !== this.CONNECTED) return;
    
    this.info('Calling deferred actions for ?', this._clientId);
    this.setDeferredStatus('succeeded');
    this.setDeferredStatus('deferred');
    if (callback) callback.call(scope);
    
    if (this._connectionId) return;
    this._connectionId = this._namespace.generate();
    var self = this;
    this.info('Initiating connection for ?', this._clientId);
    
    this._transport.send({
      channel:        Faye.Channel.CONNECT,
      clientId:       this._clientId,
      connectionType: this._transport.connectionType,
      id:             this._connectionId
      
    }, this._verifyClientId(function(response) {
      this._connectionId = null;
      this.removeTimeout('reconnect');
      
      this.info('Closed connection for ?', this._clientId);
      setTimeout(function() { self.connect() }, this._advice.interval);
    }));
    
    this._beginReconnectTimeout();
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  // MAY include:   * ext                                * clientId
  //                * id                  MAY include:   * error
  //                                                     * ext
  //                                                     * id
  disconnect: function() {
    if (this._state !== this.CONNECTED) return;
    this._state = this.DISCONNECTED;
    
    this.info('Disconnecting ?', this._clientId);
    
    this._transport.send({
      channel:    Faye.Channel.DISCONNECT,
      clientId:   this._clientId
    });
    
    this.info('Clearing channel listeners for ?', this._clientId);
    this._channels = new Faye.Channel.Tree();
    this.removeTimeout('reconnect');
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * subscription                       * clientId
  // MAY include:   * ext                                * subscription
  //                * id                  MAY include:   * error
  //                                                     * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  subscribe: function(channels, callback, scope) {
    this.connect(function() {
      
      channels = [].concat(channels);
      this._validateChannels(channels);
      
      this.info('Client ? attempting to subscribe to ?', this._clientId, channels);
      
      this._transport.send({
        channel:      Faye.Channel.SUBSCRIBE,
        clientId:     this._clientId,
        subscription: channels
        
      }, this._verifyClientId(function(response) {
        if (!response.successful || !callback) return;
        
        this.info('Subscription acknowledged for ? to ?', this._clientId, channels);
      
        channels = [].concat(response.subscription);
        Faye.each(channels, function(channel) {
          this._channels.set(channel, [callback, scope]);
        }, this);
      }));
      
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * subscription                       * clientId
  // MAY include:   * ext                                * subscription
  //                * id                  MAY include:   * error
  //                                                     * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  unsubscribe: function(channels, callback, scope) {
    this.connect(function() {
      
      channels = [].concat(channels);
      this._validateChannels(channels);
      
      this.info('Client ? attempting to unsubscribe from ?', this._clientId, channels);
      
      this._transport.send({
        channel:      Faye.Channel.UNSUBSCRIBE,
        clientId:     this._clientId,
        subscription: channels
        
      }, this._verifyClientId(function(response) {
        if (!response.successful) return;
        
        this.info('Unsubscription acknowledged for ? from ?', this._clientId, channels);
        
        channels = [].concat(response.subscription);
        Faye.each(channels, function(channel) {
          this._channels.set(channel, undefined);
        }, this);
      }));
      
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * data                               * successful
  // MAY include:   * clientId            MAY include:   * id
  //                * id                                 * error
  //                * ext                                * ext
  publish: function(channel, data) {
    this.connect(function() {
      
      this._validateChannels([channel]);
      
      this.info('Client ? queueing published message to ?: ?', this._clientId, channel, data);
      
      this._enqueue({
        channel:      channel,
        data:         data,
        clientId:     this._clientId
      });
      
      this.addTimeout('publish', this.MAX_DELAY, this._flush, this);
      
    }, this);
  },
  
  handleAdvice: function(advice) {
    Faye.extend(this._advice, advice);
    if (this._advice.reconnect === this.HANDSHAKE) this._clientId = null;
  },
  
  deliverMessages: function(messages) {
    Faye.each(messages, function(message) {
      this.info('Client ? calling listeners for ? with ?', this._clientId, message.channel, message.data);
      
      var channels = this._channels.glob(message.channel);
      Faye.each(channels, function(callback) {
        callback[0].call(callback[1], message.data);
      });
    }, this);
  },
  
  _beginReconnectTimeout: function() {
    this.addTimeout('reconnect', this._timeout, function() {
      this._connectionId = null;
      this._clientId = null;
      this._state = this.UNCONNECTED;
      
      this.info('Server took >?s to reply to connection for ?: attempting to reconnect',
                this._timeout, this._clientId);
      
      this.subscribe(this._channels.getKeys());
    }, this);
  },
  
  _enqueue: function(message) {
    this._outbox.push(message);
  },
  
  _flush: function() {
    this._transport.send(this._outbox);
    this._outbox = [];
  },
  
  _validateChannels: function(channels) {
    Faye.each(channels, function(channel) {
      if (!Faye.Channel.isValid(channel))
        throw '"' + channel + '" is not a valid channel name';
      if (!Faye.Channel.isSubscribable(channel))
        throw 'Clients may not subscribe to channel "' + channel + '"';
    });
  },
  
  _verifyClientId: function(callback) {
    var self = this;
    return function(response) {
      if (response.clientId !== self._clientId) return false;
      callback.call(self, response);
      return true;
    };
  }
});

Faye.extend(Faye.Client.prototype, Faye.Deferrable);
Faye.extend(Faye.Client.prototype, Faye.Timeouts);
Faye.extend(Faye.Client.prototype, Faye.Logging);


Faye.Set = Faye.Class({
  initialize: function() {
    this._index = {};
  },
  
  add: function(item) {
    var key = (item.__id !== undefined) ? item.__id : item;
    if (this._index.hasOwnProperty(key)) return false;
    this._index[key] = item;
    return true;
  },
  
  forEach: function(block, scope) {
    for (var key in this._index) {
      if (this._index.hasOwnProperty(key))
        block.call(scope, this._index[key]);
    }
  },
  
  isEmpty: function() {
    for (var key in this._index) {
      if (this._index.hasOwnProperty(key)) return false;
    }
    return true;
  },
  
  member: function(item) {
    for (var key in this._index) {
      if (this._index[key] === item) return true;
    }
    return false;
  },
  
  remove: function(item) {
    var key = (item.__id !== undefined) ? item.__id : item;
    delete this._index[key];
  },
  
  toArray: function() {
    var array = [];
    this.forEach(function(item) { array.push(item) });
    return array;
  }
});


Faye.Server = Faye.Class({
  initialize: function(options) {
    this.info('New server created');
    this._options     = options || {};
    this._channels    = new Faye.Channel.Tree();
    this._connections = {};
    this._namespace   = new Faye.Namespace();
  },
  
  clientIds: function() {
    var ids = [];
    Faye.each(this._connections, function(key, value) { ids.push(key) });
    return ids;
  },
  
  process: function(messages, local, callback) {
    this.debug('Processing messages from ? client', local ? 'LOCAL' : 'REMOTE');
    
    messages = [].concat(messages);
    var processed = 0, responses = [];
    
    Faye.each(messages, function(message) {
      this._handle(message, local, function(reply) {
        responses = responses.concat(reply);
        processed += 1;
        if (processed < messages.length) return;
        callback(responses);
      }, this);
    }, this);
  },
  
  flushConnection: function(messages) {
    messages = [].concat(messages);
    Faye.each(messages, function(message) {
      var connection = this._connections[message.clientId];
      if (connection) connection.flush();
    }, this);
  },
  
  _connection: function(id) {
    if (this._connections.hasOwnProperty(id)) return this._connections[id];
    var connection = new Faye.Connection(id, this._options);
    connection.on('staleConnection', this._destroyConnection, this);
    return this._connections[id] = connection;
  },
  
  _destroyConnection: function(connection) {
    connection.disconnect();
    connection.stopObserving('staleConnection', this._destroyConnection, this);
    delete this._connections[connection.id];
  },
  
  _handle: function(message, local, callback, scope) {
    var channel = message.channel,
        response;
    
    message.__id = Faye.random();
    Faye.each(this._channels.glob(channel), function(channel) {
      channel.push(message);
      this.info('Publishing message ? from client ? to ?', message.data, message.clientId, channel.name);
    }, this);
    
    if (Faye.Channel.isMeta(channel)) {
      response = this[Faye.Channel.parse(channel)[1]](message, local);
      
      var clientId = response.clientId;
      response.advice = response.advice || {};
      Faye.extend(response.advice, {
        reconnect:  this._connections.hasOwnProperty(clientId) ? 'retry' : 'handshake',
        interval:   Math.floor(Faye.Connection.prototype.INTERVAL * 1000)
      }, false);
      
      if (response.channel !== Faye.Channel.CONNECT ||
          response.successful !== true)
        return callback.call(scope, response);
      
      this.info('Accepting connection from ?', response.clientId);
      
      return this._connection(response.clientId).connect(function(events) {
        this.info('Sending event messages to ?', response.clientId);
        this.debug('Events for ?: ?', response.clientId, events);
        Faye.each(events, function(e) { delete e.__id });
        callback.call(scope, [response].concat(events));
      }, this);
    }
    
    if (!message.clientId || Faye.Channel.isService(channel))
      return callback([]);
    
    response = this._makeResponse(message);
    response.successful = true;
    callback(response);
  },
  
  _makeResponse: function(message) {
    var response = {};
    Faye.each(['id', 'clientId', 'channel'], function(field) {
      if (message[field]) response[field] = message[field];
    });
    return response;
  },
  
  // MUST contain  * version
  //               * supportedConnectionTypes
  // MAY contain   * minimumVersion
  //               * ext
  //               * id
  handshake: function(message, local) {
    var response = this._makeResponse(message);
    response.version = Faye.BAYEUX_VERSION;
    
    if (!message.version)
      response.error = Faye.Error.parameterMissing('version');
    
    var clientConns = message.supportedConnectionTypes,
        commonConns;
    
    if (!local) {
      response.supportedConnectionTypes = Faye.CONNECTION_TYPES;
      
      if (clientConns) {
        commonConns = Faye.filter(clientConns, function(conn) {
          return Faye.indexOf(Faye.CONNECTION_TYPES, conn) !== -1;
        });
        if (commonConns.length === 0)
          response.error = Faye.Error.conntypeMismatch(clientConns);
      } else {
        response.error = Faye.Error.parameterMissing('supportedConnectionTypes');
      }
    }
    
    response.successful = !response.error;
    if (!response.successful) return response;
    
    var clientId = this._namespace.generate();
    response.clientId = this._connection(clientId).id;
    this.info('Accepting handshake from client ?', response.clientId);
    return response;
  },
  
  // MUST contain  * clientId
  //               * connectionType
  // MAY contain   * ext
  //               * id
  connect: function(message, local) {
    var response = this._makeResponse(message);
    
    var clientId   = message.clientId,
        connection = clientId ? this._connections[clientId] : null,
        connectionType = message.connectionType;
    
    if (!connection)     response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId)       response.error = Faye.Error.parameterMissing('clientId');
    if (!connectionType) response.error = Faye.Error.parameterMissing('connectionType');
    
    response.successful = !response.error;
    if (!response.successful) delete response.clientId;
    if (!response.successful) return response;
    
    response.clientId = connection.id;
    return response;
  },
  
  // MUST contain  * clientId
  // MAY contain   * ext
  //               * id
  disconnect: function(message, local) {
    var response = this._makeResponse(message);
    
    var clientId   = message.clientId,
        connection = clientId ? this._connections[clientId] : null;
    
    if (!connection) response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId)   response.error = Faye.Error.parameterMissing('clientId');
    
    response.successful = !response.error;
    if (!response.successful) delete response.clientId;
    if (!response.successful) return response;
    
    this._destroyConnection(connection);
    
    this.info('Disconnected client: ?', clientId);
    response.clientId = clientId;
    return response;
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  subscribe: function(message, local) {
    var response = this._makeResponse(message);
    
    var clientId     = message.clientId,
        connection   = clientId ? this._connections[clientId] : null,
        subscription = message.subscription;
    
    subscription = [].concat(subscription);
    
    if (!connection)           response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
    if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
    
    response.subscription = subscription;
    
    Faye.each(subscription, function(channel) {
      if (response.error) return;
      if (!local && !Faye.Channel.isSubscribable(channel)) response.error = Faye.Error.channelForbidden(channel);
      if (!Faye.Channel.isValid(channel))                  response.error = Faye.Error.channelInvalid(channel);
      
      if (response.error) return;
      channel = this._channels.findOrCreate(channel);
      
      this.info('Subscribing client ? to ?', clientId, channel.name);
      connection.subscribe(channel);
    }, this);
    
    response.successful = !response.error;
    return response;
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  unsubscribe: function(message, local) {
    var response = this._makeResponse(message);
    
    var clientId     = message.clientId,
        connection   = clientId ? this._connections[clientId] : null,
        subscription = message.subscription;
    
    subscription = [].concat(subscription);
    
    if (!connection)           response.error = Faye.Error.clientUnknown(clientId);
    if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
    if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
    
    response.subscription = subscription;
    
    Faye.each(subscription, function(channel) {
      if (response.error) return;
      
      if (!Faye.Channel.isValid(channel))
        return response.error = Faye.Error.channelInvalid(channel);
      
      channel = this._channels.get(channel);
      if (!channel) return;
      
      this.info('Unsubscribing client ? from ?', clientId, channel.name);
      connection.unsubscribe(channel);
    }, this);
    
    response.successful = !response.error;
    return response;
  }
});

Faye.extend(Faye.Server.prototype, Faye.Logging);


Faye.Connection = Faye.Class({
  MAX_DELAY:  0.1,
  INTERVAL:   1.0,
  TIMEOUT:    60.0,
  
  initialize: function(id, options) {
    this.id         = id;
    this._options   = options;
    this._timeout   = this._options.timeout || this.TIMEOUT;
    this._channels  = new Faye.Set();
    this._inbox     = new Faye.Set();
    this._connected = false
  },
  
  _onMessage: function(event) {
    this._inbox.add(event);
    this._beginDeliveryTimeout();
  },
  
  subscribe: function(channel) {
    if (!this._channels.add(channel)) return;
    channel.on('message', this._onMessage, this);
  },
  
  unsubscribe: function(channel) {
    if (channel === 'all') return this._channels.forEach(this.unsubscribe, this);
    if (!this._channels.member(channel)) return;
    this._channels.remove(channel);
    channel.stopObserving('message', this._onMessage, this);
  },
  
  connect: function(callback, scope) {
    this.callback(callback, scope);
    if (this._connected) return;
    
    this._connected = true;
    this.removeTimeout('deletion');
    
    this._beginDeliveryTimeout();
    this._beginConnectionTimeout();
  },
  
  flush: function() {
    if (!this._connected) return;
    this._releaseConnection();
    
    var events = this._inbox.toArray();
    this._inbox = new Faye.Set();
    
    this.setDeferredStatus('succeeded', events);
    this.setDeferredStatus('deferred');
  },
  
  disconnect: function() {
    this.unsubscribe('all');
    this.flush();
  },
  
  _beginDeliveryTimeout: function() {
    if (!this._connected || this._inbox.isEmpty()) return;
    this.addTimeout('delivery', this.MAX_DELAY, this.flush, this);
  },
  
  _beginConnectionTimeout: function() {
    if (!this._connected) return;
    this.addTimeout('connection', this._timeout, this.flush, this);
  },
  
  _releaseConnection: function() {
    this.removeTimeout('connection');
    this.removeTimeout('delivery');
    this._connected = false;
    
    this.addTimeout('deletion', 10 * this.INTERVAL, function() {
      this.trigger('staleConnection', this);
    }, this);
  }
});

Faye.extend(Faye.Connection.prototype, Faye.Deferrable);
Faye.extend(Faye.Connection.prototype, Faye.Observable);
Faye.extend(Faye.Connection.prototype, Faye.Timeouts);


Faye.Error = Faye.Class({
  initialize: function(code, args, message) {
    this.code    = code;
    this.args    = Array.prototype.slice.call(args);
    this.message = message;
  },
  
  toString: function() {
    return this.code + ':' +
           this.args.join(',') + ':' +
           this.message;
  }
});


Faye.Error.versionMismatch = function() {
  return new this(300, arguments, "Version mismatch").toString();
};

Faye.Error.conntypeMismatch = function() {
  return new this(301, arguments, "Connection types not supported").toString();
};

Faye.Error.extMismatch = function() {
  return new this(302, arguments, "Extension mismatch").toString();
};

Faye.Error.badRequest = function() {
  return new this(400, arguments, "Bad request").toString();
};

Faye.Error.clientUnknown = function() {
  return new this(401, arguments, "Unknown client").toString();
};

Faye.Error.parameterMissing = function() {
  return new this(402, arguments, "Missing required parameter").toString();
};

Faye.Error.channelForbidden = function() {
  return new this(403, arguments, "Forbidden channel").toString();
};

Faye.Error.channelUnknown = function() {
  return new this(404, arguments, "Unknown channel").toString();
};

Faye.Error.channelInvalid = function() {
  return new this(405, arguments, "Invalid channel").toString();
};

Faye.Error.extUnknown = function() {
  return new this(406, arguments, "Unknown extension").toString();
};

Faye.Error.publishFailed = function() {
  return new this(407, arguments, "Failed to publish").toString();
};

Faye.Error.serverError = function() {
  return new this(500, arguments, "Internal server error").toString();
};



var path  = require('path'),
    fs    = require('fs'),
    sys   = require('sys'),
    url   = require('url'),
    http  = require('http'),
    querystring = require('querystring');

Faye.logger = function(message) {
  sys.puts(message);
};

Faye.withDataFor = function(transport, callback, scope) {
  var data = '';
  transport.addListener('data', function(chunk) { data += chunk });
  transport.addListener('end', function() {
    callback.call(scope, data);
  });
};

Faye.NodeAdapter = Faye.Class({
  DEFAULT_ENDPOINT: '/bayeux',
  SCRIPT_PATH:      path.dirname(__filename) + '/faye-client-min.js',
  
  TYPE_JSON:    {'Content-Type': 'application/json'},
  TYPE_SCRIPT:  {'Content-Type': 'text/javascript'},
  TYPE_TEXT:    {'Content-Type': 'text/plain'},
  
  initialize: function(options) {
    this._options    = options || {};
    this._endpoint   = this._options.mount || this.DEFAULT_ENDPOINT;
    this._endpointRe = new RegExp('^' + this._endpoint + '(/[^/]+)*(\\.js)?$');
    this._server     = new Faye.Server(this._options);
  },
  
  getClient: function() {
    return this._client = this._client || new Faye.Client(this._server);
  },
  
  run: function(port) {
    var self = this;
    http.createServer(function(request, response) {
      self.call(request, response);
    }).listen(Number(port));
  },
  
  call: function(request, response) {
    var requestUrl = url.parse(request.url, true),
        self = this, data;
    
    if (!this._endpointRe.test(requestUrl.pathname))
      return false;
    
    if (/\.js$/.test(requestUrl.pathname)) {
      fs.readFile(this.SCRIPT_PATH, function(err, content) {
        response.writeHead(200, self.TYPE_SCRIPT);
        response.write(content);
        response.end();
      });
      
    } else {
      var isGet = (request.method === 'GET');
      
      if (isGet)
        this._callWithParams(request, response, requestUrl.query);
      
      else
        Faye.withDataFor(request, function(data) {
          self._callWithParams(request, response, {message: data});
        });
    }
    return true;
  },
  
  _callWithParams: function(request, response, params) {
    try {
      var message = JSON.parse(params.message),
          jsonp   = params.jsonp || Faye.JSONP_CALLBACK,
          isGet   = (request.method === 'GET'),
          type    = isGet ? this.TYPE_SCRIPT : this.TYPE_JSON;
      
      if (isGet) this._server.flushConnection(message);
      
      this._server.process(message, false, function(replies) {
        var body = JSON.stringify(replies);
        if (isGet) body = jsonp + '(' + body + ');';
        response.writeHead(200, type);
        response.write(body);
        response.end();
      });
    } catch (e) {
      response.writeHead(400, this.TYPE_TEXT);
      response.write('Bad request');
      response.end();
    }
  }
});

exports.NodeAdapter = Faye.NodeAdapter;
exports.Client = Faye.Client;


Faye.NodeHttpTransport = Faye.Class(Faye.Transport, {
  request: function(message, callback, scope) {
    var request = this.createRequestForMessage(message);
    
    request.addListener('response', function(response) {
      if (!callback) return;
      Faye.withDataFor(response, function(data) {
        callback.call(scope, JSON.parse(data));
      });
    });
    request.end();
  },
  
  createRequestForMessage: function(message) {
    var content = JSON.stringify(message),
        uri     = url.parse(this._endpoint),
        client  = http.createClient(uri.port, uri.hostname);
    
    client.addListener('error', function() { /* catch ECONNREFUSED */ });
    
    if (parseInt(uri.port) === 443) client.setSecure('X509_PEM');
    
    var request = client.request('POST', uri.pathname, {
      'Content-Type':   'application/json',
      'host':           uri.hostname,
      'Content-Length': content.length
    });
    request.write(content);
    return request;
  }
});

Faye.NodeHttpTransport.isUsable = function(endpoint) {
  return typeof endpoint === 'string';
};

Faye.Transport.register('long-polling', Faye.NodeHttpTransport);

Faye.NodeLocalTransport = Faye.Class(Faye.Transport, {
  request: function(message, callback, scope) {
    this._endpoint.process(message, true, function(response) {
      callback.call(scope, response);
    });
  }
});

Faye.NodeLocalTransport.isUsable = function(endpoint) {
  return endpoint instanceof Faye.Server;
};

Faye.Transport.register('in-process', Faye.NodeLocalTransport);