var _ = require('underscore');

// TODO: Remove, hack
var Vue = require('vue');
require('vueify/lib/insert-css');

function match(inputs, regex) {
    return _.every(_.values(inputs), function(item) {
        return !!item.match(regex);
    });
}
function alphaNum(inputs) {
    return match(inputs, /^[a-zA-Z0-9]*$/);
}

Kosher = {
    data: {
        '$k_fields': {},
        '$k_responses': {},
    },
    computed: {
        '$k': function() {
            return {
                api: this.$k_api,
                f: _.mapObject(this.$data.$k_fields, _.bind(this.computeField, this)),
            }
        },
        '$k_api': function() {
            return _.extend({},
                _.mapObject(this.$options.validators, _.bind(this.mkValidator, this)),
                this.$options.modifiers
            );
        },
    },
    methods: {
        mkValidator: function(func, name) {
            var self = this;
            return function(inputs) {
                var response_key = name+'('+inputs+')';
                if (!self.$data.$k_responses[response_key])
                    Vue.set(self.$data.$k_responses, response_key, {});
                if (!self.$data.$k_fields[inputs])
                    Vue.set(self.$data.$k_fields, inputs, []);

                self.$data.$k_fields[inputs].push(response_key);

                self.$watch(inputs, function(newVal, oldVal) {
                    Vue.set(self.$data.$k_responses[response_key], 'latest', newVal);
                    function store(payload, success) {
                        Vue.set(self.$data.$k_responses[response_key], newVal, {
                            payload: payload,
                            success: success,
                        });
                    }

                    Promise.reject(newVal.length % 2)
                        .then( function(payload) { store(payload, !!payload) })
                        .catch(function(payload) { store(payload, false) });
                });

                return self.$k_api;
            }
        },
        computeField: function(field, name) {
            var self = this;
            var dirty = false
            var responses = _.map(field, function(r) {
                var resp_data = self.$data.$k_responses[r];
                if (resp_data.latest !== undefined) dirty = true;
                return resp_data[resp_data.latest]
            });
            var compact = _.compact(responses);
            var err = _.find(compact, function(x) { return !x.success });

            return {
                valid:   dirty && _.every(compact, _.property('success')),
                error:   dirty && (err ? (err.payload || true) : false),
                message: dirty && (err && _.isString(err.payload) ? err.payload : undefined),
                pending: dirty && (compact.length != responses.length),
                dirty:   dirty,
            };
        },
    },
    validators: {
        match: match,
        alphaNum: alphaNum,
    },
    modifiers: {
        throttle: function(ms) { this.ask = _.throttle(this.ask, ms) },
        debounce: function(ms) { this.ask = _.debounce(this.ask, ms) },
        delay: function(ms) {
            var rel   = this;
            var inner = this.cb;
            this.cb = function() {
                var inner_promise = inner.apply(rel, arguments); // Guaranteed to be a promise
                return new Promise(function(outer_resolve, outer_reject) {
                    inner_promise
                        .then(function(data) { _.delay(outer_resolve, ms, data) })
                        .catch(function(data){ _.delay(outer_reject,  ms, data) })
                })
            }
        },
    },
};

VmvAPI = {
    created() {
        for (validator_name in this.$options.validators) {
            this.__proto__[validator_name] = _.bind(this.mkRelation, this, validator_name);
        }
        for (modifier_name in this.$options.modifiers) {
            this.__proto__[modifier_name] = _.bind(this.mkModifier, this, modifier_name);
        }
    },
    methods: {
        mkRelation: function(validator_name) {
            var init_args = _.rest(arguments);
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
        },
        mkModifier: function(modifier_name) {
            var args = _.rest(arguments);
            var mod  = this.$options.modifiers[modifier_name];
            return function(rel) {
                mod.apply(rel, args);
            }
        }
    },
    computed: {
        '$v': function() {
            return this.$options.relations;
        }
    },
    validators: {
        match: match,
        alphaNum: alphaNum,
    },
    modifiers: {
        throttle: function(ms) { this.ask = _.throttle(this.ask, ms) },
        debounce: function(ms) { this.ask = _.debounce(this.ask, ms) },
        delay: function(ms) {
            var rel   = this;
            var inner = this.cb;
            this.cb = function() {
                var inner_promise = inner.apply(rel, arguments); // Guaranteed to be a promise
                return new Promise(function(outer_resolve, outer_reject) {
                    inner_promise
                        .then(function(data) { _.delay(outer_resolve, ms, data) })
                        .catch(function(data){ _.delay(outer_reject,  ms, data) })
                })
            }
        },
    },
    relations: {}
};

VmvRelation = Vue.extend({
    props: ["parent", "inputs", "callback", "args", "mods"],
    created() {
        for (m in this.mods) {
            this.mods[m](this);
        }
    },
    data: function() {
        var self = this;
        return {
            dirty:   false,
            result:  undefined,
            error:   undefined,
            cb: function() {
                var result = self.callback.apply(self, arguments);
                return result === true  ? Promise.resolve(result)
                    :  result === false ? Promise.reject(result)
                    :                     result;
            }
        }
    },
    computed: {
        pending: function() {
            return this.dirty && !this.result && !this.error;
        },
        state: function() {
            return this.pending ? 'pending'
                :  this.result  ? 'valid'
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
        _inputs: function() { this.reset(); this.ask(); }
    },
    methods: {
        ask: function() {
            this.reset(true);
            var promise = this.cb.apply(this, _.flatten([this._inputs, this.args]));
            // TODO: invalidate in-flight work that no longer matches input data
            promise
                .then(_.bind(this.resolve, this))
                .catch(_.bind(this.reject, this));
        },
        reset: function(dirty) {
            this.dirty = dirty || false;
            this.result = undefined;
            this.error  = undefined;
        },
        resolve: function(data) {
            this.result = data || true;
            this.error  = false;
        },
        reject: function(data) {
            this.result = false;
            this.error  = data || true;
        },
    },
});

VmvAPI.Relation = VmvRelation;

module.exports = Kosher;
