var Scenario = require('./scenario'),
    faye = require('../build/faye');

Scenario.run("Two HTTP clients", function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  send('/channels/a', {hello: 'world'}, {from: 'B', to: ['A']});
}});

