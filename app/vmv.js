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

VmvAPI = {
    created() {
        for (validator_name in this.$options.validators) {
            this.__proto__[validator_name] = _.bind(this.mkRelation, this, validator_name);
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
    relations: {}
};

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
        _inputs: function() { this.ask(); }
    },
    methods: {
        ask: function() {
            this.dirty = true;
            this.result = undefined;
            this.error  = undefined;
            var result = this.callback.apply(this, [this._inputs].concat(this.args));
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

module.exports = VmvAPI;
