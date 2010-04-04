var sys    = require('sys'),
    path   = require('path'),
    http   = require('http'),
    assert = require('assert'),
    faye   = require('../build/faye');

Faye.Logging.logLevel = 'info';

AsyncScenario = Faye.Class({
  initialize: function(name) {
    this._name    = name;
    this._clients = {};
    this._inbox   = {};
    this._pool    = 0;
  },
  
  wait: function(time, Continue) {
    setTimeout(Continue, 1000 * time);
  },
  
  server: function(port, Continue) {
    this._endpoint = 'http://0.0.0.0:' + port + '/comet';
    var comet = this._comet  = new faye.NodeAdapter({mount: '/comet', timeout: 30});
    this._server = http.createServer(function(request, response) {
      comet.call(request, response);
    });
    this._server.listen(port);
    Continue();
  },
  
  killServer: function(Continue) {
    if (this._server) this._server.close();
    this._server = undefined;
    setTimeout(Continue, 500);
  },
  
  httpClient: function(name, channels, Continue) {
    this._setupClient(new faye.Client(this._endpoint, {timeout: 5}), name, channels, Continue);
  },
  
  localClient: function(name, channels, Continue) {
    this._setupClient(this._comet.getClient(), name, channels, Continue);
  },
  
  _setupClient: function(client, name, channels, Continue) {
    Faye.each(channels, function(channel) {
      client.subscribe(channel, function(message) {
        var box = this._inbox[name];
        box[channel] = box[channel] || [];
        box[channel].push(message);
      }, this);
    }, this);
    this._clients[name] = client;
    this._inbox[name]   = {};
    this._pool         += 1;
    setTimeout(Continue, 500 * channels.length);
  },
  
  publish: function(from, channel, message, Continue) {
    this._clients[from].publish(channel, message);
    setTimeout(Continue, 500);
  },
  
  checkInbox: function(expectedInbox, Continue) {
    assert.deepEqual(this._inbox, expectedInbox);
    Continue();
  },
  
  finish: function(Continue) {
    Faye.each(this._clients, function(name, client) { client.disconnect() });
    this._server.close();
    Continue();
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

['wait', 'server', 'killServer', 'httpClient', 'localClient', 'publish', 'checkInbox'].
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

