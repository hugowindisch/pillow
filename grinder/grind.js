/**
    grind.js
        This will grind directories, find the package.json files and then
        publish the package.json files in a statically servable directory
        structure (that can be compressed to a web widget for example)
        
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
/*globals __dirname, __filename */
var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    dust = require('dust'),
    assetExt = { 'jpg': 0, 'png': 0, 'gif': 0 };
  
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
    Publishes an asset such as a jpg or png by copying it in the
    deployment directory.
*/
function publishAsset(
    modulename, 
    modulerootfolder, 
    filename,  
    outputfolder, 
    cb
) {    
    var dstfile = path.join(outputfolder, modulename, filename.slice(modulerootfolder.length)),
        dstfolder = path.dirname(dstfile);
        
    console.log('publishAsset ' + filename + ' to ' + dstfolder);
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
    jsstream, 
    cb
) {    
    // we want to split the path
    //filename.split(
    var meatPath = filename.slice(modulerootfolder.length + 1, -3);
    
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
                code: indented
            }, cb);
            
        },
        function (out, cb) {
            jsstream.write(out);
            cb(null);
        }
    ], cb);
}

/**
    Publishes all the js files in the package (the files are combined into
    one single js file).
*/
function publishJSFiles(
    details,
    outputfolder,
    cb
) {
    var publishdir = path.join(outputfolder, details.name),
        publishJsStream = path.join(publishdir, details.name + '.js'),
        stream = fs.createWriteStream(publishJsStream);        
    // make sure we know how to find the main file of the package
    stream.write('meat.setPackageMainFile(\'' + details.name + '\', \'lib/' + details.name + '\');\n');
    async.forEach(details.js, function (f, cb) {
        publishJSFile(
            details.name, 
            details.dirname, 
            f, 
            stream,
            cb
        );
    }, cb);
}

/**
    Publishes the html that allows to run the package in a browser
    using a standalone statically loaded html.
*/
function publishHtml(
    details,
    outputfolder,
    cb
) {
    // we need to load all components
    var dependencies = [
        path.join(details.name, details.name + '.js')
    ],
        deps = details.json.dependencies;
    if (deps) {
        Object.keys(deps).forEach(function (d) {
            dependencies.push(path.join(d, d + '.js'));
        });
    }
    dust.render('componentTemplate', { 
        dependencies: dependencies,
        main: details.name
    }, function (err, data) {
        if (err) {
            return cb(err);
        }
        fs.writeFile(
            path.join(outputfolder, details.name + '.html'),
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
    details,
    outputfolder, 
    cb
) {
    async.parallel([
        function (cb) {
            checkOlderOrInvalid(
                path.join(outputfolder, details.name, details.name + '.js'),
                details.mostRecentJSDate,
                function (err, older) {
                    if (older) {
                        publishJSFiles(details, outputfolder, cb);
                    } else {
                        cb(err);
                    }
                }
            );
        },
        function (cb) {
            async.forEach(details.other, function (f, cb) {
				//console.log('>>>> ' + details.name + ' ' + details.dirname + ' ' + f + ' ' + outputfolder)                    
                publishAsset(
                    details.name, 
                    details.dirname, 
                    f, 
                    outputfolder,
                    cb
                );
            }, cb);
        },
        function (cb) {
            checkOlderOrInvalid(
                path.join(outputfolder, details.name + '.html'),
                details.mostRecentJSDate,
                function (err, older) {
                    if (older) {
                        publishHtml(details, outputfolder, cb);
                    } else {
                        cb(err);
                    }
                }
            );
        },
        function (cb) {
            publishMeat(outputfolder, cb);
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
function findPackageFiles(folder, result, cb) {
    // make sure we have what we need
    if (!result.js) {
        result.js = [];
    }
    if (!result.other) {
        result.other = [];
    }
    if (!result.stats) {
        result.stats = {};
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
                            // js file                            
                            if (isJs.test(file.filename)) {
                                result.stats[ffn] = file.stats;
                                // also keep the date of the most recent js file
                                if (!result.mostRecentJSDate || result.mostRecentJSDate.getTime() < file.stats.mtime.getTime()) {
                                    result.mostRecentJSDate = file.stats.mtime;
                                }
                                result.js.push(ffn);
                            } else {
                                matches = getExt.exec(file.filename);
                                if (matches && assetExt[matches[1]] !== undefined) {
                                    result.stats[ffn] = file.stats;
                                    result.other.push(ffn);
                                }
                            }
                            // nothing really async here
                            cb(null);
                        } else if (file.stats.isDirectory()) {
                            findPackageFiles(ffn, result, cb);
                        }
                    }, 
                    cb
                );
            }
        ],
        function (err) {
            cb(err, result);
        }
    );
}


/**
    Loads the details of a package: its package.json file and
    the paths of all its contained files (js, other like gifs and jpgs)
*/
function loadPackageDetails(packageFile, cb) {
    var result = {
        filename: packageFile.filename,
        mostRecentJSDate: packageFile.stats.mtime,
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
        result.json = JSON.parse(data.toString());
        result.name = result.json.name || path.basename(result.dirname);
        
        findPackageFiles(result.dirname, result, cb);
    });
}


/**
    Processes a package.json file that has been loaded with its "details".
*/
function processPackageDetails(details, outputfolder,  cb) {
    var dirname = details.dirname,
        // we should use the package.name for the packagename
        packagename = details.name,
        publishdir = path.join(outputfolder, packagename);

    // create an output dir for this package
    createFolder(publishdir, function (err) {
        if (err) {
            return cb(err);
        }
        makePublishedPackage(
            details,
            outputfolder, //publishdir, 
            cb
        );
    });
}

/**
    Processes multiple package details (the packages are given as a package map).
*/
function processMultiplePackageDetails(packages, dstFolder, cb) {
    async.forEach(
        Object.keys(packages), 
        function (pd, cb) {            
            processPackageDetails(packages[pd], dstFolder, cb);
        },
        cb
    );
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
function makeAll(srcFolder, dstFolder, cb) {
    findPackages(srcFolder, function (err, packages) {
        if (err) {
            return cb(err);
        }
        processMultiplePackageDetails(packages, dstFolder, cb);
    });
}

/**
    This function regenerates a single package.
    note: srcFolder can be a string or an array of strings
*/
function makePackage(srcFolder, dstFolder, packageName, cb) {
    findPackages(srcFolder, function (err, packages) {
        var deps;
        if (err) {
            return cb(err);
        }
        try {
            deps = getPackageDependencies(packages, packageName);
        } catch (e) {
            return cb(e);
        }
        processMultiplePackageDetails(deps, dstFolder, cb);
    });        
}

/**
    This function regenerates a single file (or a full package if
    a package name is specified).
    note: srcFolder can be a string or an array of strings
*/
function makeFile(srcFolder, dstFolder, dstFolderRelativeFilePath, cb) {
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
            dstFolder,
            cb
        );
        return;
    }    
    // non optimal but ok for now
    makePackage(srcFolder, dstFolder, assetFolderRoot, cb);
}

/**
    Command line support.
*/
if (process.argv.length === 4 && process.argv[1] === __filename) {
    makeAll(process.argv[2], process.argv[3], function (err) {
        if (err) {
            console.log(err);
        }
    });
} else if (process.argv.length === 5) {
    makeFile(process.argv[2], process.argv[3], process.argv[4], function (err) {
        if (err) {
            console.log(err);
        }
    });
}

/**
    Library support.
*/
exports.makeAll = makeAll;
exports.makePackage = makePackage;
exports.makeFile = makeFile;
