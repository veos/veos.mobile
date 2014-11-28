module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      all: ['Gruntfile.js', 'js/*.js']
    },
    uglify: {
      options: {
        mangle: false
      },
      minlib: {
        files: {
          'js/libs/jquery.mobile.autoComplete-1.4.3.min.js': ['js/libs/jquery.mobile.autoComplete-1.4.3.js']
        }
      },
      minown: {
        files: {
          'js/bundle.js': ['js/veos.js', 'js/veos.map.js', 'js/veos.model.js', 'js/veos.view.js']
        }
      }
    },
    concat: {
      options: {
        separator: '\r\n'
      },
      dist: {
        src: ['js/libs/jquery.mobile-1.3.2.min.js',
              'js/libs/jquery.mobile.autoComplete-1.4.3.min.js',
              'js/libs/underscore-1.6.0.min.js',
              'js/libs/backbone-1.1.2.min.js',
              'bower_components/backbone.paginator/lib/backbone.paginator.min.js'],
        dest: 'js/libs/debs.postinit.bundle.js',
      },
      own: {
        src: ['js/veos.js', 'js/veos.map.js', 'js/veos.model.js', 'js/veos.view.js'],
        dest: 'js/veos.bundle.js',
      }
    },
    processhtml: {
      options: {
        // Task-specific options go here.
      },
      dist: {
        // Target-specific file lists and/or options go here.
        files: {
          'app-dist.html': ['app.html']
        }
      },
    },
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-processhtml');

  // Default task(s) .
  // grunt.registerTask('default', ['uglify']);
  grunt.registerTask('default', ['uglify:minlib', 'concat:dist', 'concat:own']);
  grunt.registerTask('lint', ['jshint']);
  grunt.registerTask('dist', ['jshint', 'uglify:minlib', 'concat:dist', 'concat:own', 'processhtml']);
};