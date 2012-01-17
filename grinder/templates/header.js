define('{modulename}', ['require', 'exports', 'module'].concat([ {#dependencies}'{.}'{@sep}, {/sep}{/dependencies}]), function (require, exports, module) {
    module.exports = require('{modulepath}');
});

