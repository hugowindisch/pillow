/**
    urls.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
/*jslint regexp: false */
var handlers = require('./handlers');
exports.getUrls = function (options) {
    return [
        { 
            filter: /^\/static\/(.*)$/, 
            handler: function (req, res, match) {
                handlers.staticServe(req, res, match, options);
            }
        }
    ];
};
