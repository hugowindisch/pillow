Pillow scans directories for commonJS packages and makes them accessible
in the browser (the packages are converted to a directory that can
be served statically).

Pillow can operate from the command line or as a server. When running as
a server it will regenerate everything on the fly.

Images (png, jpg) are also copied to the output folder keeping the original
folder hierarchy relative to the package.json to which they belong.

Command line operation
======================

*process.js [options] folder1 [folder2..foldern] outputfolder*

With the following options:

*--help*: displays help information

*-jquery=filepath*: includes and integrates jquery using the provided sources

*-only=pathRelativeToDstFolder*: only remakes the specified file

*-cache=packageName,packageName2*: Use http caches for the specified package

*-cacheext=ext1,ext2,ext3*: Use http caches for the specified package

*-css*: Includes all dependent css files in the resulting html

*-html*: Generate a package.html

*-minify*: Minifies js file while packaging them

Server operation
================

*serve.js [options] folder1 [folder2..foldern] outputfolder*

will make all packages loadable as /make/packageName/packageName.js

Structure of the output folder
==============================

The output folder will have the following structure
    output/
        package1/
            package1.js
            some/
                subdir/
                    for/
                        images/
                            img1.png
