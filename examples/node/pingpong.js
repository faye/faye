var faye = require('../../build/faye-node');

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

pong.bind('transport:down', function() {
  console.log('[CONNECTION DOWN]');
});

pong.bind('transport:up', function() {
  console.log('[CONNECTION UP]');
});

setTimeout(function() { ping.publish('/pong', {}) }, 500);

