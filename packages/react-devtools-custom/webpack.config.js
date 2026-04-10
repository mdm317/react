const {resolve} = require('path');
const Webpack = require('webpack');

const NODE_ENV = process.env.NODE_ENV;
if (!NODE_ENV) {
  console.error('NODE_ENV not set');
  process.exit(1);
}

const __DEV__ = NODE_ENV === 'development';

const babelOptions = {
  configFile: resolve(
    __dirname,
    '..',
    'react-devtools-shared',
    'babel.config.js',
  ),
};

module.exports = {
  mode: __DEV__ ? 'development' : 'production',
  devtool: __DEV__ ? 'eval-cheap-source-map' : 'source-map',
  entry: {
    index: './index.js',
  },
  output: {
    path: resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: {
      type: 'commonjs2',
    },
  },
  externals: {
    react: 'commonjs react',
    'react-devtools-core/backend': 'commonjs react-devtools-core/backend',
  },
  node: {
    global: false,
  },
  optimization: {
    minimize: false,
  },
  plugins: [
    new Webpack.DefinePlugin({
      __DEV__,
      __EXPERIMENTAL__: true,
      __PROFILE__: false,
      __TEST__: NODE_ENV === 'test',
      'process.env.NODE_ENV': `"${NODE_ENV}"`,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        options: babelOptions,
      },
    ],
  },
};
