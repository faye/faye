var faye = require('../../build/node/faye-node');

ENDPOINT = 'http://localhost:8000/bayeux';
console.log('Connecting to ' + ENDPOINT);

var ping = new faye.Client(ENDPOINT);
ping.subscribe('/ping', function() {
  console.log('PING');
  setTimeout(function() { ping.publish('/pong', {}) }, 1000);
});

var pong = new faye.Client(ENDPOINT);
pong.subscribe('/pong', function() {
  console.log('PONG');
  setTimeout(function() { pong.publish('/ping', {}) }, 1000);
});

setTimeout(function() { ping.publish('/pong', {}) }, 500);
