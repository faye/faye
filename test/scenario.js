var sys    = require('sys'),
    path   = require('path'),
    http   = require('http'),
    assert = require('assert'),
    faye   = require('../build/faye');

AsyncScenario = Faye.Class({
  initialize: function(name) {
    this._name    = name;
    this._clients = {};
    this._inbox   = {};
    this._pool    = 0;
  },
  
  server: function(port, Continue) {
    sys.puts('Starting server on port ' + port);
    this._endpoint = 'http://0.0.0.0:' + port + '/comet';
    var comet = this._comet  = new faye.NodeAdapter({mount: '/comet', timeout: 30});
    this._server = http.createServer(function(request, response) {
      comet.call(request, response);
    });
    this._server.listen(port);
    Continue();
  },
  
  httpClient: function(name, channels, Continue) {
    this._setupClient(new faye.Client(this._endpoint), name, channels, Continue);
  },
  
  localClient: function(name, channels, Continue) {
    this._setupClient(this._comet.getClient(), name, channels, Continue);
  },
  
  _setupClient: function(client, name, channels, Continue) {
    Faye.each(channels, function(channel) {
      sys.puts('Client ' + name + ' subscribing to ' + channel);
      client.subscribe(channel, function(message) {
        var box = this._inbox[name];
        box[channel] = box[channel] || [];
        box[channel].push(message);
      }, this);
    }, this);
    this._clients[name] = client;
    this._inbox[name]   = {};
    this._pool         += 1;
    setTimeout(Continue, 100 * channels.length);
  },
  
  send: function(from, channel, message, Continue) {
    var self = this;
    var displayMessage = JSON.stringify(message);
    sys.puts('Client ' + from + ' publishing ' + displayMessage + ' to ' + channel);
    this._clients[from].publish(channel, message);
    setTimeout(Continue, 500);
  },
  
  checkInbox: function(expectedInbox, Continue) {
    sys.puts(JSON.stringify(this._inbox));
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
    sys.puts('Shutting down server\n');
    this._scenario.finish(function() { SyncScenario.runNext() });
  }
});

['server', 'httpClient', 'localClient', 'send', 'checkInbox'].forEach(function(method) {
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

