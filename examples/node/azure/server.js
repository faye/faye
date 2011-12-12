var faye = require('faye'),
    connect = require('connect');
var server = connect.createServer(
    connect.staticCache()
  );
  
var ROOT_ADDRESS = '/node/faye-node/myapp/';

server.use(ROOT_ADDRESS + 'static', connect.static(__dirname + '/static'));
server.use(ROOT_ADDRESS, function(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.end(process.env.PORT);
});

var 
  bayeux = new faye.NodeAdapter({mount: ROOT_ADDRESS + 'faye', timeout: 45 });

bayeux.attach(server);

server.listen(process.env.PORT);
  




