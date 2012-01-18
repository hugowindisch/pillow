/**
    urls.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
/*jslint regexp: false */
var async = require('async'),
    grind = require('./grind'),
    fs = require('fs'),
    path = require('path'),
    mimetypes = {
        jpg: 'image/jpg',
        gif: 'image/gif',
        png: 'image/png',
        html: 'text/html',
        json: 'application/json',
        css: 'text/css',
        js: 'application/ecmascript'
    };
/**
    Handler for statically serving files.
*/
exports.staticServe = function (req, res, match, cxt) {
    async.waterfall([
        function (cb) {
            grind.makeFile(cxt, match[1], cb);
        },
        function (data, cb) {
            var ext = /\.([^.]*)$/,
                m = ext.exec(match[1]),
                mime = 'text/plain',
                rs = fs.createReadStream(path.join(cxt.dstFolder, match[1]));

            if (m) {
                mime = mimetypes[m[1]] || mime;
            }

            rs.on('error', function () {
                res.writeHead(404);
                res.end();
            });
            rs.once('open', function (fd) {
                res.writeHead(200, {'Content-Type': mime});
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

