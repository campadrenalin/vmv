var _ = require('underscore');

// TODO: Remove, hack
var Vue = require('vue');
require('vueify/lib/insert-css');

// Borrowed from https://github.com/monterail/vuelidate/blob/master/src/validators/email.js
const email_re = /(^$|^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$)/;

function match(inputs, regex) {
    return _.every(_.values(inputs), function(item) {
        return !!item.match(regex);
    });
}
function minLength(inputs, len) {
    return _.every(_.values(inputs), function(item) {
        return item.length >= len
    });
}
function required(inputs) {
    return _.every(_.values(inputs));
}

default_validators = {
    match: match,
    alphaNum: function(inputs) { return match(inputs, /^[a-zA-Z0-9]*$/) },
    email:    function(inputs) { return match(inputs, email_re) },

    minLength: minLength,
    required: required,
}

function promiseWrap(value) {
    return _.has(value, 'then') ? value
         : !!value              ? Promise.resolve(value)
         :                        Promise.reject(value)
         ;
}

KosherRelation = Vue.extend({
    props: ["parent", "inputs", "validator", "args", "mods"],
    created() {
        var self = this;
        for (m in this.mods) {
            this.mods[m](this);
        }
        _.each(this.input_keys, this.watch_input, this);
    },
    data: function() {
        var self = this;
        return {
            input_object: {},
            responses: {},
            latest_key: undefined,
            cb: function() {
                return promiseWrap(self.callback.apply(self, arguments));
            }
        }
    },
    computed: {
        dirty  : function() { return this.latest_key != undefined },
        latest : function() { return this.dirty ? this.responses[this.latest_key] : undefined },
        pending: function() { return this.dirty && !this.latest },

        payload: function() { return this.latest ? this.latest.payload : undefined },
        success: function() { return this.latest ? !!this.latest.success : undefined },
        failure: function() { return this.latest ?  !this.latest.success : undefined },
        message: function() { return this.failure ? this.payload || 'Unknown validation failure' : undefined },

        input_keys: function() { return this.inputs.split(/ +/) },
        response_key: function() {
            var vals = _.values(this.input_object);
            return vals.length == 1              ? vals[0].toString()
                :  this.latest_key === undefined ? 0
                :                                  (this.latest_key + 1) % 10
                ;
        },
        callback: function() {
            return this.parent.$options.validators[this.validator];
        },

        description: function() {
            return this.validator + '("' + this.inputs + '")'
        },
        summary: function() {
            return _.pick(this, 'pending', 'payload', 'success', 'failure', 'dirty', 'message');
        },
    },
    methods: {
        ask: function() {
            var resp_key = this.latest_key = this.response_key;
            var promise = this.cb.apply(this, [this.input_object].concat(this.args));
            promise
                .then(_.bind(this.resolve, this, resp_key))
                .catch(_.bind(this.reject, this, resp_key));
        },
        store: function(resp_key, ok, data) {
            Vue.set(this.responses, resp_key, {
                payload: data || ok,
                success: ok,
            });
            this.parent.$emit('kosher-response', this.description);
        },
        resolve: function(resp_key, data) { this.store(resp_key, true,  data) },
        reject:  function(resp_key, data) { this.store(resp_key, false, data) },

        watch_input: function(input_key) {
            this.parent.$watch(
                input_key,
                _.bind(this.watch_callback, this, input_key),
                { deep: true },
            );
        },
        watch_callback: function(input_key, newVal, oldVal) {
            Vue.set(this.input_object, input_key, newVal);
            
            // ask() may be wrapped by modifiers, like throtle() or debounce().
            // Set to pending => (modifier stuff) => set to upcoming response => response arrives
            // This sets pending state early, and maintains sync of "stuff requested" and "responses expected"
            this.latest_key = undefined;
            this.ask();
        },
    },
});

KosherField = Vue.extend({
    data: function() { return {
        inputs: [],
    }},
    computed: {
        pending: function() { return _.some( this.inputs, _.property('pending')) },
        success: function() { return _.every(this.inputs, _.property('success')) },
        failure: function() { return _.some( this.inputs, _.property('failure')) },

        state: function() {
            return this.pending ? 'pending'
                :  this.success ? 'valid'
                :  this.failure ? 'error'
                :                 ''
                ;
        },

        summary: function() {
            return _.pick(this, 'pending', 'success', 'failure', 'state');
        },
    },
});

Kosher = {
    data: function() { return {
        vue_kosher: {
            last_input_def: '',
            relations: {}, r: {},
            fields: {},    f: {},
            err: {},
        },
    }},
    created: function() {
        this.$on('kosher-response', function(response_name) {
            Vue.set(this.vue_kosher.r, response_name, this.vue_kosher.relations[response_name].summary);

            this.vue_kosher.f = _.mapObject(this.vue_kosher.fields, function(val, key){
                return val.summary
            });

            var self = this;
            this.vue_kosher.err = _.mapObject(self.vue_kosher.fields, function(field, field_name) {
                function rel_filter(relation) {
                    return _.contains(relation.input_keys, field_name)
                }
                function pair_it(relation) {
                    return [relation.validator, relation.message]
                }

                return _.chain(self.vue_kosher.relations)
                    .pick(rel_filter)
                    .values()
                    .map(pair_it)
                    .object()
                    .value()
            });
        })
    },
    computed: {
        '$k': function() {
            var k = this.vue_kosher;
            k.api = this.$k_api;
            return k;
        },
        '$k_api': function() {
            this.$options.validators = _.extend({}, default_validators, this.$options.validators);
            return _.extend(
                {
                    group: _.bind(this.group, this),
                },
                _.mapObject(this.$options.validators, _.bind(this.mkValidator, this)),
                _.mapObject(this.$options.modifiers, _.bind(this.mkModifier, this)),
            );
        },
    },
    methods: {
        mkValidator: function(validator_callback, validator_name) {
            var self = this;
            return function() {
                var relation = new KosherRelation({
                    propsData: {
                        parent : self,
                        inputs : _.find(arguments, _.isString) || self.vue_kosher.last_input_def,
                        args   : _.find(arguments, _.isArray)  || [],
                        mods   : _.filter(arguments, _.isFunction),
                        validator : validator_name,
                    }
                });
                Vue.set(self.vue_kosher.relations, relation.description, relation);
                self.vue_kosher.last_input_def = relation.inputs;

                for (i in relation.input_keys) {
                    var field_name = relation.input_keys[i];
                    self.getField(field_name).inputs.push(relation);
                }

                self.$emit('kosher-response', relation.description);

                return self.$k_api;
            }
        },
        mkModifier: function(modifier_callback, modifier_name) {
            return function() {
                var original_args = arguments;
                return function(relation) {
                    modifier_callback.apply(relation, original_args);
                }
            }
        },
        getField: function(name) {
            var field = this.vue_kosher.fields[name] || new KosherField();
            Vue.set(this.vue_kosher.fields, name, field);
            return field;
        },
        group: function(name, inputs) {
            inputs = inputs || this.vue_kosher.last_input_def;
            this.vue_kosher.last_input_def = inputs;
            inputs = inputs.split(/ +/);

            var g = this.getField(name);
            g.inputs = _.map(inputs, _.bind(this.getField, this))
            return this.$k_api;
        },
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

module.exports = Kosher;
