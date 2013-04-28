/*
 * grunt-db-migrate
 * https://github.com/zauni/db-migrate
 *
 * Copyright (c) 2013 Matthias Zaunseder
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

    var tmp = require('tmp'),
        async = grunt.util.async,
        _ = grunt.util._;

    /**
     * Executes mysqldump on a specified database
     * @param  {String}   filename  File where mysqldump is saved in
     * @param  {Object}   conn      Mysql connection details
     * @param  {Array}    tables    Which tables should be dumped?
     * @param  {Array}    mysqldump Additional command line options for mysqldump
     * @param  {String}   bin       Path to mysqldump binary
     * @param  {Function} callback  Callback when dump finished
     * @return {void}
     */
    function dump(filename, conn, tables, mysqldump, bin, callback) {
        var args = mysqldump != null ? mysqldump : [];

        args.push(
            '-h' + conn['host'],
            '-u' + conn.user,
            '-p' + conn.password,
            '--result-file=' + filename + '',
            conn.database
        );

        if(_.isArray(tables)) {
            args.push(tables.join(' '));
        }

        grunt.util.spawn({
            cmd: bin,
            args: args
        }, function(error, result, code) {
            if(!error) {
                grunt.log.writeln('Dump created for "' + conn.database + '"');
            }
            else {
                grunt.log.error('Could not create a dump for "' + conn.database + '", because: ' + error.toString());
            }

            callback(error);
        });
    }

    /**
     * Executes the SQL from the dump in a database
     * @param  {String}   filename SQL File
     * @param  {Object}   conn     Mysql connection details
     * @param  {String}   bin      Path to mysql binary
     * @param  {Function} callback Callback when SQL finished executing
     * @return {void}
     */
    function execDump(filename, conn, bin, callback) {
        var args = [],
            proc;

        args.push(
            '-h' + conn.host,
            '-u' + conn.user,
            '-p' + conn.password,
            '--database=' + conn.database
        );

        proc = grunt.util.spawn({
            cmd: bin,
            args: args
        }, function(error, result, code) {
            if(!error) {
                grunt.log.writeln('Dump executed in "' + conn.database + '"');
            }
            else {
                grunt.log.error('Could not execute the dump for "' + conn.database + '", because: ' + error.toString());
            }

            callback(error);
        });

        proc.stdin.setEncoding = 'utf-8';
        proc.stdin.write('source ' + filename + '');
        proc.stdin.end();
    }

    // Please see the Grunt documentation for more information regarding task
    // creation: http://gruntjs.com/creating-tasks

    grunt.registerMultiTask('db_migrate', 'Migrates one database to another.', function() {

        var
            // Callback when task finished
            done = this.async(),

            // Default options merged with options from gruntfile
            options = this.options({
                mysqldump_bin: 'bin/mysqldump',
                mysql_bin: 'bin/mysql',
                tables: null,
                db_src: {
                    host: 'localhost',
                    user: 'test',
                    password: 'test',
                    database: 'migrate-source'
                },
                db_dest: {
                    host: 'localhost',
                    user: 'test',
                    password: 'test',
                    database: 'migrate-destination'
                },
                mysqldump: null
            });


        grunt.verbose.writeflags(options, 'Options');

        async.parallel(
            [
                function(callback) {
                    tmp.file({ mode: parseInt(777, 8), postfix: '-destinationbackup.sql' }, callback);
                },
                function(callback) {
                    tmp.file({ mode: parseInt(777, 8), postfix: '-dump.sql' }, callback);
                }
            ],
            function(err, results) {
                if(err) {
                    grunt.log.error(err);
                    done(err);
                    return;
                }

                async.series(
                    [
                        function(callback) {
                            dump(results[0], options.db_dest, options.tables, options.mysqldump, options.mysqldump_bin, callback);
                        },
                        function(callback) {
                            dump(results[1], options.db_src, options.tables, options.mysqldump, options.mysqldump_bin, callback);
                        },
                        function(callback) {
                            execDump(results[1], options.db_dest, options.mysql_bin, callback);
                        }
                    ],
                    function(err) {
                        if(err) {
                            grunt.log.error(err);
                            done(err);
                            return;
                        }
                        done();
                    }
                );
            }
        );
    });

};
