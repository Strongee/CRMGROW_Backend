import gulp from 'gulp';
import loadPlugins from 'gulp-load-plugins';
import webpack from 'webpack';
import rimraf from 'rimraf';

const plugins = loadPlugins();

import adminWebpackConfig from './src/pages/admin/webpack.config';

gulp.task('admin-js', ['clean'], (cb) => {
  webpack(adminWebpackConfig, (err, stats) => {
    if (err) throw new plugins.util.PluginError('webpack', err);

    plugins.util.log('[webpack]', stats.toString());

    cb();
  });
});

gulp.task('admin-html', ['clean'], () => {
  return gulp
    .src('./src/pages/admin/src/index.html')
    .pipe(plugins.rename('admin.html'))
    .pipe(gulp.dest('./views'));
});

gulp.task('clean', (cb) => {
  rimraf('./views', cb);
});

gulp.task('build', ['admin-js', 'admin-html']);

gulp.task('watch', ['default'], () => {
  gulp.watch('admin/**/*', ['build']);
});

gulp.task('default', ['build']);
