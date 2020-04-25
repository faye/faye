module.exports = {
  devtool: 'source-map',

  module: {
    loaders: [
      {test: /\/spec\/.*\.js$/, loader: 'imports-loader?define=>false'}
    ],

    noParse: /jstest/
  },

  node: {
    process: false,
    setImmediate: false
  }
};
