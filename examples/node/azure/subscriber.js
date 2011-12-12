var faye = require('faye');

var client = new Faye.Client('http://localhost/node/faye-node/myapp/faye',{
 	timeout: 120
 });

client.subscribe('/one', function(message) {
	console.log('something received: ' + message.result );
 });