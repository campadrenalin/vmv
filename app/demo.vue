<template>
<form>
  <label>Nickname: <input v-model="name" type="text"></label>
</form>
</template>

<script>
var vmv = require('vmv');

module.exports = {
    mixins: [
        new vmv()
    ],
    data: function() {
        return {
            name: ""
        }
    }
}
</script>
