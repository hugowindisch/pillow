/**
    urls.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
/*jslint regexp: false */
var async = require('async'),
    scan = require('./scan'),
    fs = require('fs'),
    path = require('path'),
    mimetypes = {
        jpg: 'image/jpeg',
        gif: 'image/gif',
        png: 'image/png',
        html: 'text/html',
        json: 'application/json',
        css: 'text/css',
        js: 'application/ecmascript'
    };
/**
    Handler for making files on the fly and serving them.
*/
exports.makeAndServe = function (req, res, match, cxt) {
    async.waterfall([
        function (cb) {
            scan.makeFile(cxt, match[1], cb);
        },
        function (data, cb) {
            var extRE = /\.([^.]*)$/,
                m = extRE.exec(match[1]),
                ext = m ? m[1] : null,
                mime = 'text/plain',
                mustCache = false,
                rs = fs.createReadStream(path.join(cxt.dstFolder, match[1]));

            if (m) {
                mime = mimetypes[ext] || mime;
            }

            // cache some packages
            if (cxt.cache) {
                cxt.cache.forEach(function (packageName) {
                    var m = new RegExp('^' + packageName + '\/');
                    if (m.test(match[1])) {
                        mustCache = true;
                    }
                });
            }
            // cache some extensions
            if (cxt.cacheext && ext) {
                cxt.cacheext.forEach(function (extToCache) {
                    if (extToCache === ext) {
                        mustCache = true;
                    }
                });
            }

            rs.on('error', function (err) {
                res.writeHead(404);
                res.end();
            });
            rs.once('open', function (fd) {
                var headers = {'Content-Type': mime};
                if (mustCache) {
                    headers['Cache-Control'] = 'max-age=2592000';
                }
                res.writeHead(200, headers);
            });

            rs.pipe(res);
        }
    ], function (err) {
        if (err) {
            res.writeHead(404);
            res.end();
        }
    });
};
