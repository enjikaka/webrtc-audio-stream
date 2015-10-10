var gulp = require('gulp');
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');

gulp.task('sass', function() {
	gulp.src('app/css/*.scss')
		.pipe(sass())
		.pipe(autoprefixer())
		.pipe(gulp.dest('app/css'));
});

gulp.task('sass:watch', function() {
	gulp.watch('app/css/*.scss', ['sass']);
});