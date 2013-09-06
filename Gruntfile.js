/*
 * grunt-db-migrate
 * https://github.com/zauni/db-migrate
 *
 * Copyright (c) 2013 Matthias Zaunseder
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        jshint: {
            all: [
                'Gruntfile.js',
                'tasks/*.js',
                '<%= nodeunit.tests %>'
            ],
            options: {
                jshintrc: '.jshintrc'
            },
        },

        // Before generating any new files, remove any previously-created files.
        clean: {
            tests: ['tmp']
        },

        // Configuration to be run (and then tested).
        db_migrate: {
            default_options: {
                options: {}
            },
            remote: {
                options: {
                    onRemote: true,
                    remote: {
                        mysqldump_bin: 'mysqldump',
                        mysql_bin: 'mysql',
                        host: '192.168.1.243',
                        user: 'gup',
                        pass: 'webunit'
                    },
                    db_src: {
                        host: '192.168.1.243',
                        user: 'test',
                        pass: 'test',
                        database: 'migrate-source'
                    },
                    db_dest: {
                        host: '192.168.1.243',
                        user: 'test',
                        pass: 'test',
                        database: 'migrate-destination'
                    }
                }
            }
        },

        // Unit tests.
        nodeunit: {
            tests: ['test/*_test.js']
        }

    });

    // Actually load this plugin's task(s).
    grunt.loadTasks('tasks');

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-nodeunit');

    // Whenever the "test" task is run, first clean the "tmp" dir, then run this
    // plugin's task(s), then test the result.
    grunt.registerTask('test', ['clean', 'db_migrate', 'nodeunit']);

    // By default, lint and run all tests.
    grunt.registerTask('default', ['jshint', 'test']);

};