module.exports = {
    npm: {
        enabled: true,
        whitelist: ["underscore", "vue"]
    },
    files: {
        javascripts: {
            joinTo: {
                'app.js': /^app/,
                'vendor.js': /^(?!app)/
            }
        }
    }
};
