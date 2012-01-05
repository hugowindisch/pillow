/**
    autogrind.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
var http = require('http'),
    srcFolder,
    dstFolder,
    urls = require('./urls').urls;
    
// this file implements a server that regenerates needed files
// on each request (i.e. a development server)
function serve(srcFolder, dstFolder) {
    var http = require('http');
    http.createServer(function (req, res) {
        var i, 
            l = urls.length,
            m,
            h;
        for(i = 0; i < l; i += 1) {
            h = urls[i];
            m = h.filter.exec(req.url);
            if (m) {
                h.handler(req, res, m, { srcFolder: srcFolder, dstFolder: dstFolder });
                return;
            }
        }
        res.writeHead(404);
        res.end();
    }).listen(1337, "127.0.0.1");
    console.log('Server running at http://127.0.0.1:1337/');

}
if (process.argv.length === 4 && process.argv[1] === __filename) {
    serve(process.argv[2], process.argv[3]);
}

