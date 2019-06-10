let mode = process.env.NODE_ENV || 'development',
    name;

if (mode === 'production') {
  name = 'faye-browser-min';
} else {
  name = 'faye-browser';
}

module.exports = {
  mode,
  devtool: 'source-map',

  entry: {
    ['build/client/' + name]: '.',
    'spec/browser_bundle': './spec/browser'
  },

  output: {
    path: __dirname,
    filename: '[name].js',
    library: 'Faye'
  },

  module: {
    rules: [
      {
        test: /\/spec\/.*\.js$/,
        loader: 'imports-loader?define=>false'
      }
    ],

    noParse: /jstest/
  },

  node: {
    process: false
  }
};
