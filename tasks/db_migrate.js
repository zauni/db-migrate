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
     * @param  {Array}    mysqldump_cli_args Additional command line options for mysqldump
     * @param  {String}   bin       Path to mysqldump binary
     * @param  {Function} callback  Callback when dump finished
     * @return {void}
     */
    function dump(filename, conn, tables, mysqldump_cli_args, bin, callback) {
        var args = mysqldump_cli_args != null ? mysqldump_cli_args : [];

        args.push(
            '-h' + conn['host'],
            '-u' + conn.user,
            '-p' + conn.pass,
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
     * Executes mysqldump on a remote database
     * @param  {Object}   remote    SSH connection object
     * @param  {String}   filename  File where mysqldump is saved in
     * @param  {Object}   conn      Mysql connection details
     * @param  {Array}    tables    Which tables should be dumped?
     * @param  {Array}    mysqldump_cli_args Additional command line options for mysqldump
     * @param  {String}   bin       Path to mysqldump binary
     * @param  {Function} callback  Callback when dump finished
     * @return {void}
     */
    function dumpRemote(remote, filename, conn, tables, mysqldump_cli_args, bin, callback) {
        var args = mysqldump_cli_args != null ? mysqldump_cli_args : [];

        args.push(
            '-h' + conn.host,
            '-u' + conn.user,
            '-p' + conn.pass,
            '--result-file=' + filename + '',
            conn.database
        );

        if(_.isArray(tables)) {
            args.push(tables.join(' '));
        }

        remote.exec(bin + ' ' + args.join(' '), function(err, stream) {
            if (err) {
                callback(err);
                return;
            }
            stream.on('exit', function(code, signal) {
                if(code === 0) {
                    grunt.log.writeln('Dump created for "' + conn.database + '"');
                }
                else {
                    grunt.log.error('Could not create a dump for "' + conn.database + '"');
                }

                callback(code !== 0 ? 'Fehler! ' + signal : null);
            });
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
            '-p' + conn.pass,
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

    /**
     * Executes the SQL from the dump in a remote database
     * @param  {Object}   remote   SSH connection object
     * @param  {String}   filename SQL File
     * @param  {Object}   conn     Mysql connection details
     * @param  {String}   bin      Path to mysql binary
     * @param  {Function} callback Callback when SQL finished executing
     * @return {void}
     */
    function execDumpRemote(remote, filename, conn, bin, callback) {
        var args = [];

        args.push(
            '-h' + conn.host,
            '-u' + conn.user,
            '-p' + conn.pass,
            '--database=' + conn.database
        );

        remote.exec(bin + ' ' + args.join(' '), function(error, stream) {
            if (error) {
                callback(error);
                return;
            }

            stream.on('exit', function(code, signal) {
                if(code === 0) {
                    grunt.log.writeln('Dump executed in "' + conn.database + '"');
                }
                else {
                    grunt.log.error('Could not execute the dump for "' + conn.database + '"');
                }
                callback(code !== 0 ? 'Fehler! ' + signal : null);
            });

            stream.setEncoding = 'utf-8';
            stream.write('source ' + filename + '');
            stream.end();
        });
    }



    // Task

    grunt.registerMultiTask('db_migrate', 'Migrates one database to another.', function() {

        var
            // Callback when task finished
            done = this.async(),

            // Default options merged with options from gruntfile
            options = this.options({
                dry: false,
                onRemote: false,
                local: {
                    mysqldump_bin: 'bin/mysqldump',
                    mysql_bin: 'bin/mysql'
                },
                remote: {
                    mysqldump_bin: 'mysqldump',
                    mysql_bin: 'mysql',
                    host: 'test.com',
                    user: 'test',
                    pass: 'test',
                    dump_dir: './'
                },
                tables: null,
                db_src: {
                    host: 'localhost',
                    user: 'test',
                    pass: 'test',
                    database: 'migrate-source'
                },
                db_dest: {
                    host: 'localhost',
                    user: 'test',
                    pass: 'test',
                    database: 'migrate-destination'
                },
                mysqldump_cli_args: null
            });


        grunt.verbose.writeflags(options, 'Options');

        for(var key in options[options.onRemote ? 'remote' : 'local']) {
            options[key] = options.remote[key];
        }

        if(!options.onRemote) {
            async.parallel(
                [
                    function(callback) {
                        tmp.file({ mode: parseInt(755, 8), postfix: '-destinationbackup.sql' }, callback);
                    },
                    function(callback) {
                        tmp.file({ mode: parseInt(755, 8), postfix: '-dump.sql' }, callback);
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
                                dump(results[0], options.db_dest, options.tables, options.mysqldump_cli_args, options.mysqldump_bin, callback);
                            },
                            function(callback) {
                                dump(results[1], options.db_src, options.tables, options.mysqldump_cli_args, options.mysqldump_bin, callback);
                            },
                            function(callback) {
                                if(!options.dry) {
                                    execDump(results[1], options.db_dest, options.mysql_bin, callback);
                                }
                                else {
                                    callback();
                                }
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
        }
        else {
            var Connection = require('ssh2'),
                c = new Connection();

            c.on('ready', function() {
                async.series(
                    [
                        function(callback) {
                            dumpRemote(c, options.dump_dir + '.destinationbackup.sql', options.db_dest, options.tables, options.mysqldump_cli_args, options.mysqldump_bin, callback);
                        },
                        function(callback) {
                            dumpRemote(c, options.dump_dir + '.dump.sql', options.db_src, options.tables, options.mysqldump_cli_args, options.mysqldump_bin, callback);
                        },
                        function(callback) {
                            if(!options.dry) {
                                execDumpRemote(c, options.dump_dir + '.dump.sql', options.db_dest, options.mysql_bin, callback);
                            }
                            else {
                                callback();
                            }
                        }
                    ],
                    function(err) {
                        if(err) {
                            grunt.log.error(err);
                            done(err);
                            return;
                        }
                        c.end();
                        done();
                    }
                );
            });

            c.connect({
                host: options.host,
                port: 22,
                username: options.user,
                password: options.pass
            });
        }
    });

};
