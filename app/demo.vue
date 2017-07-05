<template>
<form>
  <label>Nickname: <input :class="$k.f.name" v-model="name" type="text"></label>
  <label>Be good: <input :class="$k.f.goodness" v-model="goodness" type="text"></label>
  <span class="error" v-if="$k.f.goodness.error">{{ $k.f.goodness.message || "That's not quite right" }}</span>
</form>
</template>

<style>
.error { background-color: #ffcfcf }
.valid { background-color: #dde2a9 }
.pending { background-color: #cff0ff }
</style>

<script>
module.exports = {
    mixins: [require('kosher')],
    created() {
        var $k = this.$k.api;
        $k.alphaNum('name')
          .match('goodness', [/good/i], $k.debounce(200), $k.delay(138));
    },
    data: function() {
        return {
            name: "",
            goodness: "",
        }
    }
}
</script>
