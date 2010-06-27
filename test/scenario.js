var sys    = require('sys'),
    path   = require('path'),
    http   = require('http'),
    assert = require('assert'),
    faye   = require('../build/faye-node');

Faye.Logging.logLevel = 'info';

AsyncScenario = Faye.Class({
  initialize: function(name) {
    this._name    = name;
    this._clients = {};
    this._inbox   = {};
    this._errors  = {};
    this._pool    = 0;
  },
  
  wait: function(time, Continue) {
    setTimeout(Continue, 1000 * time);
  },
  
  server: function(port, Continue) {
    this._endpoint = 'http://0.0.0.0:' + port + '/comet';
    this._server = new faye.NodeAdapter({mount: '/comet', timeout: 5});
    this._server.listen(port);
    Continue();
  },
  
  killServer: function(Continue) {
    if (this._server) this._server.close();
    this._server = undefined;
    setTimeout(Continue, 500);
  },
  
  httpClient: function(name, channels, Continue) {
    this._setupClient(new faye.Client(this._endpoint, {timeout: 8}), name, channels, Continue);
  },
  
  localClient: function(name, channels, Continue) {
    this._setupClient(this._server.getClient(), name, channels, Continue);
  },
  
  extendServer: function(stage, extension, Continue) {
    var object = {};
    object[stage] = extension;
    this._server.addExtension(object);
    Continue();
  },
  
  extendClient: function(name, stage, extension, Continue) {
    var object = {};
    object[stage] = extension;
    this._clients[name].addExtension(object);
    Continue();
  },
  
  listenForErrors: function(name, Continue) {
    var errors = this._errors[name] = [];
    this.extendClient(name, 'incoming', function(message, callback) {
      if (message.successful === false) errors.push(message.error);
      callback(message);
    }, Continue);
  },
  
  _setupClient: function(client, name, channels, Continue) {
    this._clients[name] = client;
    this._inbox[name]   = {};
    this._pool         += 1;
    
    Faye.each(channels, function(channel) {
      this.subscribe(name, channel);
    }, this);
    
    setTimeout(Continue, 500 * channels.length);
  },
  
  subscribe: function(name, channel, Continue) {
    var client = this._clients[name];
    
    this._lastSub = client.subscribe(channel, function(message) {
      var box = this._inbox[name];
      box[channel] = box[channel] || [];
      box[channel].push(message);
    }, this);
    
    setTimeout(Continue, 500);
  },
  
  cancelLastSubscription: function(Continue) {
    this._lastSub.cancel();
    setTimeout(Continue, 500);
  },
  
  publish: function(from, channel, message, Continue) {
    if (message instanceof Array)
      Faye.each(message, function(msg) {
        this._clients[from].publish(channel, msg);
      }, this);
    else
      this._clients[from].publish(channel, message);
    
    setTimeout(Continue, 500);
  },
  
  checkInbox: function(expectedInbox, Continue) {
    assert.deepEqual(this._inbox, expectedInbox);
    Continue();
  },
  
  checkErrors: function(name, expectedErrors, Continue) {
    assert.deepEqual(this._errors[name], expectedErrors);
    Continue();
  },
  
  finish: function(Continue) {
    Faye.each(this._clients, function(name, client) { client.disconnect() });
    var server = this._server;
    setTimeout(function() {
      server.close();
      Continue();
    }, 1000);
  },
});

SyncScenario = Faye.Class({
  initialize: function(name, block) {
    this._name = name;
    this._commands = [];
    this._scenario = new AsyncScenario();
    block.call(this);
  },
  
  run: function() {
    sys.puts('\n' + this._name);
    sys.puts('----------------------------------------------------------------');
    this._runNextCommand();
  },
  
  _runNextCommand: function() {
    if (this._commands.length === 0) return this._finish();
    
    var command = this._commands.shift(),
        method  = command[0],
        args    = Array.prototype.slice.call(command[1]),
        self = this;
    
    this._scenario[method].apply(this._scenario, args.concat(function() {
      self._runNextCommand();
    }));
  },
  
  _finish: function() {
    sys.puts('No errors; Shutting down server\n');
    this._scenario.finish(function() { SyncScenario.runNext() });
  }
});

['wait', 'server', 'killServer', 'httpClient', 'localClient',
 'subscribe', 'cancelLastSubscription', 'publish', 'checkInbox',
 'extendServer', 'extendClient', 'listenForErrors', 'checkErrors'].
forEach(function(method) {
  SyncScenario.prototype[method] = function() {
    this._commands.push([method, arguments]);
  }
});

Faye.extend(SyncScenario, {
  _queue: [],
  
  enqueue: function(name, block) {
    this._queue.push(new this(name, block));
  },
  
  runNext: function() {
    this.running = true;
    var scenario = this._queue.shift();
    if (!scenario) return;
    scenario.run();
  }
});

exports.run = function(name, block) {
  SyncScenario.enqueue(name, block);
  if (!SyncScenario.running) SyncScenario.runNext();
};

