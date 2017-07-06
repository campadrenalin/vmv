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
        for (i in this.input_keys) {
            var input = this.input_keys[i];
            this.parent.$watch(input, function(newVal, oldVal){
                Vue.set(self.input_object, input, newVal);
                self.reset();
                self.ask();
            }, { deep: true });
        }
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
            return _.pick(this, 'pending', 'payload', 'success', 'failure', 'dirty');
        },
    },
    methods: {
        ask: function() {
            this.reset(true);
            var resp_key = this.response_key;
            var promise = this.cb.apply(this, [this.input_object].concat(this.args));
            promise
                .then(_.bind(this.resolve, this, resp_key))
                .catch(_.bind(this.reject, this, resp_key));
        },
        reset: function(mark_dirty) {
            this.latest_key = mark_dirty ? this.response_key : undefined;
        },
        store: function(resp_key, ok, data) {
            this.responses[resp_key] = {
                payload: data || ok,
                success: ok,
            }
            this.parent.$emit('kosher-response', this.description);
        },
        resolve: function(resp_key, data) { this.store(resp_key, true,  data) },
        reject:  function(resp_key, data) { this.store(resp_key, false, data) },
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
            'relations': {}, 'r': {},
            'fields': {},    'f': {},
        },
    }},
    created: function() {
        this.$on('kosher-response', function(response_name) {
            Vue.set(this.vue_kosher.r, response_name, this.vue_kosher.relations[response_name].summary);
            this.vue_kosher.f = _.mapObject(this.vue_kosher.fields, function(val, key){
                return val.summary
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
            return _.extend({},
                _.mapObject(this.$options.validators, _.bind(this.mkValidator, this)),
                this.$options.modifiers
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
                        inputs : _.find(arguments, _.isString) || '',
                        args   : _.find(arguments, _.isArray)  || [],
                        mods   : _.filter(arguments, _.isFunction),
                        validator : validator_name,
                    }
                });
                Vue.set(self.vue_kosher.relations, relation.description, relation);

                for (i in relation.input_keys) {
                    var input = relation.input_keys[i];
                    var field = self.vue_kosher.fields[input] || new KosherField();
                    Vue.set(self.vue_kosher.fields, input, field);
                    field.inputs.push(relation);
                }

                self.$emit('kosher-response', relation.description);

                return self.$k_api;
            }
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

module.exports = Kosher;
