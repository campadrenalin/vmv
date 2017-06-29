<template>
<form>
  <label>Nickname: <input :class="$v.name.alphaNum.state" v-model="name" type="text"></label>
  <label>Be good: <input :class="$v.goodness.match.state"  v-model="goodness" type="text"></label>
</form>
</template>

<style>
.error { background-color: #ffcfcf }
.valid { background-color: #dde2a9 }
.pending { background-color: #cff0ff }
</style>

<script>
module.exports = {
    mixins: [require('vmv')],
    created() {
        this.alphaNum('name')
            .match('goodness', [/good/i], this.debounce(400));
    },
    data: function() {
        return {
            name: "",
            goodness: "",
        }
    }
}
</script>
