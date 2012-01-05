/**
    urls.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
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
        js: 'application/ecmascript'
    };
/**
    Handler for statically serving files.
*/
exports.staticServe = function (req, res, match, cxt) {
    console.log(match[1]);
    async.waterfall([
        function (cb) {
console.log('grind ' + cxt.srcFolder + ' ' + cxt.dstFolder + ' ' + match[1]);
            grind.makeFile(cxt.srcFolder, cxt.dstFolder, match[1], cb);
        },
        function (cb) {
console.log('readFile ' + path.join(cxt.dstFolder,match[1]));
            fs.readFile(path.join(cxt.dstFolder,match[1]), cb);
        },
        function (data, cb) {
console.log('send');
            var ext = /\.([^.]*)$/,
                m = ext.exec(match[1]),
                mime = 'text/plain';

console.log(m);
console.log(data);
            if (m) {
console.log('---');            
                mime = mimetypes[m[1]] || mime;
            }
console.log(mime);            
            res.writeHead(200, {'Content-Type': mime});
            res.end(data);
        }
    ], function (err) {
console.log('kaboum');    
        if (err) {
            res.writeHead(404);
            res.end();
        }
    });
}
