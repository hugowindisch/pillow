/**
    urls.js
    Copyright (c) Hugo Windisch 2012 All Rights Reserved
*/
var handlers = require('./handlers');
exports.urls = [
    { 
        filter: /^\/static\/(.*)$/, 
        handler: handlers.staticServe
    }
];

