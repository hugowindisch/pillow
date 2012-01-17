define('{modulename}', ['require', 'exports', 'module'].concat([ {#dependencies}'{.}'{@sep}, {/sep}{/dependencies}]), function (require, exports, module) {{~n}
    module.exports = require('{modulepath}');{~n}
window.console.log(module.exports);    
});{~n}

