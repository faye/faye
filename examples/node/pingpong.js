var faye = require('faye'),
    sys  = require('sys');

ENDPOINT = 'http://localhost:8000/bayeux';
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

setTimeout(function() { ping.publish('/pong', {}) }, 500);

