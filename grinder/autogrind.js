/**
    autogrind.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
/*globals __filename */
var http = require('http'),
    srcFolder,
    dstFolder;
    
/**
    This function will serve the 'urls' mappings ({regexp: function})
    passing req, res and the match from the regexp to function.
*/
function serve(urls, readOnlyContext) {
    var http = require('http');
    http.createServer(function (req, res) {
        var i, 
            l = urls.length,
            m,
            h;
        for (i = 0; i < l; i += 1) {
            h = urls[i];
            m = h.filter.exec(req.url);
            if (m) {
                h.handler(req, res, m, readOnlyContext);
                return;
            }
        }
        res.writeHead(404);
        res.end();
    }).listen(1337, "127.0.0.1");
    console.log('Server running at http://127.0.0.1:1337/');
}
// command line support
if (process.argv[1] === __filename) {
    serve(require('./urls').urls, require('./grind.js').processArgs(process.argv.slice(2)));
}
// library support
exports.serve = serve;

