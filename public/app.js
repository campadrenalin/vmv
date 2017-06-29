(function() {
  'use strict';

  var globals = typeof global === 'undefined' ? self : global;
  if (typeof globals.require === 'function') return;

  var modules = {};
  var cache = {};
  var aliases = {};
  var has = {}.hasOwnProperty;

  var expRe = /^\.\.?(\/|$)/;
  var expand = function(root, name) {
    var results = [], part;
    var parts = (expRe.test(name) ? root + '/' + name : name).split('/');
    for (var i = 0, length = parts.length; i < length; i++) {
      part = parts[i];
      if (part === '..') {
        results.pop();
      } else if (part !== '.' && part !== '') {
        results.push(part);
      }
    }
    return results.join('/');
  };

  var dirname = function(path) {
    return path.split('/').slice(0, -1).join('/');
  };

  var localRequire = function(path) {
    return function expanded(name) {
      var absolute = expand(dirname(path), name);
      return globals.require(absolute, path);
    };
  };

  var initModule = function(name, definition) {
    var hot = hmr && hmr.createHot(name);
    var module = {id: name, exports: {}, hot: hot};
    cache[name] = module;
    definition(module.exports, localRequire(name), module);
    return module.exports;
  };

  var expandAlias = function(name) {
    return aliases[name] ? expandAlias(aliases[name]) : name;
  };

  var _resolve = function(name, dep) {
    return expandAlias(expand(dirname(name), dep));
  };

  var require = function(name, loaderPath) {
    if (loaderPath == null) loaderPath = '/';
    var path = expandAlias(name);

    if (has.call(cache, path)) return cache[path].exports;
    if (has.call(modules, path)) return initModule(path, modules[path]);

    throw new Error("Cannot find module '" + name + "' from '" + loaderPath + "'");
  };

  require.alias = function(from, to) {
    aliases[to] = from;
  };

  var extRe = /\.[^.\/]+$/;
  var indexRe = /\/index(\.[^\/]+)?$/;
  var addExtensions = function(bundle) {
    if (extRe.test(bundle)) {
      var alias = bundle.replace(extRe, '');
      if (!has.call(aliases, alias) || aliases[alias].replace(extRe, '') === alias + '/index') {
        aliases[alias] = bundle;
      }
    }

    if (indexRe.test(bundle)) {
      var iAlias = bundle.replace(indexRe, '');
      if (!has.call(aliases, iAlias)) {
        aliases[iAlias] = bundle;
      }
    }
  };

  require.register = require.define = function(bundle, fn) {
    if (bundle && typeof bundle === 'object') {
      for (var key in bundle) {
        if (has.call(bundle, key)) {
          require.register(key, bundle[key]);
        }
      }
    } else {
      modules[bundle] = fn;
      delete cache[bundle];
      addExtensions(bundle);
    }
  };

  require.list = function() {
    var list = [];
    for (var item in modules) {
      if (has.call(modules, item)) {
        list.push(item);
      }
    }
    return list;
  };

  var hmr = globals._hmr && new globals._hmr(_resolve, require, modules, cache);
  require._cache = cache;
  require.hmr = hmr && hmr.wrap;
  require.brunch = true;
  globals.require = require;
})();

(function() {
var global = typeof window === 'undefined' ? this : window;
var process;
var __makeRelativeRequire = function(require, mappings, pref) {
  var none = {};
  var tryReq = function(name, pref) {
    var val;
    try {
      val = require(pref + '/node_modules/' + name);
      return val;
    } catch (e) {
      if (e.toString().indexOf('Cannot find module') === -1) {
        throw e;
      }

      if (pref.indexOf('node_modules') !== -1) {
        var s = pref.split('/');
        var i = s.lastIndexOf('node_modules');
        var newPref = s.slice(0, i).join('/');
        return tryReq(name, newPref);
      }
    }
    return none;
  };
  return function(name) {
    if (name in mappings) name = mappings[name];
    if (!name) return;
    if (name[0] !== '.' && pref) {
      var val = tryReq(name, pref);
      if (val !== none) return val;
    }
    return require(name);
  }
};
require.register("demo.vue", function(exports, require, module) {
;(function(){
"use strict";

var vmv = require('vmv');

module.exports = {
    mixins: [new vmv()],
    data: function data() {
        return {
            name: ""
        };
    }
};
})()
if (module.exports.__esModule) module.exports = module.exports.default
var __vue__options__ = (typeof module.exports === "function"? module.exports.options: module.exports)
if (__vue__options__.functional) {console.error("[vueify] functional components are not supported and should be defined in plain js files using render functions.")}
__vue__options__.render = function render () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('form',[_c('label',[_vm._v("Nickname: "),_c('input',{directives:[{name:"model",rawName:"v-model",value:(_vm.name),expression:"name"}],attrs:{"type":"text"},domProps:{"value":(_vm.name)},on:{"input":function($event){if($event.target.composing){ return; }_vm.name=$event.target.value}}})])])}
__vue__options__.staticRenderFns = []
if (module.hot) {(function () {  var hotAPI = require("vue-hot-reload-api")
  hotAPI.install(require("vue"), true)
  if (!hotAPI.compatible) return
  module.hot.accept()
  if (!module.hot.data) {
    hotAPI.createRecord("data-v-23240e1f", __vue__options__)
  } else {
    hotAPI.reload("data-v-23240e1f", __vue__options__)
  }
})()}
});

;require.register("vmv.js", function(exports, require, module) {
var _ = require('underscore');
var Vue = require('vue');

VmvAPI = Vue.extend({
    created() {
        var self = this;
        for (validator_name in this.$options.validators) {
            this.__proto__[validator_name] = function() {
                return self.mkRelation(validator_name, arguments)
            }
        }
    },
    methods: {
        mkRelation: function(validator_name, init_args) {
            var rel = new VmvRelation({
                propsData: {
                    parent : this,
                    inputs : _.find(init_args, _.isString) || '',
                    args   : _.find(init_args, _.isArray)  || [],
                    mods   : _.filter(init_args, _.isFunction),
                    callback : this.$options.validators[validator_name]
                }
            });

            var rels = this.$options.relations;
            var inputs = _.keys(rel._inputs);
            for (i in inputs) {
                var input = inputs[i];
                if (rels[input] === undefined)
                    rels[input] = {};
                rels[input][validator_name] = rel;
            }
            return this;
        }
    },
    validators: {
        alphaNum: function(inputs, arguments) {
            return true
        }
    },
    relations: {}
});

VmvRelation = Vue.extend({
    props: ["parent", "inputs", "callback", "args", "mods"],
    data: function() {
        return {
            dirty:   false,
            result:  undefined,
            error:   undefined,
        }
    },
    computed: {
        pending: function() {
            return this.dirty && !this.result && !this.error;
        },
        state: function() {
            return this.pending ? 'pending'
                :  this.okay    ? 'okay'
                :  this.error   ? 'error'
                :                 ''
                ;
        },
        _inputs: function() {
            var names = this.inputs.split(/ +/);
            return _.object(
                names,
                _.map(names, _.propertyOf(this.parent))
            );
        }
    },
    watch: {
        _inputs: function() { this.ask(); }
    },
    methods: {
        ask: function() {
            this.dirty = true;
            this.result = undefined;
            this.error  = undefined;
            var result = this.callback(this._inputs, this.arguments);
            if (result === true) {
                this.resolve(result)
            } else if (result === false) {
                this.reject(result)
            } else {
                // TODO: invalidate in-flight work that no longer matches input data
                result
                    .then(_.bind(this.resolve, this))
                    .catch(_.bind(this.reject, this));
            }
        },
        resolve: function(data) {
            this.dirty  = false;
            this.result = data || true;
            this.error  = false;
        },
        reject: function(data) {
            this.dirty  = false;
            this.result = false;
            this.error  = data || false;
        },
    },
});

VmvAPI.Relation = VmvRelation;

module.exports = VmvAPI;

});

require.alias("brunch/node_modules/deppack/node_modules/node-browser-modules/node_modules/process/browser.js", "process");process = require('process');require.register("___globals___", function(exports, require, module) {
  
});})();require('___globals___');


//# sourceMappingURL=app.js.map