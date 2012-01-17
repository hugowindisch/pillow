/**
    meat.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
/*globals jQuery */
function define(id, dependencies, fcn) {
    // at this time, we don't support runtime loading, and we do nothing
    // with dependencies (we could, at the very least, check them though)
    define.meat.addModuleFile(id, fcn);
}
define.amd = {};
define.meat = {
    // these are the loaded packages, not necessarily 'require'd yet
    packages: {
    },
    // this creates a package
    ensurePackage: function (packageName) {
        if (!this.packages[packageName]) {
            this.packages[packageName] = {
                files: {
                },
                mainFile: null
            };
        }
    },
    // this will integrate with jQuery
    supportJQuery: function (require) {
        if (jQuery) {
            jQuery.noConflict();
            // now we can integrate ourself to jquery
            this.addModuleFile('jQuery', function (require, exports, module) {
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
    addModuleFile: function (id, fcn) {
        var splitId = id.split('/'),
            packageName = splitId[0];
        this.ensurePackage(packageName);
        // currently, we assume that when a package name without path info is
        // defined, the main file is defined
        if (splitId.length === 1) {
            this.packages[packageName].mainFile = fcn;
        } else {    
            this.packages[packageName].files[splitId.slice(1).join('/')] = fcn;
        }
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
                
            path = moduleName;
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
                if (pathArray.length === 1) {
                    m = p.mainFile;
                } else {
                    m = p.files[path];
                }
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
    }    
};

