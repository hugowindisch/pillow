#!/usr/local/bin/node
/**
    grind.js
        This will grind directories, find the package.json files and then
        publish the package.json files in a statically servable directory
        structure (that can be compressed to a web widget for example)

    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
/*globals __dirname, __filename */
/*jslint regexp: false */
var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    dust = require('dust'),
    assetExt = { 'jpg': 0, 'png': 0, 'gif': 0, 'html': 0, 'json': 0, 'css': 0, 'vis': 0 },
    argFilters = [
        {
            filter: /^--help$/,
            name: '--help',
            help: 'displays help information',
            action: function (pat, filters) {
                filters.forEach(function (f) {
                    console.log(f.name + ': ' + f.help);
                });
            }
        },
        {
            filter: /^-jquery=(.*)$/,
            name: '-jquery=filepath',
            help: 'includes and integrates jquery using the provided sources',
            action: function (pat) {
                return {
                    jquery: pat[1]
                };
            }
        },
        {
            filter: /^-only=(.*)$/,
            name: '-only=pathRelativeToDstFolder',
            help: 'only remakes the specified file',
            action: function (pat) {
                return {
                    only: pat[1]
                };
            }
        },
        {
            filter: /^-cache=(.*)$/,
            name: '-cache=packageName',
            help: 'Use http caches for the specified package',
            action: function (pat) {
                return {
                    cache: [pat[1]]
                };
            }
        },
        {
            filter: /^-css$/,
            name: '-css',
            help: 'Includes all dependent css files in the resulting html',
            action: function (pat) {
                return {
                    css: true
                };
            }
        },
        {
            filter: /.*/,
            name: 'srcFolder [srcFolder2...srcFolderN] dstFolder',
            help: 'src folder',
            action: function (pat) {
                return {
                    srcFolder: [pat[0]]
                };
            }
        }
    ];


// disable newline and whitespace removal
dust.optimizers.format = function (ctx, node) {
    return node;
};

// synchronously load the templates that we need when this module is loaded
dust.loadSource(
    dust.compile(
        fs.readFileSync(
            path.join(__dirname, 'templates/src.js')
        ).toString(),
        'srcTemplate'
    )
);
dust.loadSource(
    dust.compile(
        fs.readFileSync(
            path.join(__dirname, 'templates/header.js')
        ).toString(),
        'headerTemplate'
    )
);
dust.loadSource(
    dust.compile(
        fs.readFileSync(
            path.join(__dirname, 'templates/component.html')
        ).toString(),
        'componentTemplate'
    )
);

/**
    Concatenates two objects.
*/
function concatObject(dst, src) {
    var k;
    for (k in src) {
        if (src.hasOwnProperty(k)) {
            dst[k] = src[k];
        }
    }
    return dst;
}


/**
    Creates a folder if the folder does not already exist.
*/
function createFolder(foldername, cb) {
    var fn = path.resolve(foldername),
        basedir = path.dirname(fn);

    function makeUnexistingDir(dirname, cb) {
        path.exists(dirname, function (exists) {
            fs.mkdir(dirname, '0775', function (err) {
                var eExist = /^EEXIST/;
                if (!err || eExist.test(err.message)) {
                    err = null;
                }
                cb(err);
            });
        });
    }
    path.exists(basedir, function (exists) {
        if (!exists) {
            createFolder(basedir, function (err) {
                if (err) {
                    return cb(err);
                }
                makeUnexistingDir(fn, cb);
            });
        } else {
            makeUnexistingDir(fn, cb);
        }
    });
}

/**
    Copies a file.
*/
function copyFile(from, to, cb) {
    fs.readFile(from, function (err, data) {
        if (err) {
            return cb(err);
        }
        createFolder(to, function (err) {
            var dstFile = path.join(to, path.basename(from));
            if (err) {
                return cb(err);
            }
            fs.writeFile(dstFile, data, function (err) {
                cb(err);
            });
        });
    });
}

/**
    Updates a file (copies it if it does not exist or if it is
    out dated).
*/
function copyFileIfOutdated(from, to, cb) {
    async.map([from, path.join(to, path.basename(from))], fs.stat, function (err, stats) {
        if (err || stats[1].mtime.getTime() < stats[0].mtime.getTime()) {
            copyFile(from, to, cb);
        } else {
            // nothing to do
            cb(null);
        }

    });
}

/**
    Checks if a file is older than a given date
*/
function checkOlderOrInvalid(fn, date, cb) {
    fs.stat(fn, function (err, stats) {
        cb(null, err || (stats.mtime.getTime() < date.getTime()));
    });
}

/**
    Finds files that matches a given pattern in an object
    { filename: filestat }
*/
function filterStats(stats, regexp) {
    var res = {};
    Object.keys(stats).forEach(function (s) {
        if (regexp.test(s)) {
            res[s] = stats[s];
        }
    });
    return res;
}

/**
    Finds the latest date for a given regexp
    { filename: filestat }
*/
function getMostRecent(stats, regexp) {
    var s = filterStats(stats, regexp),
        ret = new Date();
    ret.setTime(0);
    Object.keys(s).forEach(function (k) {
        var stat = s[k];
        if (stat.mtime.getTime() > ret.getTime()) {
            ret = stat.mtime;
        }
    });
    return ret;
}


/**
    Returns a package map that contains a package an all its recursive dependencies.
*/
function getPackageDependencies(packageMap, packageName) {
    function gd(res, name) {
        var p = packageMap[name],
            dep;
        if (p) {
            res[name] = p;
            dep = p.json.dependencies;
            if (dep) {
                Object.keys(dep).forEach(function (k) {
                    // FIXME we should validate versions
                    gd(res, k);
                });
            }
        } else {
            throw new Error("Missing Package");
        }
    }
    var res = {};
    gd(res, packageName);
    return res;
}

/**
    Returns a unified { filename: stats} for a package map.
*/
function getFileMap(packageMap) {
    var res = {};
    Object.keys(packageMap).forEach(function (k) {
        var p = packageMap[k];
        concatObject(res, p.stats);
    });
    return res;
}

/**
    Publishes an asset such as a jpg or png by copying it in the
    deployment directory.
*/
function publishAsset(
    options,
    modulename,
    modulerootfolder,
    filename,
    cb
) {
    var dstfile = path.join(options.dstFolder, modulename, filename.slice(modulerootfolder.length)),
        dstfolder = path.dirname(dstfile);

    //console.log('publishAsset ' + filename + ' to ' + dstfolder);
    copyFileIfOutdated(filename, dstfolder, cb);
}

/**
    Loads a js file (as text), packages it in a module closure and adds
    this module closure to a module.
*/
function publishJSFile(
    modulename,
    modulerootfolder,
    filename,
    dependencies,
    jsstream,
    cb
) {
    // we want to split the path
    //filename.split(
    var meatPath = modulename + filename.slice(modulerootfolder.length, -3);

    async.waterfall([
        function (cb) {
            fs.readFile(filename, cb);
        },
        function (filecontent, cb) {
            var indented = filecontent.toString().split('\n').map(function (line) {
                    return '    ' + line;
                }).join('\n');

            dust.render('srcTemplate', {
                modulename: modulename,
                filepath: meatPath,
                code: indented,
                dependencies: dependencies
            }, cb);

        },
        function (out, cb) {
            jsstream.write(out);
            cb(null);
        }
    ], cb);
}

/**
    Finds by guessing the module path.
    These will be tried in order:
        packagname.js
        /lib/packagename.js

    getMainModulePath
*/
function getMainModulePath(details) {
    if (details.json.main) {
        return details.json.main;
    }
    var regExp = new RegExp(details.name + '\\.js$'),
        res;
    details.js.forEach(function (n) {
        var s;
        if (regExp.test(n)) {
            s = details.name + n.slice(details.dirname.length, -3);
            if (!res || s.length < res.length) {
                res = s;
            }
        }
    });
    return res;
}

/**
    Publishes all the js files in the package (the files are combined into
    one single js file).
*/
function publishJSFiles(
    options,
    details,
    packageMap,
    deps,
    cb
) {
    var publishdir = path.join(options.dstFolder, details.name),
        publishJsStream = path.join(publishdir, details.name + '.js'),
        stream = fs.createWriteStream(publishJsStream),
        dependencies = [ ];
    if (deps) {
        Object.keys(deps).forEach(function (d) {
            if (d !== details.name) {
                dependencies.push(d);
            }
        });
    }

    async.forEach(details.js, function (f, cb) {
        publishJSFile(
            details.name,
            details.dirname,
            f,
            dependencies,
            stream,
            cb
        );
    }, function (err) {
        if (err) {
            return cb(err);
        }
        dust.render('headerTemplate', {
            modulename: details.name,
            dependencies: dependencies,
            modulepath: getMainModulePath(details)
        }, function (err, out) {
            if (err) {
                return cb(err);
            }
            stream.write(out);
            cb(err);
        });
    });
}

/**
    Publishes the html that allows to run the package in a browser
    using a standalone statically loaded html.
*/
function publishHtml(
    options,
    details,
    packageMap,
    deps,
    cb
) {
    // we need to load all components
    var dependencies = [ ],
        cssFileMap = options.css ? filterStats(getFileMap(deps), /\.css$/) : {},
        cssFiles = [];
    if (deps) {
        Object.keys(deps).forEach(function (d) {
            dependencies.push(path.join(d, d + '.js'));
        });
        Object.keys(cssFileMap).forEach(function (k) {
            var details = cssFileMap[k].details;
            cssFiles.push(details.name + k.slice(details.dirname.length));
        });
    }
    dust.render('componentTemplate', {
        dependencies: dependencies,
        css: cssFiles,
        main: details.name,
        jquery: options.jquery ? path.basename(options.jquery) : null
    }, function (err, data) {
        if (err) {
            return cb(err);
        }
        fs.writeFile(
            path.join(options.dstFolder, details.name + '.html'),
            data,
            cb
        );
    });
}

/**
    Publishes the meat file itself. This is a simple file copy.
*/
function publishMeat(
    outputfolder,
    cb
) {
    copyFileIfOutdated(path.join(__dirname, 'meat.js'), outputfolder, cb);
}

/**
    Generates the published form of a given package.
*/
function makePublishedPackage(
    options,
    details,
    packageMap,
    cb
) {
    var mostRecentJSDate = getMostRecent(details.stats, new RegExp("(\\.js$|" + details.name + "\\.json)")),
        deps = getPackageDependencies(packageMap, details.name),
        depsFileMap = getFileMap(deps),
        cssMostRecentDate = options.css ? getMostRecent(depsFileMap, /\.css$/) : mostRecentJSDate;

    async.parallel([
        function (cb) {
            checkOlderOrInvalid(
                path.join(options.dstFolder, details.name, details.name + '.js'),
                mostRecentJSDate,
                function (err, older) {
                    if (older) {
                        publishJSFiles(options, details, packageMap, deps, cb);
                    } else {
                        cb(err);
                    }
                }
            );
        },
        function (cb) {
            async.forEach(details.other, function (f, cb) {
                publishAsset(
                    options,
                    details.name,
                    details.dirname,
                    f,
                    cb
                );
            }, cb);
        },
        function (cb) {
            if (mostRecentJSDate.getTime() > cssMostRecentDate.getTime()) {
                cssMostRecentDate = mostRecentJSDate;
            }
            // FIXME: publishHtml does not depend on jquery (important?)
            checkOlderOrInvalid(
                path.join(options.dstFolder, details.name + '.html'),
                cssMostRecentDate,
                function (err, older) {
                    if (older) {
                        publishHtml(options, details, packageMap, deps, cb);
                    } else {
                        cb(err);
                    }
                }
            );
        },
        function (cb) {
            publishMeat(options.dstFolder, cb);
        },
        function (cb) {
            if (options.jquery) {
                copyFileIfOutdated(options.jquery, options.dstFolder, cb);
            } else {
                cb(null);
            }
        }
    ], cb);

}

/**
    Finds all package files (all files that we want to process)
    and returns them in an object
    {
        packageFile: {}
        js: [],
        other: []
    }
*/
function findPackageFiles(folder, details, cb) {
    // make sure we have what we need
    if (!details.js) {
        details.js = [];
    }
    if (!details.other) {
        details.other = [];
    }
    if (!details.stats) {
        details.stats = {};
    }
    // do the async processing
    async.waterfall(
        [
            // read the dir
            function (cb) {
                fs.readdir(folder, cb);
            },
            // stat all files
            function (files, cb) {
                async.map(
                    files,
                    function (filename, cb) {
                        fs.stat(path.join(folder, filename), function (err, stats) {
                            if (err) {
                                return cb(err);
                            }
                            cb(err, {filename: filename, stats: stats});
                        });
                    },
                    cb
                );
            },
            // with the stats
            function (stats, cb) {
                // process all files
                async.forEach(
                    stats,
                    function (file, cb) {
                        var isJs = /\.js$/,
                            getExt = /\.(\w+)$/,
                            matches,
                            ffn = path.join(folder, file.filename);
                        if (file.stats.isFile()) {
                            // keep a pointer to the details
                            file.stats.details = details;
                            // js file
                            if (isJs.test(file.filename)) {
                                details.stats[ffn] = file.stats;
                                details.js.push(ffn);
                            } else {
                                matches = getExt.exec(file.filename);
                                if (matches && assetExt[matches[1]] !== undefined) {
                                    details.stats[ffn] = file.stats;
                                    details.other.push(ffn);
                                }
                            }
                            // nothing really async here
                            cb(null);
                        } else if (file.stats.isDirectory()) {
                            findPackageFiles(ffn, details, cb);
                        }
                    },
                    cb
                );
            }
        ],
        function (err) {
            cb(err, details);
        }
    );
}


/**
    Loads the details of a package: its package.json file and
    the paths of all its contained files (js, other like gifs and jpgs)
*/
function loadPackageDetails(packageFile, cb) {
    var details = {
        filename: packageFile.filename,
        // FIXME: this does not use the package info
        dirname: path.dirname(packageFile.filename),
        js: [],
        other: []
    };
    fs.readFile(packageFile.filename, function (err, data) {
        if (err) {
            return cb(err);
        }
        // FIXME: try catch
        details.json = JSON.parse(data.toString());
        details.name = details.json.name || path.basename(details.dirname);

        findPackageFiles(details.dirname, details, cb);
    });
}


/**
    Processes a package.json file that has been loaded with its "details".
*/
function processPackageDetails(options, details, packageMap, cb) {
    var dirname = details.dirname,
        // we should use the package.name for the packagename
        packagename = details.name,
        publishdir = path.join(options.dstFolder, packagename);

    // create an output dir for this package
    createFolder(publishdir, function (err) {
        if (err) {
            return cb(err);
        }
        makePublishedPackage(
            options,
            details,
            packageMap,
            cb
        );
    });
}

/**
    Processes multiple package details (the packages are given as a package map).
*/
function processMultiplePackageDetails(options, packages, cb) {
    async.forEach(
        Object.keys(packages),
        function (pd, cb) {
            processPackageDetails(options, packages[pd], packages, cb);
        },
        cb
    );
}

/**
    Finds packages from a given folder and calls cb(err, packages) where
    packages is an array of package details.
*/
function findPackagesFromSingleFolder(rootfolder, cb) {
    // search folders for package.json
    async.waterfall(
        [
            // read the dir
            function (cb) {
                fs.readdir(rootfolder, cb);
            },
            // stat all files
            function (files, cb) {
                async.map(files, function (filename, cb) {
                    fs.stat(path.join(rootfolder, filename), function (err, stats) {
                        if (err) {
                            return cb(err);
                        }
                        cb(err, {filename: filename, stats: stats});
                    });
                }, cb);
            },
            // for files that are js
            function (stats, cb) {
                var found = [], results = {};
                // process all files
                async.forEach(stats, function (file, cb) {
                    var isJs = /package\.json$/;
                    if (file.stats.isFile()) {
                        if (isJs.test(file.filename)) {
                            found.push({filename: path.join(rootfolder, file.filename), stats: file.stats});
                            return cb(null);
                        } else {
                            cb(null);
                        }
                    } else if (file.stats.isDirectory()) {
                        findPackagesFromSingleFolder(
                            path.join(rootfolder, file.filename),
                            function (err, res) {
                                if (!err) {
                                    concatObject(results, res);
                                }
                                cb(err);
                            }
                        );
                    }
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    return cb(null, found, results);
                });
            },
            // load the package details of the found files and add them to the results
            function (found, results, cb) {
                async.map(found, loadPackageDetails, function (err, detailArray) {
                    if (err) {
                        return cb(err);
                    }
                    // map all the results
                    detailArray.forEach(function (d) {
                        results[d.name] = d;
                    });
                    // return the map
                    cb(null, results);
                });
            }
        ],
        cb
    );
}

/**
    Finds packages from multiple folders.
    note: folderArray can be a string or an array of strings
*/
function findPackages(folderArray, cb) {
    if (!(folderArray instanceof Array)) {
        findPackagesFromSingleFolder(folderArray, cb);
    } else {
        var packages = {};
        async.map(folderArray, findPackagesFromSingleFolder, function (err, res) {
            if (err) {
                return cb(err);
            }
            res.forEach(function (r) {
                concatObject(packages, r);
            });
            cb(null, packages);
        });
    }
}

/**
    This function regenerates all packages.
    note: srcFolder can be a string or an array of strings
*/
function makeAll(options, cb) {
    findPackages(options.srcFolder, function (err, packages) {
        if (err) {
            return cb(err);
        }
        processMultiplePackageDetails(options, packages, cb);
    });
}

/**
    This function regenerates a single package.
    note: srcFolder can be a string or an array of strings
*/
function makePackage(options, packageName, cb) {
    findPackages(options.srcFolder, function (err, packages) {
        var deps;
        if (err) {
            return cb(err);
        }
        try {
            deps = getPackageDependencies(packages, packageName);
        } catch (e) {
            return cb(e);
        }
        processMultiplePackageDetails(options, deps, cb);
    });
}

/**
    This function regenerates a single file (or a full package if
    a package name is specified).
    note: srcFolder can be a string or an array of strings
*/
function makeFile(options, dstFolderRelativeFilePath, cb) {
    // the provided relative path should be relative to the dstFolder
    // and consequently the first subdir should be the package name
    var assetFolder = path.normalize(dstFolderRelativeFilePath),
        assetFolderRoot,
        splitFolder = assetFolder.split('/');
    if (splitFolder.length > 1) {
        assetFolderRoot = splitFolder[0];
    } else if (/\.html$/.test(dstFolderRelativeFilePath)) {
        assetFolderRoot = dstFolderRelativeFilePath.slice(0, -5);
    } else if (dstFolderRelativeFilePath.indexOf('.') === -1) {
        assetFolderRoot = dstFolderRelativeFilePath;
    } else {
        // FIXME
        // nothing to regenerate (maybe in fact the meat.js thing)
        publishMeat(
            options.dstFolder,
            cb
        );
        return;
    }
    // non optimal but ok for now
    makePackage(options, assetFolderRoot, cb);
}

/**
    Parses the command line for creating the options object.
    {
        srcFolder: [],
        dstFolder: "string",
        // optional
        jQuery: "path to jquery's .js file",
        // optional, not yet supported
        jsmin: true|false,
        jslint: true|false
    }

    // command line args:
    -jquery=path    includes jquery using the specified path to the jquery source
    // not yet supported
    -hide=global1,global2,globaln makes some globals hidden to modules (ex: hide window or document)
    -nohide=module1,module2,module3 modules that should see everything

    followed by multiple src folders
    followed by one dst folder
*/
function processArgs(args, filters) {
    var options = { srcFolder: []},
        resopt;
    filters = filters || argFilters;

    function concatOptions(o) {
        if (o) {
            Object.keys(o).forEach(function (n) {
                var p = o[n];
                // concatenate arrays
                if (p instanceof Array) {
                    if (!(options[n] instanceof Array)) {
                        options[n] = [];
                    }
                    options[n] = options[n].concat(p);

                } else {
                    options[n] = p;
                }
            });
        }
    }

    // filter the args
    args.forEach(function (a) {
        filters.some(function (f) {
            var m = f.filter.exec(a);
            if (m) {
                concatOptions(f.action(m, filters));
                return true;
            }
            return false;
        });
    });
    // fix the object for the dst Folder
    if (options.srcFolder.length > 1) {
        options.dstFolder = options.srcFolder.pop();
    } else {
        // failure
        options = null;
    }
    return options;
}


/**
    Command line support.
*/
(function () {
    var options;
    if (process.argv[1] === __filename) {
        options = processArgs(process.argv.slice(2));
        if (options) {
            if (options.only) {
                makeFile(options, options.only, function (err) {
                    if (err) {
                        console.log(err);
                    }
                });
            } else {
                makeAll(options, function (err) {
                    if (err) {
                        console.log(err);
                    }
                });
            }
        } else {
            processArgs(['--help']);
        }
    }
}());

/**
    Library support.
*/
exports.makeAll = makeAll;
exports.makePackage = makePackage;
exports.makeFile = makeFile;
exports.processArgs = processArgs;
exports.argFilters = argFilters;
exports.findPackages = findPackages;
