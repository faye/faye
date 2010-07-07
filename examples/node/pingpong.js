var faye = require('./faye-node'),
    sys  = require('sys');

ENDPOINT = 'http://localhost:8080/cometd';
sys.puts('Connecting to ' + ENDPOINT);

var ping = new Faye.Client(ENDPOINT);
ping.subscribe('/ping', function() {
  sys.puts('PING');
  setTimeout(function() { ping.publish('/pong', {}) }, 1000);
});

var pong = new Faye.Client(ENDPOINT);
pong.subscribe('/pong', function() {
  sys.puts('PONG');
  setTimeout(function() { pong.publish('/ping', {}) }, 1000);
});

ping.publish('/pong', {});

