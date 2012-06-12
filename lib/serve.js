#! /usr/bin/env node
/**
    serve.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
/*globals __filename */
var http = require('http'),
    scan = require('./process'),
    url = require('url'),
    options;

/**
    This function will serve the 'urls' mappings ({regexp: function})
    passing req, res and the match from the regexp to function.
*/
function serve(urls, port) {
    port = port || 1337;
    http.createServer(function (req, res) {
        var i,
            l = urls.length,
            m,
            h,
            parsedUrl = url.parse(req.url),
            pathname = parsedUrl.pathname,
            success;
        for (i = 0; i < l; i += 1) {
            h = urls[i];
            m = h.filter.exec(pathname);
            if (m) {
                try {
                    h.handler(req, res, m);
                    success = true;
                } catch (e) {
                    console.log('*** Exception In ' + req.url + ' error ' + e);
                }
                break;
            }
        }
        if (!success) {
            res.writeHead(404);
            res.end();
        }
    }).listen(port, '0.0.0.0');
    console.log('Server running on local host port ' + port);
}
// command line support
if (process.argv[1] === __filename) {
    options = scan.processArgs(process.argv.slice(2));
    if (options) {
        serve(require('./urls').getUrls(options), options.port);
    } else {
        console.log('--help for help');
    }
}
// library support
exports.serve = serve;
exports.getUrls = require('./urls').getUrls;
exports.makeAll = process.makeAll;
exports.makePackage = process.makePackage;
exports.makeFile = process.makeFile;
exports.processArgs = process.processArgs;
exports.argFilters = process.argFilters;
exports.findPackages = process.findPackages;
