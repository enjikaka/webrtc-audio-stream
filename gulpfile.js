const gulp = require('gulp');
const sass = require('gulp-sass');
const concat = require('gulp-concat');
const autoprefixer = require('gulp-autoprefixer');
const closureCompiler = require('google-closure-compiler-js').gulp();

gulp.task('html', () => {
  gulp.src('src/*.html')
      .pipe(gulp.dest('dist'));
});

gulp.task('sass', () => {
  gulp.src('src/css/*.scss')
      .pipe(sass())
      .pipe(autoprefixer())
      .pipe(gulp.dest('dist/css'));
});

gulp.task('script', () => {
  const defaultCloseCompilerOptions = {
    compilationLevel: 'SIMPLE',
    warningLevel: 'VERBOSE',
    createSourceMap: true,
    externs: [
      {
        src: 'var io = {};'
      }
      ,
      {
        src: 'var ID3 = {};'
      },
      {
        src: 'var jsmediatags = {};'
      }
    ]
  };

  const closureCompilerOptionsStation = Object.assign(
    {},
    defaultCloseCompilerOptions,
    { jsOutputFile: 'station.min.js' }
  );

  const closureCompilerOptionsReceiver = Object.assign(
    {},
    defaultCloseCompilerOptions,
    { jsOutputFile: 'receiver.min.js' }
  );

  gulp.src('src/js/adapter.js')
      .pipe(gulp.dest('dist'));

  gulp.src([
    'src/js/fake-jquery.js',
    'src/js/WaveformGenerator.js',
    'src/js/station.js',
    'src/js/station-ui.js'
  ])
  .pipe(concat('station.concat.js'))
  .pipe(closureCompiler(closureCompilerOptionsStation))
  .pipe(gulp.dest('./dist'));

  gulp.src([
    'src/js/fake-jquery.js',
    'src/js/receiver.js',
    'src/js/receiver-chat.js',
    'src/js/receiver-ui.js'
  ])
  .pipe(concat('receiver.concat.js'))
  .pipe(closureCompiler(closureCompilerOptionsReceiver))
  .pipe(gulp.dest('./dist'));
});

gulp.task('sass:watch', () => gulp.watch('app/css/*.scss', ['sass']));
gulp.task('script:watch', () => gulp.watch('src/js/*.js', ['script']));

gulp.task('watch', ['script:watch', 'sass:watch']);

gulp.task('default', ['sass', 'script', 'html']);
