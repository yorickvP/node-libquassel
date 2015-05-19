'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    browserify: {
      dist: {
        src: ['client/iefix.js'],
        dest: 'client/libquassel.js',
        options: {
          alias: [
            './lib/network.js:network',
            './node_modules/extend/index.js:extend',
            './lib/serializer.js:serializer',
            './lib/hashmap.js:serialized-hashmap',
            './lib/user.js:user',
            './lib/buffer.js:buffer',
            './lib/message:message',
            './lib/ignore:ignore'
          ]
        }
      }
    },
    watch: {
      lib: {
        files: 'lib/*.js',
        tasks: ['browserify']
      },
    },
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task.
  grunt.registerTask('default', ['browserify']);

};
