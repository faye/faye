var sys    = require('sys'),
    path   = require('path'),
    http   = require('http'),
    assert = require('assert'),
    faye   = require('../build/faye');

Scenario = Faye.Class({
  initialize: function(name, block) {
    this._name    = name;
    this._block   = block;
    this._clients = {};
    this._inbox   = {};
    this._pool    = 0;
  },
  
  run: function() {
    sys.puts('\n' + this._name);
    sys.puts('----------------------------------------------------------------');
    this._block.call(this);
  },
  
  server: function(port) {
    sys.puts('Starting server on port ' + port);
    this._endpoint = 'http://0.0.0.0:' + port + '/comet';
    var comet = this._comet  = new faye.NodeAdapter({mount: '/comet', timeout: 30});
    this._server = http.createServer(function(request, response) {
      comet.call(request, response);
    });
    this._server.listen(port);
  },
  
  httpClient: function(name, channels) {
    var client = new faye.Client(this._endpoint);
    client.connect(function() {
      Faye.each(channels, function(channel) {
        sys.puts('Client ' + name + ' subscribing to ' + channel);
        client.subscribe(channel, function(message) {
          var box = this._inbox[name];
          box[channel] = box[channel] || [];
          box[channel].push(message);
        }, this);
      }, this);
    }, this);
    this._clients[name] = client;
    this._inbox[name]   = {};
    this._pool         += 1;
  },
  
  send: function(from, channel, message) {
    this._withConnectedClients(function() {
      var displayMessage = JSON.stringify(message);
      sys.puts('Client ' + from + ' publishing ' + displayMessage + ' to ' + channel);
      this._clients[from].publish(channel, message);
      
    });
  },
  
  checkInbox: function(expectedInbox) {
    var self = this;
    setTimeout(function() {
      self._checkInbox(expectedInbox);
      sys.puts('Shutting down server\n');
      self._comet.close();
      self._server.close();
      Scenario.runNext();
    }, 500);
  },
  
  _checkInbox: function(expectedInbox) {
    sys.puts(JSON.stringify(this._inbox));
    assert.deepEqual(this._inbox, expectedInbox);
  },
  
  _withConnectedClients: function(block) {
    if (this._connected) return block.call(this);
    var connected = 0;
    Faye.each(this._clients, function(name, client) {
      client.connect(function() {
        connected += 1;
        if (connected < this._pool) return;
        this._connected = true;
        block.call(this);
      }, this);
    }, this);
  }
});

Faye.extend(Scenario, {
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
  Scenario.enqueue(name, block);
  if (!Scenario.running) Scenario.runNext();
};

