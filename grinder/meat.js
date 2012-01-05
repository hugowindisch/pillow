/**
    meat.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
var meat = {
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
    // this adds a module file to the loaded modules
    addModuleFile: function (packageName, filePath, fcn) {
        this.ensurePackage(packageName);
        this.packages[packageName].files[filePath] = fcn;
    },
    setPackageMainFile: function (packageName, filePath) {
        this.ensurePackage(packageName);
        this.packages[packageName].mainFile = filePath;
    },
    // transforms a relative path to an absolute path
    resolvePathArray: function (path, currentPath) {
        var spl = path.split('/'),
            cps = currentPath === '' ? [] : currentPath.split('/'),
            result = currentPath,
            l = spl.length,
            i,
            c;
           
        for (i = 0; i < l; i += 1) {
            c = spl[i];
            if (c === '..') {
                cps.pop();
            } else if (c !== '.') {
                cps.push(c);
            }
        }
        return cps;
    },
    // this is the top level require
    makeRequire: function (applicationDomain, currentPath) {
        var that = this;
        function require(moduleName) {
            var pathArray,
                path,
                fullPathDirectory,
                fullPath,
                packageName,
                exports;
                
            // the path can be either a module name OR a file
            // if it is NOT a path (i.e. 'potato'), we convert it
            // right now
            if (moduleName.indexOf('/') === -1) {
                path = moduleName + '/' + that.packages[moduleName].mainFile;
                
            } else {
                // we must make the path absolute
                path = moduleName;
            }            
            pathArray = that.resolvePathArray(path, currentPath);
            //console.log(pathArray);            
            fullPath = pathArray.join('/');
            packageName = pathArray[0];
            path = pathArray.slice(1).join('/');
            fullPathDirectory = pathArray.slice(0, pathArray.length - 1).join('/');
            
            console.log(fullPath + ' ' + packageName + ' ' + path + ' ' + fullPathDirectory);
            
            // if we could resolve the path being loaded
            if (path) {
                // if the module can't be found
                exports = applicationDomain[fullPath];
                if (!exports) {
                    exports = applicationDomain[fullPath] = {};
                    that.packages[packageName].files[path](
                        that.makeRequire(applicationDomain, fullPathDirectory),
                        applicationDomain[path],
                        // FIXME
                        path
                    );
                }
            }
            return exports;
        }
        return require;
    }    
};
/*
function test() {
    meat.addModuleFile('test1', 'src/test1', function (require, exports, module) {
        require('./gug');
        function abc() {
            console.log('hello');
        }
        abc();
    });
    meat.setPackageMainFile('test1', 'src/test1');
    meat.addModuleFile('test1', 'src/gug', function (require, exports, module) {
        function abc() {
            console.log('hello from gug');
        }
        abc();
    });
    var domain = {},
        require = meat.makeRequire(domain, '');
    require('test1');
}
*/
//test();

