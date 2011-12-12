var faye = require('faye');

//Faye.Logging.logLevel = Faye.Logging.debug;

var client = new Faye.Client('http://localhost/node/faye-node/myapp/faye',{
	timeout: 120
});

var publication = client.publish('/one',{ result: 'other message from one'});

publication.callback(function(){
	console.log('message sent');
	
	client.disconnect();
});

publication.errback(function(err){
	console.log(err);
});



