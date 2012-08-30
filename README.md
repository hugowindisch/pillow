Pillow scans directories for commonJS packages and makes them accessible in the browser with the require() function (the packages are converted to a directory that can be served statically).

Pillow can operate from the command line, as a server or as a middleware. When running as a server or as a middleware it will remake the packages automatically every time they are loaded by http, only rebuilding what has actually changed.

#Features
* Multiple modules (.js files) per package, multiple source directories, dot notation in require (e.g. require('../something'))
* Support for package resources (png, jpeg, gif, json, css, html, md)
* Minify Dox and Lint of source files
* Runtime loading of packages
* Optional separate application domains
* Command Line Operation
* Server Operation (transparent building of all what is loaded)
* Middleware Operation
* Support for ender packages

##Limitations
* Currently, pillow will generate one js file per package (but a package can contain multiple modules). There is no option in the current version to generate a single js file containing all the packages

* The ender runtime api (e.g. provide()) is not currently supported.

#Installation
npm install -g pillow

#Operation
##Command line operation
This assumes the package was installed globally. If not, pillowscan aliases to bin/pillowscan.js.

**pillowscan [options] folder1 [folder2..foldern]**

Options:

+ **--help**: displays help information

+ **-jquery=filepath**: includes and integrates jquery using the provided sources

+ **-only=pathRelativeToDstFolder**: only remakes the specified file

+ **-cache=packageName,packageName2**: Use http caches for the specified package

+ **-cacheext=ext1,ext2,ext3**: Use http caches for the specified package

+ **-css**: Includes all dependent css files in the resulting html

+ **-html**: Generate a package.html

+ **-minify**: Minifies js file while packaging them

+ **-nomake=package1,package2,package3** : Prevents some packages from being
regenerated

**-port=portnumber**: Uses the specified port in server mode (instead of 1337)

**-work=path**: Working directory (defaults to the current directory).

###example
```
    pillowscan mypackages
```

Will scan mypackages and its subdirectories and generate or update ./generated that will contain properly packaged sources and assets.

##Server operation
This assumes the package was installed globally. If not, pillowserve aliases to bin/pillowserve.js.

**pillowserve [options] folder1 [folder2..foldern]**

(see pillowscan for options)

will make all packages loadable at:

http://localhost:1337/make/packageName/packageName.js

So, to get the browser ready version of the packageName package, you can do:

curl -X GET http://localhost:1337/make/packageName/packageName.js

and its resources (pngs, gifs, etc) are loadable at:

http://localhost:1337/make/packageName/path/to/your/image.png

where path/to/your/image.png is the path, relative to the package.json file

##Middleware operation
(how to use pillow as a middleware (ex: from an Express application))
TBD

#Input: Packages
Pillow takes packages in input and produces an output directory that can be served statically.

Packages should follow the CommonJS Package 1.0 specification. The following fields of a package are currently used by pillow:

* **name:** Lets you define the name of the package. You will then be able to require it using this name.

* **dependencies:** Lets you define the dependencies of the package. When a package is loaded dynamically (using define.pillow.loadPackage), all its recursive dependencies will also be loaded. When an html file is created for a package, all its dependencies will have a link tag.

* **testDependencies:** Lets you define special dependencies that are only needed when your package is used in test mode (i.e. with the -test switch, for generating a packageName.test.js file). This is expressed an array of package names.

* **main:** Lets you define the main module of the package. If this is omitted, './lib/packageName.js' will be used by default.

* **engines:** The pillow engine MUST be defined to tell pillow to use the package. Alternately, if the keywords field contains the 'ender' keyword, the package will also be used (but treated differently, only exporting the main file).

* **keywords:** The 'ender' keyword designates an ender package. Other keywords are ignored.

## Example of a pillow package
```
    {
        "name": "http",
        "version": "0.0.1",
        "dependencies": {
            "utils": ">=0.0.1",
            "events": ">=0.0.1",
            "visual": ">=0.0.1",
            "url": ">=0.0.1"
        },
        "testDependencies": [ "assert" ],
        "scripts": {
            "test": "testviewer test/test.js"
        },
        "engines": {
            "pillow": "*"
        }
    }
```

##Special behaviors:

* **test folder**: all the files in the directory where the package.json file was found and all subdirectories of this directory are scanned, and all js files are included in the package. The only **exception** is the test folder. The test folder will only be scanned for js files if the -test switch is used. In this case, a packageName.test.js file will be generated and will contain

* **ender packages**: ender packages are supported, but the 'ender.js' file is not used and ender specific runtime functions are not supported. You can install an ender package by doing npm install packageName and then adding the node_modules directory to the list of directories used by pillowscan or pillowserve. Note that only one js module is included, the 'main' module.


#Output: Structure of the generated folder

The generated folder will have the following structure:

```
    generated/
        pillow.js
        package1/
            package1.js
            some/
                subdir/
                    for/
                        images/
                            img1.png
```

Assuming that img1.png was located at ./some/subdir/for/images/img1.png relative
to the package.json file.


So, here's a summary of what you will find in the 'generated' folder:

* a pillow.js file that you must include in your html file
* for each package, a subdirectory, named after the package that contains a packageName.js file (that includes all your package's modules), and optionally asset files (png, gif, jpg etc) organized in the same way they were in your source folder, relative to the package.json file.

The generated folder can be served statically.

#Using Pillow in HTML Files

This section explains how to use the output files and directories generated by pillow.

##Using define.pillow.loadPackage
Assuming that your application wants to use 'myPackage1' and 'myPackage2', you can do something like:

```html
<html>
    <head>
        <script src = "pillow.js"></script>
        <script>
            window.onload = function () {
                define.pillow.run(['myPackage1', 'myPackage2'], function (err, require) {
                    require('myPackage1').doDomething();
                });
            };
        </script>
    </head>
</html>
```

Note that this html file will need to be in the same folder ass pillow.js for this to work.

##Automatically generating and html file
You can tell pillowscan or pillowserve to automatically generate an html file for your package with the -html switch. This html will be placed in your generated folder, will be named yourPackage.html, and will look like:

```html
    <html>
    <head>
        <title>test1</title>

        <script src = "pillow.js"></script>
        <script src = "test1/test1.js"></script>
        <script src = "test2/test2.js"></script>

        <script>
            window.onload = function () {
                var pillow = define.pillow,
                    require = pillow.makeRequire(pillow.createApplicationDomain(), '');

                require('test1');
            }
        </script>
    </head>
    <body>
    </body>
    </html>
```

##Using Application Domains
You can load additional packages at execution time by calling define.pillow.loadPackage. This function takes an application domain as its second argument. An application domain contains the 'exports' of all the modules that were loaded in it. Using application domains can be useful for managing dependencies (unloading them at execution time).

###Runtime loading in the same application domain
This is how an additional package can be loaded at runtime, in the same application domain:

```html
    define.pillow.loadPackage(
        'myPackage',
        null,
        false,
        false,
        function (err) {
            // myPackage and all its dependencies are now loaded
            // everyone in the default domain will be able to require this
            // package from now on.
        }
    );
```
###Runtime loading in a different application domain
This is how an additional package can be loaded at runtime, in a new application domain (that, inherits from the topmost domain).

```html
    var myDomain = define.pillow.createApplicationDomain();
    define.pillow.loadPackage(
        'myPackage',
        myDomain,
        false,
        false,
        function (err) {
            // myPackage and all its dependencies are now loaded
            // We need a specific require function to require in the new
            // domain.
            var require = define.pillow.makeRequire(myDomain, '');
            require('myPackage').doSomething();
        }
    );
```

#License
MIT License

Copyright (C) 2012 Hugo Windisch

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
