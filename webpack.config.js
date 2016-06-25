var path = require('path');

module.exports = {
  devtool: 'source-map',

  module: {
    loaders: [
      {test: /\/spec\/.*\.js$/, loader: 'imports?define=>false'}
    ],

    noParse: /jstest/
  },

  node: {
    process: false,
    setImmediate: false
  }
};
