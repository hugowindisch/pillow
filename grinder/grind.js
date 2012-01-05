/**
    grind.js
    (c) Hugo Windisch 2012 All Rights Reserved
*/
var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    dust = require('dust'),
    srcTemplate = "meatGrinder.addModuleFile('{modulename}', '{filepath}', function (require, exports, module) {{~n}\
{code}{~n}\
});{~n}",
    compiled = dust.compile(srcTemplate, "srcTemplate"),
    assetExt = { 'jpg': 0, 'png': 0, 'gif': 0 };
  
dust.loadSource(compiled);

/*
    This will grind directories, find the package.json files and then
    publish the package.json files in a statically servable directory
    structure (that can be compressed to a web widget for example)
*/

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
    copyFile(filename, dstfolder, cb);
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
    var relative = filename.slice(modulerootfolder.length);
    
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
                filepath: relative,
                code: indented
            }, cb);
            
        },
        function (out, cb) {
            console.log(out);
// write to the stream            
            jsstream.write(out, cb);
        }], cb);
}


/**
    Packages the content of a module folder.
*/
/*
function publishModuleFolder(
    modulename, 
    modulerootfolder, 
    folder, 
    outputfolder, 
    jsstream, 
    cb
) {
    console.log('publishModuleFolder ' + folder);
    async.waterfall(
        [
            // read the dir
            function (cb) {
                fs.readdir(folder, cb);
            },
            // stat all files
            function (files, cb) {
                async.map(files, function (filename, cb) {
                    fs.stat(path.join(folder, filename), function (err, stats) {
console.log(stats);                    
                        if (err) {
                            return cb(err);
                        }
                        cb(err, {filename: filename, stats: stats});
                    });
                }, cb);
            },
            // for files that are js
            function (stats, cb) {
                // process all files
                async.forEach(stats, function (file, cb) {                
                    var isJs = /\.js$/,
                        getExt = /\.(\w+)$/,
                        matches;
                    if (file.stats.isFile()) {
                        // js file
                        if (isJs.test(file.filename)) {                                                
                            publishJSFile(
                                modulename,
                                modulerootfolder,
                                path.join(folder, file.filename),
                                jsstream,
                                cb
                            );
                        } else {
                            matches = getExt.exec(file.filename);
                            if (matches && assetExt[matches[1]] !== undefined) {
                                publishAsset(
                                    modulename,
                                    modulerootfolder,
                                    path.join(folder, file.filename),
                                    outputfolder,
                                    cb
                                );
                            } else {
                                // nothing to do with this file
                                cb(null);
                            }
                        }
                    } else if (file.stats.isDirectory()) {
                        publishModuleFolder(
                            modulename, 
                            modulerootfolder, 
                            path.join(folder, file.filename), 
                            outputfolder,
                            jsstream,
                            cb
                        );
                    }
                }, cb);
            }
        ],
        cb
    );
}
*/
function makePackage(
    details,
    outputfolder, 
    jsstream, 
    cb
) {
    async.parallel([
        function (cb) {
            async.forEach(details.js, function (f, cb) {
                publishJSFile(
                    details.name, 
                    details.dirname, 
                    f, 
                    jsstream,
                    cb
                );
            }, cb);
        },
        function (cb) {
            async.forEach(details.other, function (f, cb) {
console.log('>>>> ' + details.name + ' ' + details.dirname + ' ' + f + ' ' + outputfolder)                    
                publishAsset(
                    details.name, 
                    details.dirname, 
                    f, 
                    outputfolder,
                    cb
                );
            }, cb);
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
                                result.js.push(ffn);
                            } else {
                                matches = getExt.exec(file.filename);
                                if (matches && assetExt[matches[1]] !== undefined) {
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
        filename: packageFile,
        // FIXME: this does not use the package info
        dirname: path.dirname(packageFile),
        js: [],
        other: []
    };
    fs.readFile(packageFile, function (err, data) {
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
    Processes a package.json file.
*/
/*
function processPackage(packageFile, outputfolder, cb) {
    // load the json file
    fs.readFile(packageFile, function (err, data) {
        var p = JSON.parse(data.toString()),            
            dirname = path.dirname(packageFile),
            // we should use the package.name for the packagename
            packagename = p.name || path.basename(dirname),
            publishdir = path.join(outputfolder, packagename),
            publishJsStream = path.join(publishdir, packagename + '.js');
       
        console.log('publish ' + dirname + '  ' + packagename + ' ' + publishdir + ' ' + publishJsStream);
        // create an output dir for this package
        createFolder(publishdir, function (err) {
            if (err) {
                return cb(err);
            }
            var stream = fs.createWriteStream(publishJsStream);
            // we should support the dependencies and other stuff 
            // and use the src lib etc.. right now I will simply
            // use the package name and grind the whole directory where
            // the package.json was found
            publishModuleFolder(
                packagename, // modulename
                dirname, 
                dirname, 
                outputfolder, 
                stream, 
                function (err) {
                    // close the output stream
                    stream.destroySoon();
                    // propagate the result
                    cb(err);
                }
            );
        });
    });    
}*/
function processPackage(packageFile, outputfolder, cb) {
    // load the json file
    loadPackageDetails(packageFile, function (err, result) {
        var dirname = result.dirname,
            // we should use the package.name for the packagename
            packagename = result.name,
            publishdir = path.join(outputfolder, packagename),
            publishJsStream = path.join(publishdir, packagename + '.js');
       
        console.log('publish ' + dirname + '  ' + packagename + ' ' + publishdir + ' ' + publishJsStream);
        // create an output dir for this package
        createFolder(publishdir, function (err) {
            if (err) {
                return cb(err);
            }
            var stream = fs.createWriteStream(publishJsStream);
            makePackage(
                result,
                outputfolder, //publishdir, 
                stream, 
                cb
            );
        });
    });    
}

/**
    Finds packages from a given folder and calls cb(err, packages) where
    packages is an array of directory names relative to rootfolder.
*/
function findPackages(rootfolder, cb) {
    // make sure we have results
    var results = [];
    // inner function that actually does the job
    function fp(rootfolder, results, cb) {
        // search folders for package.json
        //as
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
                    // process all files
                    async.forEach(stats, function (file, cb) {
                        var isJs = /package\.json$/;
                        if (file.stats.isFile()) {
                            if (isJs.test(file.filename)) {
                                results.push(path.join(rootfolder, file.filename));
                                return cb(null);
                            } else {
                                cb(null);
                            }
                        } else if (file.stats.isDirectory()) {
                            fp(
                                path.join(rootfolder, file.filename),
                                results,
                                cb
                            );
                        }
                    }, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        return cb(null, results);
                    });
                }
            ],
            cb
        );
    }
    // do it!
    fp(rootfolder, results, cb);
}


if (process.argv.length === 4) {
    findPackages(process.argv[2], function (err, packages) {
        if (err) {
            console.log(err);            
        }
        console.log(packages);
        async.forEach(
            packages, 
            function (p, cb) {
                processPackage2(p, process.argv[3], cb);
/*                loadPackageDetails(p, function (err, result) {
                    console.log('---');
                    console.log(result);
                    cb(err);
                });*/
            },
            function (err) {
                console.log(err);
            }
        );
    });
        
}
