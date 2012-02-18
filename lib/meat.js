/**
    meat.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
/*globals jQuery */
function define(id, dependencies, fcn) {
    // at this time, we don't support runtime loading, and we do nothing
    // with dependencies (we could, at the very least, check them though)
    define.meat.addModuleFile(id, dependencies, fcn);
}
define.amd = {};
define.meat = {
    // these are the loaded packages, not necessarily 'require'd yet
    packages: {
    },
    // this creates a package
    ensurePackage: function (packageName) {
        var pack = this.packages[packageName];
        if (!pack) {
            pack = this.packages[packageName] = {
                files: {
                },
                mainFile: null,
                dependencies: []
            };
        }
        return pack;
    },
    // this will integrate with jQuery
    supportJQuery: function (require) {
        if (jQuery) {
            jQuery.noConflict();
            // now we can integrate ourself to jquery
            this.addModuleFile('jQuery', [], function (require, exports, module) {
                exports.jQuery = jQuery;
            });
            // we can also allow any jQuery code to see our modules,
            // through jQuery.fn.meat(modulename, function, args)
            if (require) {
                var args = [], i;
                for (i = 2; i < arguments.length; i += 1) {
                    args.push(arguments[i]);
                }
                jQuery.fn.meat = function (thePackage, method) {
                    return require(thePackage)[method].apply(this, arguments);
                };
            }
        }
        // this has been done, no reason to do it again
        this.supportJQuery = function () {};
    },
    // this adds a module file to the loaded modules
    addModuleFile: function (id, dependencies, fcn) {
        var splitId = id.split('/'),
            packageName = splitId[0],
            pack = this.ensurePackage(packageName);        
        // add the dependencies
        pack.dependencies = dependencies;
        // if the nonstandard defineMain is never called, we assume that the
        // main file of a package is the first one that we see that is named
        // with the sme name as the package
        if (!pack.mainFile && (splitId.length > 1) && (splitId[0] === splitId[splitId.length - 1])) {
            pack.mainFile = id;
        }
        pack.files[splitId.slice(1).join('/')] = fcn;
    },
    defineMain: function (packageName, modulepath) {
        this.ensurePackage(packageName);
        this.packages[packageName].mainFile = modulepath;
    },
    // transforms a relative path to an absolute path
    resolvePathArray: function (path, currentPath) {
        var spl = path.split('/'),
            cps = currentPath === '' ? [] : currentPath.split('/'),
            result = currentPath,
            l = spl.length,
            i,
            c;
        if (l > 0) {
            c = spl[0];
            // is it a relative path?
            if (c !== '.' && c !== '..') {
                // no:
                cps = [];
            }
            // process the path
            for (i = 0; i < l; i += 1) {
                c = spl[i];
                if (c === '..') {
                    cps.pop();
                } else if (c !== '.' && c !== '') {
                    cps.push(c);
                }
            }
        }
        return cps;
    },
    // this is the top level require
    makeRequire: function (applicationDomain, currentPath, mainModule) {
        var that = this;
        function require(moduleName) {
            var pathArray,
                path,
                fullPathDirectory,
                fullPath,
                packageName,
                exports,
                module,
                p,
                m;
                
            // if the moduleName is a package name
            if (that.packages[moduleName]) {
                // replace the moduleName by the mainFile of the package
                path = that.packages[moduleName].mainFile;
            } else {
                path = moduleName;
            }
            pathArray = that.resolvePathArray(path, currentPath);
            fullPath = pathArray.join('/');
            packageName = pathArray[0];
            path = pathArray.slice(1).join('/');
            fullPathDirectory = pathArray.slice(0, pathArray.length - 1).join('/');
            
            // if the module can't be found
            exports = applicationDomain[fullPath];
            if (!exports) {
                p = that.packages[packageName];
                if (!p) {
                    throw new Error('Unavailable package ' + packageName);
                }
                m = p.files[path];
                if (!m) {
                    throw new Error('Unavailable module ' + path);
                }
                exports = applicationDomain[fullPath] = {};
                module = { id: fullPath, exports: exports };
                // the main module is the first one to be required
                if (!mainModule) {
                    mainModule = module;
                }
                m(
                    that.makeRequire(applicationDomain, fullPathDirectory, mainModule),
                    exports,
                    module
                );
                // just like node does, allow to replace exports
                exports = applicationDomain[fullPath] = module.exports;
            }
            return exports;
        }
        // setup main (this will depend on what topmost module is required)
        require.main = mainModule;
        return require;
    },
    // FIXME: runtime loading should only affect a given app domain. The best
    // way to do that is probably to copy the globally loaded definition to the
    // app domain and to only work with the app domain.
    loadDependencies: function (packageName, cb) {
        var pack = this.packages[packageName],
            deps,
            i,
            l,
            loaded = 0,
            loadError = null;
        function onLoaded(err) {
            loaded += 1;
            if (err) {
                loadError = err;
                // we should probably abort everything, in fact...
                // (removing script tags or whatever)
            }
            if (loaded === (l - 3)) {
                cb(loadError);
            }
        }
        if (pack) {
            deps = pack.dependencies;
            l = deps.length;
            // 3 because of the require, export, modules ugly thing
            if (l > 3) {
                for (i = 3; i < l; i += 1) {
                    this.loadPackage(deps[i], onLoaded);
                }
            } else {
                cb(null);
            }
        } else {
            cb(new Error('Unknown package ' + packageName));
        }
    },
    loadPackage: function (packageName, cb) {
        var script,
            body,
            that = this,
            pack = this.packages[packageName];
        function onComplete(err) {
            var i, loading = pack.loading, l = loading.length, li;
            delete pack.loading;
            if (err) {
                delete that.packages[packageName];
            }
            for (i = 0; i < l; i += 1) {
                li = loading[i];
                li(err);
            }
        }
        if (!pack) {
            pack = this.ensurePackage(packageName);
            pack.loading = [cb];
            script = document.createElement('script');
            body = document.getElementsByTagName('body')[0];
            body.appendChild(script);
            script.src = packageName + '/' + packageName + '.js';
            script.onload = function () {
                that.loadDependencies(packageName, onComplete);
            };
            script.onerror = function () {
                onComplete(new Error('could not load ' + packageName));
            };
        } else {
            // the package may be currently loading
            if (pack.loading) {
                pack.loading.push(cb);
            } else {
                // otherwise we are done
                cb(null);
            }
        }        
    }
};

