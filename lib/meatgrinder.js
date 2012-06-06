#!/usr/bin/node
/**
    meatgrinder.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
/*globals __filename */
var http = require('http'),
    grind = require('./grind'),
    url = require('url'),
    srcFolder,
    dstFolder;

/**
    This function will serve the 'urls' mappings ({regexp: function})
    passing req, res and the match from the regexp to function.
*/
function serve(urls) {
    var http = require('http'),
        port = 1337;
    urls = urls || require('./urls').getUrls(require('./grind.js').processArgs(process.argv.slice(2)));
    http.createServer(function (req, res) {
        var i,
            l = urls.length,
            m,
            h,
            parsedUrl = url.parse(req.url),
            pathname = parsedUrl.pathname;
        for (i = 0; i < l; i += 1) {
            h = urls[i];
            m = h.filter.exec(pathname);
            if (m) {
                h.handler(req, res, m);
                return;
            }
        }
        res.writeHead(404);
        res.end();
    }).listen(port, '0.0.0.0');
    console.log('Server running on local host port ' + port);
}
// command line support
if (process.argv[1] === __filename) {
    serve();
}
// library support
exports.serve = serve;
exports.getUrls = require('./urls').getUrls;
exports.makeAll = grind.makeAll;
exports.makePackage = grind.makePackage;
exports.makeFile = grind.makeFile;
exports.processArgs = grind.processArgs;
exports.argFilters = grind.argFilters;
exports.findPackages = grind.findPackages;
